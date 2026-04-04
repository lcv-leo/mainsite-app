/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Tipagem estrita de bindings do Cloudflare Worker (mainsite-motor).
 * Todos os módulos de rota importam este tipo via `Env`.
 *
 * Secret Store bindings retornam um objeto Fetcher com método `.get()`.
 * O middleware resolver em index.ts converte esses para strings antes
 * dos handlers executarem.
 */

/** Cloudflare Secret Store binding — valor acessado via `.get()` */
interface SecretStoreBinding {
  get(): Promise<string>;
}

/**
 * Raw bindings como recebidos do Cloudflare runtime.
 * Secrets do Secret Store são SecretStoreBinding (precisa `.get()`).
 */
export interface RawEnv {
  // --- D1 Database ---
  DB: D1Database;

  // --- R2 Bucket ---
  BUCKET: R2Bucket;

  // --- Workers AI ---
  AI: any;

  // --- Rate Limiting (native Cloudflare binding) ---
  RL_CHATBOT: RateLimit;
  RL_EMAIL: RateLimit;

  // --- Secrets & Tokens (Secret Store → .get()) ---
  CLOUDFLARE_PW: SecretStoreBinding;
  GEMINI_API_KEY: SecretStoreBinding;
  RESEND_API_KEY: SecretStoreBinding;

  // --- SumUp ---
  SUMUP_API_KEY_PRIVATE: SecretStoreBinding;
  SUMUP_MERCHANT_CODE: SecretStoreBinding;

  // --- Mercado Pago ---
  MP_ACCESS_TOKEN: SecretStoreBinding;
  MERCADO_PAGO_WEBHOOK_SECRET: SecretStoreBinding;

  // --- PIX ---
  PIX_KEY: SecretStoreBinding;
  PIX_NAME: SecretStoreBinding;
  PIX_CITY: SecretStoreBinding;
}

/**
 * Env pós-middleware — todos os secrets já resolvidos para string.
 * Handlers usam esta interface via `c.env`.
 */
export interface Env {
  // --- D1 Database ---
  DB: D1Database;

  // --- R2 Bucket ---
  BUCKET: R2Bucket;

  // --- Workers AI ---
  AI: any;

  // --- Rate Limiting (native Cloudflare binding) ---
  RL_CHATBOT: RateLimit;
  RL_EMAIL: RateLimit;

  // --- Secrets & Tokens (resolved to string by middleware) ---
  CLOUDFLARE_PW: string;
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
  PIX_NAME: string;
  PIX_CITY: string;
}
