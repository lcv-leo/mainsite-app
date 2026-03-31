/**
 * Rotas de Pagamento SumUp (checkout, pay, 3DS, insights).
 * Zero Trust: todas as rotas admin requerem Bearer token.
 * Domínio: /api/sumup/*
 *
 * Arquitetura Live API-first:
 * - Dados transacionais: SumUp SDK (fonte de verdade)
 * - D1 financeiro: removido (sem consumidor)
 * - Fee Config: D1 `mainsite_settings` (configuração, não transação)
 */
import { Hono } from 'hono';
import SumUp from '@sumup/sdk';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { structuredLog } from '../lib/logger.ts';
import {
  normalizeSumupStatus,
  getStartIsoWithCutoff,
  isOnOrAfterCutoff,
  FINANCIAL_CUTOFF_DATE,
  loadFeeConfig,
} from '../lib/financial.ts';

const sumup = new Hono<{ Bindings: Env }>();

// Helper: parse SumUp SDK error into user-friendly message
function parseSumupError(err: Error): { message: string; httpStatus: number } {
  const rawMsg = err.message || '';
  const sdkMatch = rawMsg.match(/^(\d{3}):\s*(.+)$/s);
  let userMessage = rawMsg;
  let httpStatus = 500;

  if (sdkMatch) {
    const sdkStatus = parseInt(sdkMatch[1], 10);
    httpStatus = sdkStatus >= 400 && sdkStatus < 500 ? 422 : 500;
    try {
      const parsed = JSON.parse(sdkMatch[2]);
      userMessage = parsed.message || rawMsg;
    } catch {
      userMessage = sdkMatch[2] || rawMsg;
    }
  }

  const lowerMsg = userMessage.toLowerCase();
  if (lowerMsg.includes('card is expired')) userMessage = 'Cartão expirado. Verifique a validade.';
  else if (lowerMsg.includes('insufficient funds')) userMessage = 'Saldo insuficiente no cartão.';
  else if (lowerMsg.includes('do not honor')) userMessage = 'Pagamento recusado pelo banco emissor.';
  else if (lowerMsg.includes('invalid card')) userMessage = 'Número de cartão inválido ou não suportado.';
  else if (lowerMsg.includes('invalid security code')) userMessage = 'Código de segurança (CVV) inválido.';
  else if (lowerMsg.includes('failed to validate request')) userMessage = 'Dados de pagamento rejeitados pela operadora. Revise os dados.';

  return { message: userMessage, httpStatus };
}

// ========== PUBLIC CHECKOUT & PAY ==========

sumup.post('/api/sumup/checkout', async (c) => {
  try {
    structuredLog('info', '[SumUp Checkout] Iniciando criação de checkout');
    const payload = (await c.req.json()) as Record<string, unknown>;
    const { baseAmount, coverFees, firstName, lastName } = payload;

    if (!baseAmount || Number(baseAmount) <= 0) {
      return c.json({ error: 'Valor inválido para checkout SumUp.' }, 400);
    }

    const sumupToken = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!sumupToken || !merchantCode) {
      return c.json({ error: 'SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE não configurados.' }, 503);
    }

    const client = new SumUp({ apiKey: sumupToken });
    const checkoutReference = `SUMUP-DON-${crypto.randomUUID()}`;
    const fullName = `${(String(firstName || '')).trim()} ${(String(lastName || '')).trim()}`.trim() || 'Doador';

    const checkout = await client.checkouts.create({
      checkout_reference: checkoutReference,
      amount: Number(amount),
      currency: 'BRL',
      merchant_code: merchantCode,
      description: `Doação de ${fullName} - Divagações Filosóficas`,
      return_url: `${new URL(c.req.url).origin}/api/sumup/checkout/${checkoutReference}/return`,
    });

    structuredLog('info', `[SumUp Checkout] Checkout criado: ${(checkout as { id: string }).id}`);
    return c.json({ checkoutId: (checkout as { id: string }).id, checkoutReference }, 201);
  } catch (err) {
    structuredLog('error', '[SumUp Checkout] Erro ao criar checkout', { error: (err as Error).message });
    return c.json({ error: (err as Error).message || 'Falha ao iniciar checkout SumUp.' }, 500);
  }
});

