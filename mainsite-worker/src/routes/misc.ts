/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de PIX e SEO Sitemap.
 * Domínio: /api/pix/*, /api/sitemap.xml
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { structuredLog } from '../lib/logger.ts';

const misc = new Hono<{ Bindings: Env }>();

// POST /api/pix/generate (público)
misc.post('/api/pix/generate', async (c) => {
  return c.json({ error: 'Funcionalidade PIX temporariamente inativa.' }, 503);
});

// GET /api/sitemap.xml (público)
misc.get('/api/sitemap.xml', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, created_at FROM mainsite_posts ORDER BY created_at DESC'
    ).all();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    xml += `\n  <url>\n    <loc>https://www.lcv.rio.br/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;
    (results || []).forEach((post) => {
      const p = post as { id: string; created_at: string };
      const dateIso = new Date(p.created_at.replace(' ', 'T') + 'Z').toISOString().split('T')[0];
      xml += `\n  <url>\n    <loc>https://www.lcv.rio.br/?p=${p.id}</loc>\n    <lastmod>${dateIso}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    });
    xml += `\n</urlset>`;
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
    });
  } catch {
    return c.text('Erro ao gerar sitemap', 500);
  }
});

export default misc;
