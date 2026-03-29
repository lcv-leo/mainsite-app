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
  try {
    const { amount: amountStr } = (await c.req.json()) as { amount?: string };
    const key = c.env.PIX_KEY;
    const name = c.env.PIX_NAME || 'LEONARDO VARGAS';
    const city = c.env.PIX_CITY || 'RIO DE JANEIRO';

    if (!key) return c.json({ error: 'PIX_KEY não configurada no Worker.' }, 503);

    const amount = String(amountStr || '0,00').replace(/\./g, '').replace(',', '.');

    const formatField = (id: string, value: string) => {
      const len = value.length.toString().padStart(2, '0');
      return `${id}${len}${value}`;
    };

    let payload = '';
    payload += formatField('00', '01');
    const merchantAccountInfo = formatField('00', 'BR.GOV.BCB.PIX') + formatField('01', key);
    payload += formatField('26', merchantAccountInfo);
    payload += formatField('52', '0000');
    payload += formatField('53', '986');
    if (parseFloat(amount) > 0) payload += formatField('54', amount);
    payload += formatField('58', 'BR');
    payload += formatField('59', name);
    payload += formatField('60', city);
    payload += formatField('62', formatField('05', '***'));
    payload += '6304';

    // CRC16-CCITT
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i++) {
      crc ^= payload.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
        else crc = crc << 1;
      }
    }
    const crcHex = (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');

    return c.json({ success: true, payload: payload + crcHex });
  } catch (err) {
    structuredLog('error', 'PIX generate error', { error: (err as Error).message });
    return c.json({ error: (err as Error).message }, 500);
  }
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
