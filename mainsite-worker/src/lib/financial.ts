/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Utilitários financeiros compartilhados (SumUp + Mercado Pago).
 * Extraídos do monolito com paridade total de comportamento.
 */

/**
 * Normaliza status de pagamento SumUp para formato canônico.
 */
export const normalizeSumupStatus = (status: string | undefined | null): string => {
  const s = String(status || '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';

  const map: Record<string, string> = {
    PAID: 'SUCCESSFUL',
    APPROVED: 'SUCCESSFUL',
    SUCCESSFUL: 'SUCCESSFUL',
    PENDING: 'PENDING',
    IN_PROCESS: 'PENDING',
    PROCESSING: 'PENDING',
    FAILED: 'FAILED',
    FAILURE: 'FAILED',
    EXPIRED: 'EXPIRED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    CANCELED: 'CANCELLED',
    CANCEL: 'CANCELLED',
    CANCELLED: 'CANCELLED',
    CHARGEBACK: 'CHARGE_BACK',
    CHARGE_BACK: 'CHARGE_BACK',
  };

  return map[s] || s;
};

/**
 * Resolve o status efetivo de uma transação SumUp a partir de múltiplas fontes.
 * Estados terminais prevalecem sobre snapshots antigos do payload.
 */
export const resolveSumupStatusFromSources = ({
  rowStatus,
  payloadStatus,
}: {
  rowStatus: string;
  payloadStatus: string;
}): string => {
  const row = normalizeSumupStatus(rowStatus || 'UNKNOWN');
  const payload = normalizeSumupStatus(payloadStatus || 'UNKNOWN');

  const terminalPriority = [
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'CANCELLED',
    'CHARGE_BACK',
    'FAILED',
    'EXPIRED',
  ];

  for (const st of terminalPriority) {
    if (row === st || payload === st) return st;
  }

  if (row === 'SUCCESSFUL' || payload === 'SUCCESSFUL') return 'SUCCESSFUL';
  if (row === 'PENDING' || payload === 'PENDING') return 'PENDING';
  return row !== 'UNKNOWN' ? row : payload;
};

// --- Financial Cutoff Constants ---
export const FINANCIAL_CUTOFF_BRT = '2026-03-01T00:00:00-03:00';
export const FINANCIAL_CUTOFF_DATE = '2026-03-01';
export const FINANCIAL_CUTOFF_UTC = new Date(FINANCIAL_CUTOFF_BRT);
export const FINANCIAL_CUTOFF_ISO = FINANCIAL_CUTOFF_UTC.toISOString();
export const FINANCIAL_CUTOFF_DB_UTC = FINANCIAL_CUTOFF_ISO.slice(0, 19).replace('T', ' ');

export const getStartIsoWithCutoff = (rawDate?: string | null): string => {
  if (!rawDate) return FINANCIAL_CUTOFF_ISO;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return FINANCIAL_CUTOFF_ISO;
  return parsed.getTime() < FINANCIAL_CUTOFF_UTC.getTime()
    ? FINANCIAL_CUTOFF_ISO
    : parsed.toISOString();
};

export const toDbDateTime = (isoString: string): string =>
  isoString.slice(0, 19).replace('T', ' ');

export const getStartDbWithCutoff = (rawDate?: string | null): string =>
  toDbDateTime(getStartIsoWithCutoff(rawDate));

export const isOnOrAfterCutoff = (value?: string | null): boolean => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= FINANCIAL_CUTOFF_UTC.getTime();
};

/**
 * Constantes de taxa dos gateways de pagamento (fallback).
 * Valores usados quando a configuração dinâmica do D1 não está disponível.
 */
export const SUMUP_FEE_RATE = 0.0267;
export const SUMUP_FEE_FIXED = 0;
export const MP_FEE_RATE = 0.0499;
export const MP_FEE_FIXED = 0.40;

/** Estrutura da configuração de taxas armazenada no D1. */
export interface FeeConfig {
  sumupRate: number;
  sumupFixed: number;
  mpRate: number;
  mpFixed: number;
}

const DEFAULT_FEE_CONFIG: FeeConfig = {
  sumupRate: SUMUP_FEE_RATE,
  sumupFixed: SUMUP_FEE_FIXED,
  mpRate: MP_FEE_RATE,
  mpFixed: MP_FEE_FIXED,
};

/**
 * Carrega taxas dinâmicas do D1 (`mainsite_settings` key `mainsite/fees`).
 * Retorna fallback hardcoded se D1 falhar ou se o registro não existir.
 */
export const loadFeeConfig = async (db: D1Database): Promise<FeeConfig> => {
  try {
    const row = await db.prepare('SELECT payload FROM mainsite_settings WHERE id = ? LIMIT 1')
      .bind('mainsite/fees')
      .first<{ payload?: string }>();

    if (!row?.payload) return DEFAULT_FEE_CONFIG;

    const parsed = JSON.parse(row.payload) as Partial<FeeConfig>;
    return {
      sumupRate: typeof parsed.sumupRate === 'number' ? parsed.sumupRate : SUMUP_FEE_RATE,
      sumupFixed: typeof parsed.sumupFixed === 'number' ? parsed.sumupFixed : SUMUP_FEE_FIXED,
      mpRate: typeof parsed.mpRate === 'number' ? parsed.mpRate : MP_FEE_RATE,
      mpFixed: typeof parsed.mpFixed === 'number' ? parsed.mpFixed : MP_FEE_FIXED,
    };
  } catch {
    // D1 indisponível — usa fallback hardcoded sem interromper o checkout
    return DEFAULT_FEE_CONFIG;
  }
};

/**
 * Calcula o valor final com cobertura de taxa.
 */
export const calculateWithFeeCoverage = (
  baseAmount: number,
  feeRate: number,
  feeFixed: number,
  coverFees: boolean
): number => {
  if (!coverFees) return baseAmount;
  return parseFloat(((baseAmount + feeFixed) / (1 - feeRate)).toFixed(2));
};

/**
 * Validação assíncrona de assinatura HMAC-SHA256 do Mercado Pago.
 */
export const validateMercadoPagoSignatureAsync = async (
  body: Record<string, unknown>,
  signature: string,
  timestamp: string,
  secret: string
): Promise<boolean> => {
  try {
    const signatureParts: Record<string, string> = {};
    signature.split(',').forEach((part) => {
      const [key, value] = part.split('=');
      if (key && value) signatureParts[key.trim()] = value.trim();
    });

    const ts = signatureParts['ts'];
    const v1 = signatureParts['v1'];
    if (!ts || !v1) return false;

    const dataId = String((body as Record<string, { id?: string }>)?.data?.id || '');
    const manifest = `id:${dataId};request-id:;ts:${ts};`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(manifest)
    );
    const computed = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison para prevenir timing attacks na validação HMAC
    if (computed.length !== v1.length) return false;
    const encoder = new TextEncoder();
    return crypto.subtle.timingSafeEqual(encoder.encode(computed), encoder.encode(v1));
  } catch {
    return false;
  }
};
