/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * site-status — endpoint público do kill switch de publicação.
 *
 * Consumido pelo mainsite-frontend em cada refresh de conteúdo. Quando
 * mode='hidden', o frontend renderiza a folha em branco do PostReader com
 * o aviso (se preenchido) e nunca chama /api/posts ou /api/posts/:id.
 *
 * Cache-Control: no-store é obrigatório — mudança no admin deve refletir
 * imediatamente no site, sem interferência de CDN ou cache de browser.
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { readPublishing } from '../lib/publishing.ts';

const siteStatus = new Hono<{ Bindings: Env }>();

siteStatus.get('/api/site-status', async (c) => {
  const status = await readPublishing(c.env.DB);
  c.header('Cache-Control', 'no-store');
  return c.json(status);
});

export default siteStatus;
