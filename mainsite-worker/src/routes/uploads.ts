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

// v02.17.00 / mainsite-app audit closure (MEDIUM, was HIGH H5):
// magic-byte validation. Pre-fix the worker trusted only the file
// extension and the client-declared Content-Type. An attacker could
// rename `payload.html` to `image.jpg` with `Content-Type: image/jpeg`
// and bypass both checks. Reading the first bytes of the actual file
// content closes that gap (defense in depth — current downstream is
// `<img>`, so risk was bounded, but the audit recommendation stands).
//
// The signatures below cover every ALLOWED_EXTENSIONS entry. Returns
// the inferred extension, or null on mismatch. We compare against
// the sanitized extension (not the user-claimed Content-Type).
function inferExtensionFromMagicBytes(buffer: ArrayBuffer): string | null {
  const view = new Uint8Array(buffer.slice(0, 16));
  if (view.length < 4) return null;
  // JPEG: FF D8 FF
  if (view[0] === 0xff && view[1] === 0xd8 && view[2] === 0xff) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    view[0] === 0x89 &&
    view[1] === 0x50 &&
    view[2] === 0x4e &&
    view[3] === 0x47 &&
    view[4] === 0x0d &&
    view[5] === 0x0a &&
    view[6] === 0x1a &&
    view[7] === 0x0a
  ) return 'png';
  // GIF: 47 49 46 38 ('GIF8')
  if (view[0] === 0x47 && view[1] === 0x49 && view[2] === 0x46 && view[3] === 0x38) return 'gif';
  // WebP: 52 49 46 46 .. .. .. .. 57 45 42 50 ('RIFF????WEBP')
  if (
    view[0] === 0x52 &&
    view[1] === 0x49 &&
    view[2] === 0x46 &&
    view[3] === 0x46 &&
    view[8] === 0x57 &&
    view[9] === 0x45 &&
    view[10] === 0x42 &&
    view[11] === 0x50
  ) return 'webp';
  // AVIF: ?? ?? ?? ?? 66 74 79 70 (offset 4-7 = 'ftyp'); ftyp brand at 8-11
  // We check 'ftyp' marker + accept 'avif'/'avis'/'heic'/'mif1' brands
  if (view[4] === 0x66 && view[5] === 0x74 && view[6] === 0x79 && view[7] === 0x70) {
    const brand = String.fromCharCode(view[8], view[9], view[10], view[11]);
    if (brand === 'avif' || brand === 'avis' || brand === 'mif1' || brand === 'heic') return 'avif';
  }
  // PDF: 25 50 44 46 ('%PDF')
  if (view[0] === 0x25 && view[1] === 0x50 && view[2] === 0x44 && view[3] === 0x46) return 'pdf';
  return null;
}

function magicMatchesExtension(inferred: string | null, ext: string): boolean {
  if (!inferred) return false;
  // jpg/jpeg are interchangeable; everything else must match exactly.
  if (inferred === 'jpg') return ext === 'jpg' || ext === 'jpeg';
  return inferred === ext;
}

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

    // Content-type validation (client-declared header)
    if (!ALLOWED_CONTENT_TYPES.has(file.type)) {
      return c.json({ error: 'Content-type de arquivo não permitido.' }, 400);
    }

    // v02.17.00 / audit closure: magic-byte validation. Read the actual
    // bytes once and verify the file content matches the sanitized
    // extension. Mismatches (e.g. .jpg with HTML body) are rejected
    // before R2 storage. We reuse the same buffer for the put() below
    // to avoid a second arrayBuffer() materialization.
    const buffer = await file.arrayBuffer();
    const sanitizedExt = safeName.split('.').pop()?.toLowerCase() ?? '';
    const inferredExt = inferExtensionFromMagicBytes(buffer);
    if (!magicMatchesExtension(inferredExt, sanitizedExt)) {
      structuredLog('warn', '[Uploads] Magic-byte mismatch', {
        sanitizedExt,
        inferredExt,
        declaredType: file.type,
      });
      return c.json(
        { error: 'Conteúdo do arquivo não corresponde à extensão declarada.' },
        400,
      );
    }

    await c.env.BUCKET.put(safeName, buffer, {
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
