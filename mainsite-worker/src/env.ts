/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Tipagem estrita de bindings do Cloudflare Worker (mainsite-motor).
 * Todos os módulos de rota importam este tipo via `Env`.
 */
export interface Env {
  // --- D1 Database ---
  DB: D1Database;

  // --- R2 Bucket ---
  BUCKET: R2Bucket;

  // --- Rate Limiting (native Cloudflare binding) ---
  RL_CHATBOT: RateLimit;
  RL_EMAIL: RateLimit;

  // --- Secrets & Tokens ---
  API_SECRET: string;
  GEMINI_API_KEY: string;
  RESEND_API_KEY: string;

  // --- SumUp ---
  SUMUP_API_KEY_PRIVATE: string;
  SUMUP_MERCHANT_CODE: string;

  // --- Mercado Pago ---
  MP_ACCESS_TOKEN: string;
  MERCADO_PAGO_WEBHOOK_SECRET: string;

  // --- PIX ---
  PIX_KEY: string;
  PIX_NAME?: string;
  PIX_CITY?: string;
}
