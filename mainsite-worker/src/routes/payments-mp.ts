/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Pagamento Mercado Pago — Orders API.
 * Domínio: /api/mp*, /api/webhooks/mercadopago
 *
 * - Criação de pagamento: Order.create() com processing_mode "automatic"
 * - Webhook: HMAC-SHA256 validado com x-request-id (formato Orders API)
 * - Notificações: configuradas no painel MP (não via notification_url)
 * - Somente cartão de crédito, sem parcelamento
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

const MIN_PAYMENT_AMOUNT = 1.00;
const MAX_PAYMENT_AMOUNT = 10_000.00;

// ========== PUBLIC PAYMENT (Orders API — credit card only) ==========

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

    const paymentMethodId = (mpPayload as Record<string, unknown>).payment_method_id as string | undefined;
    const cardToken = (mpPayload as Record<string, unknown>).token as string | undefined;
    const payerEmail = payer?.email;
    const payerIdentification = (mpPayload as { payer?: { identification?: { type?: string; number?: string } } }).payer?.identification;

    if (!cardToken) {
      return c.json({ error: 'Token do cartão ausente.' }, 400);
    }

    const client = new MercadoPagoConfig({ accessToken: token });
    const orderApi = new Order(client);

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
          payment_method: {
            id: paymentMethodId,
            type: 'credit_card',
            token: cardToken,
            installments: 1,
            statement_descriptor: 'REFLEXOS ALMA',
          },
        }],
      },
      items: [{
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

    const cache = new Set();
    const safeData = JSON.parse(JSON.stringify(data, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (cache.has(value)) return undefined;
        cache.add(value);
      }
      if (key === 'api_response' || key === 'request' || key === 'response' || key === 'config') return undefined;
      return value;
    }));

    const orderData = data as unknown as Record<string, unknown>;
    const txPayments = (orderData.transactions as { payments?: Array<Record<string, unknown>> })?.payments;
    const payment = txPayments?.[0] || {};

    return c.json({
      ...safeData,
      id: orderData.id,
      status: orderData.status,
      status_detail: orderData.status_detail,
      transaction_amount: transactionAmount,
      external_reference: extRef,
      payment_id: payment.id,
      payment_status: payment.status,
      payment_status_detail: payment.status_detail,
    }, 201);
  } catch (err) {
    const errObj = err as Record<string, unknown>;
    if (errObj?.data && typeof errObj.data === 'object') {
      const orderData = errObj.data as Record<string, unknown>;
      structuredLog('warn', 'MP Order rejected', {
        orderId: orderData.id,
        status: orderData.status,
        statusDetail: orderData.status_detail,
      });
      return c.json({
        ...orderData,
        id: orderData.id,
        status: orderData.status,
        status_detail: orderData.status_detail,
      }, 201);
    }

    structuredLog('error', 'MP Order Error', { err: JSON.stringify(err) });
    return c.json({ error: 'Falha ao processar pagamento. Tente novamente.' }, 500);
  }
});

// ========== WEBHOOK (Orders API — HMAC-SHA256 with x-request-id) ==========
// Notifications configured in MP developer panel (not via notification_url).
// Orders API sends type: "order" with actions like order.action_required, order.processed.
// data.id is an Order ID (ORD...) and must be lowercased for HMAC validation.

mp.post('/api/webhooks/mercadopago', async (c) => {
  const signature = c.req.header('x-signature');
  const requestId = c.req.header('x-request-id') || '';
  const body = (await c.req.json()) as Record<string, unknown>;

  if (!signature) {
    structuredLog('warn', 'Webhook without x-signature', {
      ip: c.req.header('cf-connecting-ip'),
    });
    return c.json({ error: 'Missing x-signature' }, 401);
  }

  const webhookSecret = c.env.MERCADO_PAGO_WEBHOOK_SECRET;
  if (!webhookSecret) {
    structuredLog('error', 'MERCADO_PAGO_WEBHOOK_SECRET not configured');
    return c.text('OK', 200);
  }

  // Extract ts from x-signature for timestamp validation
  const tsPart = signature.split(',').find((p) => p.trim().startsWith('ts='));
  const ts = tsPart?.split('=')[1]?.trim() || '';

  const isValid = await validateMercadoPagoSignatureAsync(body, signature, ts, webhookSecret, requestId);
  if (!isValid) {
    structuredLog('warn', 'Webhook HMAC validation failed', {
      ip: c.req.header('cf-connecting-ip'),
      signatureStart: signature.substring(0, 30),
    });
    return c.json({ error: 'Invalid signature' }, 401);
  }

  try {
    const action = (body as { action?: string }).action || '';
    const type = (body as { type?: string }).type || '';
    const dataId = (body as { data?: { id?: string } }).data?.id || '';

    structuredLog('info', '[MP Webhook] Notification received', { action, type, dataId });

    // ACK — orders API notifications are informational
    // The admin panel queries orders directly via the SDK
    if (type === 'order' && dataId) {
      const token = c.env.MP_ACCESS_TOKEN;
      if (token) {
        try {
          const client = new MercadoPagoConfig({ accessToken: token });
          const orderApi = new Order(client);
          const order = await orderApi.get({ id: dataId });
          structuredLog('info', '[MP Webhook] Order fetched', {
            orderId: (order as unknown as Record<string, unknown>).id,
            status: (order as unknown as Record<string, unknown>).status,
          });
        } catch {
          structuredLog('warn', `[MP Webhook] Failed to fetch order ${dataId}`);
        }
      }
    }

    return c.text('OK', 200);
  } catch {
    return c.text('OK', 200);
  }
});

// ========== ADMIN: PAYMENT METHODS / SUMMARY / ADVANCED ==========

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
    const begin_date = getStartIsoWithCutoff(c.req.query('begin_date') || c.req.query('start_date'));
    const end_date = c.req.query('end_date') ? new Date(c.req.query('end_date')!).toISOString() : new Date().toISOString();

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
      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      totalAmount += Number(tx?.transaction_amount || 0);
      totalNetAmount += Number((tx?.transaction_details as Record<string, unknown>)?.net_received_amount || 0);
    }

    return c.json({
      success: true, scanned: items.length, limit, totalAmount, totalNetAmount, byStatus, byType,
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

    const parseList = (v: string | undefined) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const offsetRaw = Number(c.req.query('offset'));
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';
    const statuses = parseList(c.req.query('statuses'));
    const types = parseList(c.req.query('types'));
    const begin_date = getStartIsoWithCutoff(c.req.query('begin_date') || c.req.query('start_date'));
    const end_date = c.req.query('end_date') ? new Date(c.req.query('end_date')!).toISOString() : new Date().toISOString();

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

    return c.json({
      success: true,
      query: { order, limit, offset, statuses, types },
      paging: { total: totalRaw, limit, offset, hasPrev: offset > 0, hasNext: (offset + limit) < totalRaw,
        prevOffset: offset > 0 ? Math.max(0, offset - limit) : null, nextOffset: (offset + limit) < totalRaw ? offset + limit : null },
      scanned: normalized.length, totalFiltered: filtered.length, items: filtered,
    });
  } catch (err) {
    structuredLog('error', '[MP] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default mp;
