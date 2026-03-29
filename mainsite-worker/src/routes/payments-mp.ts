/**
 * Rotas de Pagamento Mercado Pago (payment, refund, cancel, webhook, sync, logs).
 * Zero Trust: HMAC-SHA256 webhook validation, Bearer auth em rotas admin.
 * Domínio: /api/mp*, /api/webhooks/mercadopago, /api/financial-logs, /api/financeiro/sumup-*
 */
import { Hono } from 'hono';
import { MercadoPagoConfig, Payment, PaymentMethod, PaymentRefund } from 'mercadopago';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { structuredLog } from '../lib/logger.ts';
import {
  validateMercadoPagoSignatureAsync,
  getStartIsoWithCutoff,
  getStartDbWithCutoff,
  FINANCIAL_CUTOFF_ISO,
  FINANCIAL_CUTOFF_DB_UTC,
  loadFeeConfig,
} from '../lib/financial.ts';

const mp = new Hono<{ Bindings: Env }>();

// ========== PUBLIC PAYMENT ==========

mp.post('/api/mp-payment', async (c) => {
  try {
    const body = (await c.req.json()) as Record<string, unknown>;
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const { baseAmount, coverFees, ...mpPayload } = body as Record<string, unknown>;

    let transactionAmount = Number((mpPayload as { transaction_amount?: number }).transaction_amount);
    if (baseAmount && Number(baseAmount) > 0) {
      let finalAmount = Number(baseAmount);
      if (coverFees) {
        const fees = await loadFeeConfig(c.env.DB);
        finalAmount = parseFloat(((finalAmount + fees.mpFixed) / (1 - fees.mpRate)).toFixed(2));
      }
      transactionAmount = finalAmount;
      (mpPayload as Record<string, unknown>).transaction_amount = transactionAmount;
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);

    const extRef = `DON-${crypto.randomUUID()}`;
    const payer = (mpPayload as Record<string, Record<string, string>>).payer;
    const realFirstName = payer?.first_name;
    const realLastName = payer?.last_name;

    if (!realFirstName || !realLastName) {
      return c.json({ error: 'Nome e sobrenome reais são obrigatórios para validação antifraude.' }, 400);
    }

    const donorFullName = `${realFirstName} ${realLastName}`.trim();
    const donationDescriptor = `Doação de ${donorFullName} - Divagações Filosóficas`;

    const enhancedPayload = {
      ...(mpPayload as Record<string, unknown>),
      description: donationDescriptor,
      external_reference: extRef,
      statement_descriptor: 'DIVAGAC FILOSOF',
      notification_url: `${new URL(c.req.url).origin}/api/webhooks/mercadopago`,
      payer: {
        ...((mpPayload as Record<string, Record<string, string>>).payer || {}),
        first_name: realFirstName,
        last_name: realLastName,
      },
      additional_info: {
        items: [{
          id: 'DONATION-01',
          title: donationDescriptor,
          description: donationDescriptor,
          category_id: 'donations',
          quantity: 1,
          unit_price: transactionAmount,
        }],
        payer: {
          first_name: realFirstName,
          last_name: realLastName,
          phone: { area_code: '21', number: '999999999' },
          address: { street_name: 'Av. Principal', street_number: '1', zip_code: '00000000' },
        },
      },
    };

    const data = await paymentApi.create({
      body: enhancedPayload as unknown as Parameters<Payment['create']>[0]['body'],
      requestOptions: { idempotencyKey: crypto.randomUUID() },
    });

    return c.json(data, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ========== WEBHOOK (HMAC-SHA256 VALIDATED) ==========

mp.post('/api/webhooks/mercadopago', async (c) => {
  const signature = c.req.header('x-signature');
  const timestamp = c.req.header('x-timestamp');
  const body = (await c.req.json()) as Record<string, unknown>;

  if (!signature || !timestamp) {
    structuredLog('warn', 'Webhook received without signature/timestamp', {
      endpoint: '/api/webhooks/mercadopago',
      ip: c.req.header('cf-connecting-ip'),
      severity: 'CRITICAL',
      reason: 'Missing x-signature or x-timestamp header',
    });
    return c.json({ error: 'Invalid webhook: missing security headers' }, 401);
  }

  const webhookSecret = c.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    structuredLog('error', 'Webhook secret not configured', { endpoint: '/api/webhooks/mercadopago', severity: 'CRITICAL' });
    return c.text('OK', 200);
  }

  const isValidSignature = await validateMercadoPagoSignatureAsync(body, signature, timestamp, webhookSecret);
  if (!isValidSignature) {
    structuredLog('warn', 'Webhook signature validation failed', {
      endpoint: '/api/webhooks/mercadopago',
      ip: c.req.header('cf-connecting-ip'),
      severity: 'CRITICAL',
      reason: 'HMAC-SHA256 signature mismatch',
      signature_start: signature.substring(0, 20) + '...',
      timestamp,
    });
    return c.json({ error: 'Invalid webhook signature' }, 401);
  }

  // Validate timestamp (max 5 minutes)
  const webhookAge = Date.now() - parseInt(timestamp);
  if (webhookAge > 300_000) {
    structuredLog('warn', 'Webhook too old (>5 minutes)', {
      endpoint: '/api/webhooks/mercadopago',
      ip: c.req.header('cf-connecting-ip'),
      age_ms: webhookAge,
      timestamp,
    });
    return c.json({ error: 'Webhook too old' }, 400);
  }

  try {
    const url = new URL(c.req.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type') || (body as { type?: string }).type || (body as { topic?: string }).topic;
    const id = url.searchParams.get('id') || url.searchParams.get('data.id') || (body as { data?: { id?: string } }).data?.id || (body as { id?: string }).id;

    if (!id || (topic !== 'payment' && topic !== 'payment.created' && topic !== 'payment.updated')) {
      return c.text('OK', 200);
    }

    const mpToken = c.env.MP_ACCESS_TOKEN;
    let paymentData: Record<string, unknown> = {};

    if (mpToken) {
      const client = new MercadoPagoConfig({ accessToken: mpToken });
      const paymentApi = new Payment(client);
      paymentData = (await paymentApi.get({ id: id as string })) as unknown as Record<string, unknown>;
    }

    const status = (paymentData.status as string) || 'Desconhecido';
    const amount = Number(paymentData.transaction_amount || 0);
    const email = (paymentData.payer as Record<string, string>)?.email || 'N/A';
    const method = (paymentData.payment_method_id as string) || 'N/A';
    const extRef = (paymentData.external_reference as string) || 'N/A';

    const existing = await c.env.DB.prepare("SELECT id, status FROM mainsite_financial_logs WHERE payment_id = ?").bind(id).first<{ id: number; status: string }>();
    let shouldSendEmail = false;

    if (!existing) {
      shouldSendEmail = true;
      c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO mainsite_financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, status, amount, method, email, JSON.stringify(paymentData)).run()
      );
    } else {
      if (existing.status !== status) shouldSendEmail = true;
      c.executionCtx.waitUntil(
        c.env.DB.prepare("UPDATE mainsite_financial_logs SET status = ?, amount = ?, method = ?, payer_email = ?, raw_payload = ? WHERE payment_id = ?")
          .bind(status, amount, method, email, JSON.stringify(paymentData), id).run()
      );
    }

    if (shouldSendEmail && c.env.RESEND_API_KEY) {
      const htmlMsg = `
        <div style="font-family: sans-serif; color: #333;">
          <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Notificação de Pagamento (Mercado Pago)</h2>
          <p><strong>ID da Transação:</strong> ${id}</p>
          <p><strong>Referência Interna:</strong> ${extRef}</p>
          <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;"><strong>Status: <span style="color: ${status === 'approved' ? '#10b981' : (status === 'refunded' ? '#ef4444' : '#f59e0b')}">${status.toUpperCase()}</span></strong></p>
            <p style="margin: 10px 0 0 0;">Valor: R$ ${amount.toFixed(2)}</p>
          </div>
          <p><strong>Método Utilizado:</strong> ${method.toUpperCase()}</p>
          <p><strong>E-mail do Apoiador:</strong> ${email}</p>
        </div>
      `;

      c.executionCtx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Financeiro do Site <mainsite@lcv.app.br>',
            to: 'lcv@lcv.rio.br',
            subject: `[MP Webhook] Pagamento ${status.toUpperCase()} - R$${amount}`,
            html: htmlMsg,
          }),
        })
      );
    }

    return c.text('OK', 200);
  } catch {
    return c.text('Erro interno no Webhook', 500);
  }
});

