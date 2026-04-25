/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Upload para Cloudflare R2.
 * Domínio: /api/upload, /api/uploads/*
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { structuredLog } from '../lib/logger.ts';
import { getAllowedOrigin } from '../lib/origins.ts';

const uploads = new Hono<{ Bindings: Env }>();

// --- Upload Security Constants ---
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'pdf']);
const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Sanitize filename to prevent path traversal.
 * Only allows alphanumeric, hyphens, underscores, and a single dot before extension.
 */
function sanitizeFilename(filename: string): string | null {
  // Remove path separators and null bytes
  const base =
    filename
      .replace(/[\\/\0]/g, '')
      .split('/')
      .pop()
      ?.split('\\')
      .pop() || '';
  if (!base || base.startsWith('.')) return null;
  // Only keep the final segment after any remaining dots (except extension dot)
  const parts = base.split('.');
  if (parts.length < 2) return null;
  const ext = (parts.pop() || '').toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) return null;
  return `${crypto.randomUUID()}.${ext}`;
}

// POST /api/upload (admin)
uploads.post('/api/upload', requireAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'] as File | undefined;
    if (!file) throw new Error('Nenhum arquivo submetido.');

    // Size validation
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `Arquivo excede o limite de ${MAX_FILE_SIZE / (1024 * 1024)}MB.` }, 413);
    }

    // Extension validation
    const safeName = sanitizeFilename(file.name);
    if (!safeName) {
      return c.json({ error: 'Tipo de arquivo não permitido. Use: jpg, png, gif, webp, avif, pdf.' }, 400);
    }

    // Content-type validation
    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return c.json({ error: 'Content-type de arquivo não permitido.' }, 400);
    }

    await c.env.BUCKET.put(safeName, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });
    const url = new URL(c.req.url);
    return c.json({ success: true, url: `${url.origin}/api/uploads/${safeName}` }, 201);
  } catch (err) {
    structuredLog('error', '[Uploads] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

/**
 * Validate filename param for path traversal on GET routes.
 * Returns null if the filename is unsafe.
 */
function validateGetFilename(filename: string): string | null {
  if (!filename) return null;
  // Block path traversal sequences and null bytes
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    return null;
  }
  return filename;
}

function applyPublicAssetHeaders(headers: Headers, origin: string | undefined) {
  headers.set('X-Content-Type-Options', 'nosniff');
  const allowedOrigin = getAllowedOrigin(origin);
  if (allowedOrigin) {
    headers.set('Access-Control-Allow-Origin', allowedOrigin);
    headers.set('Vary', 'Origin');
  }
}

function applySvgSafetyHeaders(filename: string, headers: Headers) {
  const contentType = headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
  if (contentType !== 'image/svg+xml' && !filename.toLowerCase().endsWith('.svg')) return;

  headers.set('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  headers.set('X-Content-Type-Options', 'nosniff');
}

// GET /api/uploads/:filename (público)
uploads.get('/api/uploads/:filename', async (c) => {
  const filename = validateGetFilename(c.req.param('filename'));
  if (!filename) return c.text('Nome de arquivo inválido.', 400);
  try {
    const object = await c.env.BUCKET.get(filename);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    applyPublicAssetHeaders(headers, c.req.header('origin'));
    applySvgSafetyHeaders(filename, headers);
    return new Response(object.body, { headers });
  } catch (err) {
    structuredLog('error', '[Uploads] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// GET /api/uploads/brands/:filename (público)
uploads.get('/api/uploads/brands/:filename', async (c) => {
  const filename = validateGetFilename(c.req.param('filename'));
  if (!filename) return c.text('Nome de arquivo inválido.', 400);
  try {
    const object = await c.env.BUCKET.get(`brands/${filename}`);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    applyPublicAssetHeaders(headers, c.req.header('origin'));
    applySvgSafetyHeaders(filename, headers);
    return new Response(object.body, { headers });
  } catch (err) {
    structuredLog('error', '[Uploads] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// GET /api/media/:filename (público — migrado de Pages Function)
uploads.get('/api/media/:filename', async (c) => {
  const filename = validateGetFilename(c.req.param('filename'));
  if (!filename) return c.text('Nome de arquivo inválido.', 400);
  try {
    const object = await c.env.BUCKET.get(filename);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    applyPublicAssetHeaders(headers, c.req.header('origin'));
    applySvgSafetyHeaders(filename, headers);
    return new Response(object.body, { headers });
  } catch (err) {
    structuredLog('error', '[Uploads] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// GET /api/mainsite/media/:filename (público — migrado de Pages Function)
uploads.get('/api/mainsite/media/:filename', async (c) => {
  const filename = validateGetFilename(c.req.param('filename'));
  if (!filename) return c.text('Nome de arquivo inválido.', 400);
  try {
    const object = await c.env.BUCKET.get(filename);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    applyPublicAssetHeaders(headers, c.req.header('origin'));
    applySvgSafetyHeaders(filename, headers);
    return new Response(object.body, { headers });
  } catch (err) {
    structuredLog('error', '[Uploads] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default uploads;