sumup.post('/api/sumup/checkout/:id/pay', async (c) => {
  try {
    const checkoutId = c.req.param('id');
    const payloadReq = (await c.req.json()) as Record<string, unknown>;
    const { baseAmount, coverFees, card, firstName, lastName, email, document: taxId } = payloadReq as {
      baseAmount?: number; coverFees?: boolean; card?: Record<string, string>;
      firstName?: string; lastName?: string; email?: string; document?: string;
    };

    if (!checkoutId) return c.json({ error: 'Checkout inválido.' }, 400);
    if (!baseAmount || Number(baseAmount) <= 0) return c.json({ error: 'Valor inválido para pagamento SumUp.' }, 400);
    if (!card?.name || !card?.number || !card?.expiryMonth || !card?.expiryYear || !card?.cvv) {
      return c.json({ error: 'Dados de cartão incompletos.' }, 400);
    }

    let amount = Number(baseAmount);
    if (coverFees) {
      const fees = await loadFeeConfig(c.env.DB);
      amount = parseFloat(((amount + fees.sumupFixed) / (1 - fees.sumupRate)).toFixed(2));
    }

    const sumupToken = c.env.SUMUP_API_KEY_PRIVATE;
    if (!sumupToken) return c.json({ error: 'SUMUP_API_KEY_PRIVATE não configurada.' }, 503);

    const client = new SumUp({ apiKey: sumupToken });

    const processPayload = {
      payment_type: 'card',
      card: {
        number: card.number.replace(/\s/g, ''),
        expiry_month: String(card.expiryMonth).padStart(2, '0'),
        expiry_year: String(card.expiryYear).length === 2 ? `20${card.expiryYear}` : String(card.expiryYear),
        cvv: card.cvv,
        name: card.name.trim(),
      },
      personal_details: {
        first_name: (firstName || '').trim() || undefined,
        last_name: (lastName || '').trim() || undefined,
        email: (email || '').trim() || undefined,
        tax_id: (taxId || '').trim() || undefined,
      },
    };

    let result: Record<string, unknown>;
    try {
      result = (await client.checkouts.process(checkoutId, processPayload as Parameters<typeof client.checkouts.process>[1])) as Record<string, unknown>;
    } catch (updateErr) {
      // Sem D1 write — provider é fonte de verdade
      const { message, httpStatus } = parseSumupError(updateErr as Error);
      return c.json({ error: message }, httpStatus as 422);
    }

    const transactions = result.transactions as Array<{ id?: string }> | undefined;
    const storedId = transactions?.[0]?.id || result.id || checkoutId;
    const storedStatus = normalizeSumupStatus(String(result.status || 'PENDING'));

    // Sem D1 write — provider é fonte de verdade

    return c.json({ success: true, id: storedId, status: storedStatus, next_step: result.next_step });
  } catch (err) {
    return c.json({ error: (err as Error).message || 'Falha no pagamento SumUp.' }, 500);
  }
});