// ========== ADMIN: MP PAYMENT METHODS / SUMMARY / ADVANCED ==========

mp.get('/api/mp/payment-methods', requireAuth, async (c) => {
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentMethodApi = new PaymentMethod(client);
    const methodsRaw = await paymentMethodApi.get();
    const methodsList = Array.isArray(methodsRaw) ? methodsRaw : [];

    const methodsAny = methodsList as unknown as Array<Record<string, unknown>>;
    const methods = [...new Set(methodsAny.map((m) => m?.id as string).filter(Boolean))];
    const types = [...new Set(methodsAny.map((m) => m?.payment_type_id as string).filter(Boolean))];
    const methodAssets = methodsAny.reduce((acc: Record<string, { label: string; image: string | null }>, m) => {
      const id = String(m?.id || '').trim();
      if (!id) return acc;
      acc[id] = {
        label: (m?.name as string) || id.toUpperCase(),
        image: (m?.secure_thumbnail || m?.thumbnail || null) as string | null,
      };
      return acc;
    }, {} as Record<string, { label: string; image: string | null }>);

    return c.json({ success: true, scanned: methodsList.length, methods, types, methodAssets });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

mp.get('/api/mp/transactions-summary', requireAuth, async (c) => {
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const now = new Date();
    const begin_date = getStartIsoWithCutoff(c.req.query('begin_date') || c.req.query('start_date'));
    const end_date = c.req.query('end_date') ? new Date(c.req.query('end_date')!).toISOString() : now.toISOString();

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);
    const payload = await paymentApi.search({
      options: { sort: 'date_created', criteria: 'desc', range: 'date_created', begin_date, end_date, limit, offset: 0 },
    });

    const items = Array.isArray((payload as unknown as Record<string, unknown>)?.results) ? (payload as unknown as { results: Array<Record<string, unknown>> }).results : [];
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalAmount = 0;
    let totalNetAmount = 0;

    for (const tx of items) {
      const status = String(tx?.status || 'unknown').toUpperCase();
      const type = String(tx?.payment_type_id || 'unknown').toUpperCase();
      const amount = Number(tx?.transaction_amount || 0);
      const net = Number((tx?.transaction_details as Record<string, unknown>)?.net_received_amount || 0);
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      totalAmount += amount;
      totalNetAmount += net;
    }

    return c.json({
      success: true,
      scanned: items.length,
      limit,
      totalAmount,
      totalNetAmount,
      byStatus,
      byType,
      paging: (payload as unknown as Record<string, unknown>)?.paging || { total: 0, limit, offset: 0 },
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

mp.get('/api/mp/transactions-advanced', requireAuth, async (c) => {
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const parseList = (value: string | undefined) => String(value || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const offsetRaw = Number(c.req.query('offset'));
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

    const statuses = parseList(c.req.query('statuses'));
    const types = parseList(c.req.query('types'));

    const now = new Date();
    const begin_date = getStartIsoWithCutoff(c.req.query('begin_date') || c.req.query('start_date'));
    const end_date = c.req.query('end_date') ? new Date(c.req.query('end_date')!).toISOString() : now.toISOString();

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);
    const payload = await paymentApi.search({
      options: { sort: 'date_created', criteria: order, range: 'date_created', begin_date, end_date, limit, offset },
    });

    const items = Array.isArray((payload as unknown as Record<string, unknown>)?.results) ? (payload as unknown as { results: Array<Record<string, unknown>> }).results : [];
    const normalized = items.map((tx) => ({
      id: tx?.id || null,
      transactionCode: tx?.authorization_code || null,
      amount: Number(tx?.transaction_amount || 0),
      currency: tx?.currency_id || 'BRL',
      status: tx?.status || 'unknown',
      type: tx?.payment_type_id || 'unknown',
      paymentType: tx?.payment_method_id || 'unknown',
      cardType: (tx?.card as Record<string, string>)?.last_four_digits ? `**** ${(tx?.card as Record<string, string>).last_four_digits}` : null,
      timestamp: tx?.date_created || null,
      user: (tx?.payer as Record<string, string>)?.email || (tx?.payer as Record<string, string>)?.id || null,
      refundedAmount: Number(tx?.transaction_amount_refunded || 0),
    }));

    const filtered = normalized.filter((tx) => {
      const statusOk = !statuses.length || statuses.includes(String(tx.status || '').toLowerCase());
      const typeOk = !types.length || types.includes(String(tx.type || '').toLowerCase());
      return statusOk && typeOk;
    });

    const paging = (payload as unknown as Record<string, Record<string, number>>)?.paging || { total: 0, limit, offset };
    const totalRaw = Number(paging?.total || 0);
    const hasPrev = offset > 0;
    const hasNext = (offset + limit) < totalRaw;

    return c.json({
      success: true,
      query: { order, limit, offset, statuses, types },
      paging: { total: totalRaw, limit, offset, hasPrev, hasNext, prevOffset: hasPrev ? Math.max(0, offset - limit) : null, nextOffset: hasNext ? offset + limit : null },
      scanned: normalized.length,
      totalFiltered: filtered.length,
      items: filtered,
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ========== REFUND / CANCEL ==========

mp.post('/api/mp-payment/:id/refund', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const client = new MercadoPagoConfig({ accessToken: token });
    const refundApi = new PaymentRefund(client);

    const refundBody: { payment_id: number; body?: { amount: number } } = { payment_id: Number(id) };
    try {
      const body = (await c.req.json()) as { amount?: number };
      if (body.amount) refundBody.body = { amount: Number(body.amount) };
    } catch { /* ignore */ }

    await refundApi.create(refundBody);
    // Determinar estorno total vs parcial comparando com valor original
    let newStatus = 'refunded';
    if (refundBody.body?.amount) {
      try {
        const logRow = await c.env.DB.prepare(
          "SELECT amount FROM mainsite_financial_logs WHERE payment_id = ? LIMIT 1"
        ).bind(id).first<{ amount?: number }>();
        const originalAmount = Number(logRow?.amount || 0);
        newStatus = (originalAmount > 0 && refundBody.body.amount < originalAmount) ? 'partially_refunded' : 'refunded';
      } catch { newStatus = 'partially_refunded'; }
    }
    await c.env.DB.prepare("UPDATE mainsite_financial_logs SET status = ? WHERE payment_id = ?").bind(newStatus, id).run();

    return c.json({ success: true, status: newStatus });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

mp.put('/api/mp-payment/:id/cancel', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);
    await paymentApi.cancel({ id: Number(id) });

    await c.env.DB.prepare("UPDATE mainsite_financial_logs SET status = 'cancelled' WHERE payment_id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ========== MP BALANCE (FROM LOCAL DB) ==========

mp.get('/api/mp-balance', requireAuth, async (c) => {
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const available = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM mainsite_financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) AND lower(status) = 'approved'"
    ).bind(startDb).first<{ total: number }>();
    const unavailable = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM mainsite_financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) AND lower(status) IN ('pending', 'in_process')"
    ).bind(startDb).first<{ total: number }>();
    return c.json({ available_balance: Number(available?.total || 0), unavailable_balance: Number(unavailable?.total || 0) });
  } catch {
    return c.json({ available_balance: 0, unavailable_balance: 0 });
  }
});

// ========== MP SYNC ==========

mp.post('/api/mp/sync', requireAuth, async (c) => {
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);

    // 1) Update existing local records
    const { results: localLogs = [] } = await c.env.DB.prepare(
      "SELECT payment_id FROM mainsite_financial_logs WHERE payment_id IS NOT NULL AND (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) ORDER BY created_at DESC LIMIT 100"
    ).bind(FINANCIAL_CUTOFF_DB_UTC).all();

    let inserted = 0, updated = 0, tracked = 0;

    for (const log of localLogs) {
      const paymentId = String((log as Record<string, unknown>).payment_id || '').trim();
      if (!paymentId) continue;
      try {
        const paymentData = (await paymentApi.get({ id: paymentId })) as unknown as Record<string, unknown>;
        const status = String((paymentData.status as string) || 'unknown').toLowerCase();
        const amount = Number(paymentData.transaction_amount || 0);
        const email = (paymentData.payer as Record<string, string>)?.email || 'N/A';
        const method = (paymentData.payment_method_id as string) || 'N/A';
        const raw = JSON.stringify(paymentData);

        await c.env.DB.prepare(
          "UPDATE mainsite_financial_logs SET status = ?, amount = ?, method = ?, payer_email = ?, raw_payload = ? WHERE payment_id = ? AND (method IS NULL OR method != 'sumup_card')"
        ).bind(status, amount, method, email, raw, paymentId).run();
        tracked++;
        updated++;
      } catch { /* continue sync */ }
    }

    // 2) Broad search (best effort)
    let scanned = localLogs.length;
    try {
      const payload = await paymentApi.search({
        options: { sort: 'date_created', criteria: 'desc', range: 'date_created', begin_date: FINANCIAL_CUTOFF_ISO, end_date: new Date().toISOString(), limit: 100 },
      });

      const payments = Array.isArray((payload as unknown as Record<string, unknown>)?.results) ? (payload as unknown as { results: Array<Record<string, unknown>> }).results : [];
      scanned = payments.length;

      for (const paymentData of payments) {
        const paymentId = String(paymentData.id || '').trim();
        if (!paymentId) continue;

        const externalRef = String(paymentData.external_reference || '').trim();
        const description = String(paymentData.description || '').toLowerCase();
        const looksLikeSiteDonation = externalRef.startsWith('DON-') || description.includes('divagações filosóficas') || description.includes('divagacoes filosoficas');
        if (!looksLikeSiteDonation) continue;

        const existing = await c.env.DB.prepare(
          "SELECT id FROM mainsite_financial_logs WHERE payment_id = ? AND (method IS NULL OR method != 'sumup_card') LIMIT 1"
        ).bind(paymentId).first();
        if (existing) continue;

        const status = String((paymentData.status as string) || 'unknown').toLowerCase();
        const amount = Number(paymentData.transaction_amount || 0);
        const email = (paymentData.payer as Record<string, string>)?.email || 'N/A';
        const method = (paymentData.payment_method_id as string) || 'N/A';
        const raw = JSON.stringify(paymentData);

        await c.env.DB.prepare(
          "INSERT INTO mainsite_financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(paymentId, status, amount, method, email, raw).run();
        inserted++;
      }
    } catch { /* broad search is best effort */ }

    return c.json({ success: true, inserted, updated, total: tracked + inserted, scanned });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ========== FINANCIAL LOGS (MP) ==========

mp.get('/api/financial-logs', requireAuth, async (c) => {
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const { results } = await c.env.DB.prepare("SELECT * FROM mainsite_financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) ORDER BY created_at DESC LIMIT 100").bind(startDb).all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

mp.get('/api/financial-logs/check', requireAuth, async (c) => {
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const result = await c.env.DB.prepare("SELECT COUNT(*) as total FROM mainsite_financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?)").bind(startDb).first<{ total: number }>();
    return c.json({ count: result?.total || 0 });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

mp.delete('/api/financial-logs/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare("DELETE FROM mainsite_financial_logs WHERE id = ? AND (method IS NULL OR method != 'sumup_card')").bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default mp;
