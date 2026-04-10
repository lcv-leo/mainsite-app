/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Context, Next } from 'hono';
import type { Env } from '../env.ts';

/**
 * Comparação constant-time de duas strings.
 * Previne timing attacks ao garantir tempo de execução independente do conteúdo.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compara contra si mesmo para manter tempo constante mesmo com tamanhos diferentes
    const dummy = new TextEncoder().encode(a);
    crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }
  const encoder = new TextEncoder();
  return crypto.subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

/**
 * Middleware de autenticação por Bearer token.
 * Compara o header Authorization com CLOUDFLARE_PW do environment.
 * Usa comparação constant-time para prevenir timing attacks.
 */
export const requireAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const authHeader = c.req.header('Authorization') || '';
  const expected = `Bearer ${c.env.CLOUDFLARE_PW || ''}`;
  if (!c.env.CLOUDFLARE_PW || !timingSafeEqual(authHeader, expected)) {
    return c.json({ error: '401' }, 401);
  }
  await next();
};

let cachedAdminEmail: string | null = null;

/**
 * Reads admin notification email from D1 settings.
 * Returns null if not configured — callers must guard against null.
 * Caches per-isolate.
 */
export async function getAdminEmail(db: D1Database): Promise<string | null> {
  if (cachedAdminEmail) return cachedAdminEmail;
  try {
    const row = await db.prepare(
      "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/admin_email'"
    ).first<{ payload: string }>();
    if (row?.payload) {
      const parsed = JSON.parse(row.payload);
      if (typeof parsed.email === 'string' && parsed.email.includes('@')) {
        cachedAdminEmail = parsed.email;
        return parsed.email;
      }
    }
  } catch { /* continue */ }
  console.warn('[Auth] Admin email not configured in D1 (mainsite/admin_email). Email notifications disabled.');
  return null;
}
