/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Pagamento Mercado Pago — Orders API (nova geração).
 * Zero Trust: HMAC-SHA256 webhook validation, Bearer auth em rotas admin.
 * Domínio: /api/mp*, /api/webhooks/mercadopago
 *
 * Migração da Payments API → Orders API conforme aviso de descontinuação.
 * A Orders API usa `Order.create()` com processing_mode: "automatic".
 */
import { Hono } from 'hono';
import { MercadoPagoConfig, Order, Payment, PaymentMethod } from 'mercadopago';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { structuredLog } from '../lib/logger.ts';
import {
  validateMercadoPagoSignatureAsync,
  getStartIsoWithCutoff,
  loadFeeConfig,
} from '../lib/financial.ts';

const mp = new Hono<{ Bindings: Env }>();

// Payment amount bounds (BRL)
const MIN_PAYMENT_AMOUNT = 1.00;
const MAX_PAYMENT_AMOUNT = 10_000.00;

// ========== PUBLIC PAYMENT (Orders API) ==========

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
    }

    // Validate payment amount bounds
    if (!Number.isFinite(transactionAmount) || transactionAmount < MIN_PAYMENT_AMOUNT || transactionAmount > MAX_PAYMENT_AMOUNT) {
      return c.json({ error: `Valor deve ser entre R$${MIN_PAYMENT_AMOUNT} e R$${MAX_PAYMENT_AMOUNT}.` }, 400);
    }

    const payer = (mpPayload as Record<string, Record<string, string>>).payer;
    const realFirstName = payer?.first_name;
    const realLastName = payer?.last_name;

    if (!realFirstName || !realLastName) {
      return c.json({ error: 'Nome e sobrenome reais são obrigatórios para validação antifraude.' }, 400);
    }

    const donorFullName = `${realFirstName} ${realLastName}`.trim();
    const donationDescriptor = `Doação de ${donorFullName} - Reflexos da Alma`;
    const extRef = `DON-${crypto.randomUUID()}`;

    // Extract payment method info from legacy payload
    const paymentMethodId = (mpPayload as Record<string, unknown>).payment_method_id as string | undefined;
    const cardToken = (mpPayload as Record<string, unknown>).token as string | undefined;
    const installments = Number((mpPayload as Record<string, unknown>).installments) || 1;
    const payerEmail = payer?.email;
    const payerIdentification = (mpPayload as { payer?: { identification?: { type?: string; number?: string } } }).payer?.identification;

    // Build Orders API request
    const client = new MercadoPagoConfig({ accessToken: token });
    const orderApi = new Order(client);

    const paymentMethod: Record<string, unknown> = {};
    if (paymentMethodId) paymentMethod.id = paymentMethodId;
    if (cardToken) paymentMethod.token = cardToken;
    if (installments > 1) paymentMethod.installments = installments;
    paymentMethod.statement_descriptor = 'REFLEXOS ALMA';

    // Determine payment method type from ID
    const pixMethods = ['pix'];
    const boletoMethods = ['bolbradesco', 'boleto'];
    const debitMethods = ['debcabal', 'debvisa', 'debmaster', 'debelo'];
    if (pixMethods.includes(paymentMethodId || '')) {
      paymentMethod.type = 'bank_transfer';
    } else if (boletoMethods.includes(paymentMethodId || '')) {
      paymentMethod.type = 'ticket';
    } else if (debitMethods.includes(paymentMethodId || '')) {
      paymentMethod.type = 'debit_card';
    } else if (paymentMethodId) {
      paymentMethod.type = 'credit_card';
    }

    const orderBody = {
      type: 'online',
      processing_mode: 'automatic',
      external_reference: extRef,
      total_amount: transactionAmount.toFixed(2),
      description: donationDescriptor,
      payer: {
        email: payerEmail,
        first_name: realFirstName,
        last_name: realLastName,
        ...(payerIdentification ? { identification: payerIdentification } : {}),
      },
      transactions: {
        payments: [{
          amount: transactionAmount.toFixed(2),
          payment_method: paymentMethod,
        }],
      },
      items: [{
        id: 'DONATION-01',
        title: donationDescriptor,
        description: donationDescriptor,
        category_id: 'donations',
        quantity: 1,
        unit_price: transactionAmount.toFixed(2),
      }],
    };

    const data = await orderApi.create({
      body: orderBody as Parameters<Order['create']>[0]['body'],
      requestOptions: { idempotencyKey: crypto.randomUUID() },
    });

    // Safe serialize (strip circular refs and internal SDK fields)
    const cache = new Set();
    const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return undefined;
        cache.add(value);
      }
      if (key === 'api_response' || key === 'request' || key === 'response' || key === 'config') return undefined;
      return value;
    }));

    // Map Orders API response to a shape the frontend expects
    const orderData = data as unknown as Record<string, unknown>;
    const txPayments = (orderData.transactions as { payments?: Array<Record<string, unknown>> })?.payments;
    const payment = txPayments?.[0] || {};

    const response = {
      ...safeData,
      // Compatibility fields for existing frontend
      id: orderData.id,
      status: orderData.status,
      status_detail: orderData.status_detail,
      transaction_amount: transactionAmount,
      external_reference: extRef,
      payment_id: payment.id,
      payment_status: payment.status,
      payment_status_detail: payment.status_detail,
    };

    return c.json(response, 201);
  } catch (err) {
    console.error('MercadoPago Order Creation Error:', err);
    structuredLog('error', 'MP Order Error', { err: String(err), stack: (err as Error).stack });
    return c.json({
      error: 'Falha ao processar pagamento. Tente novamente.',
    }, 500);
  }
});

// ========== WEBHOOK (HMAC-SHA256 VALIDATED — Compliance ACK) ==========

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
  const webhookAge = Date.now() - parseInt(timestamp, 10);
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

    structuredLog('info', '[MP Webhook] Payment notification received', { topic, id });
    return c.text('OK', 200);
  } catch {
    return c.text('Erro interno no Webhook', 500);
  }
});

// ========== ADMIN: MP PAYMENT METHODS / SUMMARY / ADVANCED ==========
// Admin endpoints still use Payment.search() as the Orders search API
// uses a different endpoint. These will be migrated when MP provides
// the Orders search documentation.

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
    structuredLog('error', '[MP] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
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
      const txAmount = Number(tx?.transaction_amount || 0);
      const net = Number((tx?.transaction_details as Record<string, unknown>)?.net_received_amount || 0);
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      totalAmount += txAmount;
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
    structuredLog('error', '[MP] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
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
    structuredLog('error', '[MP] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default mp;