// 3DS Return Page
sumup.get('/api/sumup/checkout/:ref/return', async (c) => {
  const ref = c.req.param('ref');
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verificação Concluída</title>
  <style>
    body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: transparent; }
    .loader { border: 3px solid rgba(0, 0, 0, 0.1); border-left-color: #000; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
    <div class="loader"></div>
    <span style="font-size: 13px; font-weight: bold;">Redirecionando...</span>
  </div>
  <script>
    window.parent.postMessage({ type: "sumup-3ds-success", ref: "${ref}" }, "*");
  </script>
</body>
</html>`;
  return c.html(html);
});

// 3DS Polling — Consulta SDK diretamente (sem D1)
sumup.get('/api/sumup/checkout/:id/status', async (c) => {
  const paymentId = c.req.param('id');
  if (!paymentId || paymentId.length < 10) return c.json({ status: 'PENDING' });

  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    if (!token) return c.json({ status: 'PENDING' });

    const client = new SumUp({ apiKey: token });
    const checkoutData = (await client.checkouts.get(paymentId)) as Record<string, unknown> & {
      transactions?: Array<{ status?: string }>;
    };

    const txStatus = checkoutData?.transactions?.[0]?.status;
    const rawStatus = String(txStatus || checkoutData?.status || 'PENDING').toUpperCase();
    const currentStatus = normalizeSumupStatus(rawStatus);

    return c.json({ status: currentStatus });
  } catch {
    return c.json({ status: 'PENDING' });
  }
});

// ========== ADMIN ROUTES (SDK-only, sem D1) ==========

sumup.get('/api/sumup/payment-methods', requireAuth, async (c) => {
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const amountRaw = Number(c.req.query('amount'));
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 10;
    const currency = (c.req.query('currency') || 'BRL').toUpperCase();

    const client = new SumUp({ apiKey: token });
    const data = (await client.checkouts.listAvailablePaymentMethods(merchantCode, { amount, currency })) as { available_payment_methods?: Array<{ id?: string }> };
    const methods = Array.isArray(data?.available_payment_methods) ? data.available_payment_methods.map((m) => m.id).filter(Boolean) : [];

    return c.json({ success: true, amount, currency, methods });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

sumup.get('/api/sumup/transactions-summary', requireAuth, async (c) => {
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const changesSince = getStartIsoWithCutoff(c.req.query('changes_since') || c.req.query('start_date'));

    const client = new SumUp({ apiKey: token });
    const txData = (await client.transactions.list(merchantCode, { order: 'descending', limit, changes_since: changesSince })) as { items?: Array<Record<string, unknown>>; links?: Array<Record<string, unknown>> };
    const rawItems = Array.isArray(txData?.items) ? txData.items : [];
    const items = rawItems.filter((tx) => isOnOrAfterCutoff(tx?.timestamp as string));

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalAmount = 0;
    for (const tx of items) {
      const status = String(tx?.status || 'UNKNOWN').toUpperCase();
      const type = String(tx?.type || 'UNKNOWN').toUpperCase();
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      totalAmount += Number(tx?.amount || 0);
    }

    return c.json({ success: true, scanned: items.length, limit, totalAmount, byStatus, byType, hasMore: Array.isArray(txData?.links) && txData.links.length > 0 });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

sumup.get('/api/sumup/transactions-advanced', requireAuth, async (c) => {
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const parseList = (value: string | undefined) => String(value || '').split(',').map((v) => v.trim()).filter(Boolean);
    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const order = c.req.query('order') === 'ascending' ? 'ascending' : 'descending';

    const statusMap: Record<string, string> = { successful: 'SUCCESSFUL', cancelled: 'CANCELLED', failed: 'FAILED', refunded: 'REFUNDED', charge_back: 'CHARGE_BACK', chargeback: 'CHARGE_BACK' };
    const typeMap: Record<string, string> = { payment: 'PAYMENT', refund: 'REFUND', charge_back: 'CHARGE_BACK', chargeback: 'CHARGE_BACK' };

    const allowedStatuses = new Set(['SUCCESSFUL', 'CANCELLED', 'FAILED', 'REFUNDED', 'CHARGE_BACK']);
    const statuses = parseList(c.req.query('statuses')).map((s) => statusMap[s.toLowerCase()] || s.toUpperCase()).filter((s) => allowedStatuses.has(s));
    const types = parseList(c.req.query('types')).map((t) => typeMap[t.toLowerCase()] || t.toUpperCase()).filter(Boolean);
    const paymentTypes = parseList(c.req.query('payment_types')).map((v) => v.toUpperCase());
    const users = parseList(c.req.query('users'));

    const query: Record<string, unknown> = { order, limit };
    if (statuses.length) query['statuses[]'] = statuses;
    if (types.length) query.types = types;
    if (paymentTypes.length) query.payment_types = paymentTypes;
    if (users.length) query.users = users;

    const changesSince = getStartIsoWithCutoff(c.req.query('changes_since') || c.req.query('start_date'));
    query.changes_since = changesSince;

    const newestTime = c.req.query('newest_time');
    const newestRef = c.req.query('newest_ref');
    const oldestTime = c.req.query('oldest_time');
    const oldestRef = c.req.query('oldest_ref');
    if (newestTime) query.newest_time = newestTime;
    if (newestRef) query.newest_ref = newestRef;
    if (oldestTime) query.oldest_time = oldestTime;
    if (oldestRef) query.oldest_ref = oldestRef;

    const client = new SumUp({ apiKey: token });
    const txData = (await client.transactions.list(merchantCode, query)) as { items?: Array<Record<string, unknown>>; links?: Array<{ rel?: string; href?: string }> };
    const items = Array.isArray(txData?.items) ? txData.items : [];

    const normalized = items.map((tx) => ({
      id: tx?.id || tx?.transaction_id || null,
      transactionCode: tx?.transaction_code || null,
      amount: Number(tx?.amount || 0),
      currency: tx?.currency || 'BRL',
      status: tx?.status || 'UNKNOWN',
      type: tx?.type || 'UNKNOWN',
      paymentType: tx?.payment_type || 'UNKNOWN',
      cardType: tx?.card_type || null,
      timestamp: tx?.timestamp || null,
      user: tx?.user || null,
      refundedAmount: Number(tx?.refunded_amount || 0),
    }));
    const filteredByDate = normalized.filter((tx) => isOnOrAfterCutoff(tx?.timestamp as string));

    const pickCursor = (href: string) => {
      try {
        const url = new URL(href);
        const params = url.searchParams;
        const cursor: Record<string, string> = {};
        const nt = params.get('newest_time');
        const nr = params.get('newest_ref');
        const ot = params.get('oldest_time');
        const orf = params.get('oldest_ref');
        if (nt) cursor.newest_time = nt;
        if (nr) cursor.newest_ref = nr;
        if (ot) cursor.oldest_time = ot;
        if (orf) cursor.oldest_ref = orf;
        return Object.keys(cursor).length ? cursor : null;
      } catch { return null; }
    };

    const links = Array.isArray(txData?.links) ? txData.links : [];
    let nextCursor = null;
    let prevCursor = null;
    for (const link of links) {
      const rel = String(link?.rel || '').toLowerCase();
      const href = link?.href;
      if (!href) continue;
      if (!nextCursor && rel.includes('next')) nextCursor = pickCursor(href);
      if (!prevCursor && (rel.includes('prev') || rel.includes('previous'))) prevCursor = pickCursor(href);
    }

    return c.json({
      success: true,
      query: { order, limit, statuses, types, paymentTypes, users, changesSince: changesSince || null, newestTime: newestTime || null, newestRef: newestRef || null, oldestTime: oldestTime || null, oldestRef: oldestRef || null },
      total: filteredByDate.length,
      hasMore: links.length > 0,
      cursors: { next: nextCursor, prev: prevCursor },
      items: filteredByDate,
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

sumup.get('/api/sumup/payouts-summary', requireAuth, async (c) => {
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const now = new Date();
    const requestedStartDate = c.req.query('start_date') || FINANCIAL_CUTOFF_DATE;
    const startDate = requestedStartDate < FINANCIAL_CUTOFF_DATE ? FINANCIAL_CUTOFF_DATE : requestedStartDate;
    const endDate = c.req.query('end_date') || now.toISOString().slice(0, 10);

    const client = new SumUp({ apiKey: token });
    const payouts = (await client.payouts.list(merchantCode, { start_date: startDate, end_date: endDate, order: 'desc', limit: 100 })) as Array<Record<string, unknown>>;
    const list = Array.isArray(payouts) ? payouts : [];

    let totalAmount = 0;
    let totalFee = 0;
    const byStatus: Record<string, number> = {};
    for (const p of list) {
      totalAmount += Number(p?.amount || 0);
      totalFee += Number(p?.fee || 0);
      const status = String(p?.status || 'UNKNOWN').toUpperCase();
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return c.json({ success: true, startDate, endDate, count: list.length, totalAmount, totalFee, byStatus });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default sumup;
