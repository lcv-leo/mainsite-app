/**
 * Rotas de Upload para Cloudflare R2.
 * Domínio: /api/upload, /api/uploads/*
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';

const uploads = new Hono<{ Bindings: Env }>();

// POST /api/upload (admin)
uploads.post('/api/upload', requireAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File | undefined;
    if (!file) throw new Error('Nenhum arquivo submetido.');
    const extension = file.name.split('.').pop();
    const uniqueName = `${crypto.randomUUID()}.${extension}`;
    await c.env.BUCKET.put(uniqueName, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    const url = new URL(c.req.url);
    return c.json({ success: true, url: `${url.origin}/api/uploads/${uniqueName}` }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/uploads/:filename (público)
uploads.get('/api/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');
  try {
    const object = await c.env.BUCKET.get(filename);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', 'https://www.lcv.rio.br');
    return new Response(object.body, { headers });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/uploads/brands/:filename (público)
uploads.get('/api/uploads/brands/:filename', async (c) => {
  const filename = c.req.param('filename');
  try {
    const object = await c.env.BUCKET.get(`brands/${filename}`);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', 'https://www.lcv.rio.br');
    return new Response(object.body, { headers });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default uploads;
