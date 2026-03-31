/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rate limiter baseado em D1 para o mainsite-motor.
 * Ported 1:1 do monolito, com tipagem estrita.
 */
import type { Env } from '../env.ts';

export interface RateLimitConfig {
  routes: Record<string, { maxRequests: number; windowMinutes: number }>;
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  routes: {
    chat: { maxRequests: 10, windowMinutes: 60 },
    summarize: { maxRequests: 5, windowMinutes: 30 },
    translate: { maxRequests: 5, windowMinutes: 30 },
    contact: { maxRequests: 5, windowMinutes: 30 },
  },
};

/**
 * Normaliza a configuração de rate limit, preenchendo rotas ausentes com defaults.
 */
export const normalizeRateLimitConfig = (
  config: Partial<RateLimitConfig>
): RateLimitConfig => {
  const routes = { ...DEFAULT_RATE_LIMIT.routes };
  if (config?.routes) {
    for (const [key, value] of Object.entries(config.routes)) {
      if (value && typeof value.maxRequests === 'number' && typeof value.windowMinutes === 'number') {
        routes[key] = value;
      }
    }
  }
  return { routes };
};

/**
 * Carrega a configuração de rate limit do D1 ou retorna default.
 */
export const loadRateLimitConfig = async (db: D1Database): Promise<RateLimitConfig> => {
  try {
    const record = await db
      .prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'")
      .first<{ payload: string }>();
    if (record) return normalizeRateLimitConfig(JSON.parse(record.payload));
  } catch {
    // fallback silencioso ao default
  }
  return DEFAULT_RATE_LIMIT;
};

/**
 * Verifica rate limit para uma rota específica.
 * Retorna `true` se o request deve ser **bloqueado**.
 */
export const checkRateLimit = async (
  db: D1Database,
  routeKey: string,
  ip: string,
  config: RateLimitConfig
): Promise<boolean> => {
  const routeConfig = config.routes[routeKey];
  if (!routeConfig) return false; // Rota sem rate limit = permitir

  const windowMs = routeConfig.windowMinutes * 60 * 1000;
  const since = new Date(Date.now() - windowMs).toISOString().slice(0, 19).replace('T', ' ');

  try {
    const result = await db
      .prepare(
        "SELECT COUNT(*) as cnt FROM mainsite_rate_limit WHERE route = ? AND ip = ? AND datetime(created_at) >= datetime(?)"
      )
      .bind(routeKey, ip, since)
      .first<{ cnt: number }>();

    return (result?.cnt ?? 0) >= routeConfig.maxRequests;
  } catch {
    return false; // Em caso de erro D1, não bloqueia (fail-open)
  }
};

/**
 * Registra um hit de rate limit.
 */
export const recordRateLimitHit = async (
  db: D1Database,
  routeKey: string,
  ip: string
): Promise<void> => {
  try {
    await db
      .prepare(
        'INSERT INTO mainsite_rate_limit (route, ip) VALUES (?, ?)'
      )
      .bind(routeKey, ip)
      .run();
  } catch {
    // Non-blocking
  }
};
