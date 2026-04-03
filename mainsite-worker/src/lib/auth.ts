/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Context, Next } from 'hono';
import type { Env } from '../env.ts';

/**
 * Middleware de autenticação por Bearer token.
 * Compara o header Authorization com CLOUDFLARE_PW do environment.
 */
export const requireAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.CLOUDFLARE_PW}`) {
    return c.json({ error: '401' }, 401);
  }
  await next();
};
