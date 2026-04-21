/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Posts (CRUD público + admin).
 * Domínio: /api/posts/*
 *
 * Hooks:
 * - POST e PUT disparam geração automática de resumo IA para compartilhamento
 *   social via waitUntil (fire-and-forget, zero impacto no response time).
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { bumpContentVersion } from '../lib/content-version.ts';
import { generateShareSummary, hashContent, stripHtml } from '../lib/gemini.ts';
import { postUrl as buildPostUrl, pingIndexNow } from '../lib/indexnow.ts';
import { structuredLog } from '../lib/logger.ts';
import { readPublishingMode } from '../lib/publishing.ts';
import { sanitizePostHtml } from '../lib/sanitize.ts';
import { PostBodySchema, PostReorderSchema } from '../lib/schemas.ts';

const posts = new Hono<{ Bindings: Env }>();
const PUBLIC_POST_EXCERPT_LENGTH = 360;

type PublicPostRow = {
  id: number;
  title: string;
  content: string;
  author?: string;
  created_at: string;
  updated_at?: string;
  is_pinned: number;
  display_order?: number;
};

function toPublicExcerpt(content: string): string {
  const clean = stripHtml(String(content || ''))
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  return clean.length > PUBLIC_POST_EXCERPT_LENGTH
    ? `${clean.slice(0, PUBLIC_POST_EXCERPT_LENGTH).trimEnd()}...`
    : clean;
}

// ========== SUMMARY GENERATION HELPER ==========

/**
 * Gera (ou regenera) o resumo IA para compartilhamento social.
 * - Cria tabela automaticamente se não existir (idempotente).
 * - Compara hash do conteúdo para evitar regenerações desnecessárias.
 * - Respeita overrides manuais (is_manual = 1): não sobrescreve.
 */
async function triggerSummaryGeneration(
  db: D1Database,
  postId: string | number,
  title: string,
  content: string,
  env: Env,
): Promise<void> {
  try {
    // Auto-migração
    await db
      .prepare(`
      CREATE TABLE IF NOT EXISTS mainsite_post_ai_summaries (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id      INTEGER NOT NULL UNIQUE,
        summary_og   TEXT NOT NULL,
        summary_ld   TEXT,
        content_hash TEXT NOT NULL,
        model        TEXT DEFAULT '',
        is_manual    INTEGER DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)
      .run();

    const cleanContent = stripHtml(content);
    const newHash = await hashContent(cleanContent);

    // Verifica se já existe resumo com mesmo hash ou override manual
    const existing = await db
      .prepare('SELECT content_hash, is_manual FROM mainsite_post_ai_summaries WHERE post_id = ?')
      .bind(postId)
      .first<{ content_hash: string; is_manual: number }>();

    if (existing) {
      // Manual override: não sobrescrever
      if (existing.is_manual === 1) {
        structuredLog('info', 'Share summary skipped (manual override)', { postId });
        return;
      }
      // Hash idêntico: conteúdo não mudou
      if (existing.content_hash === newHash) {
        structuredLog('info', 'Share summary skipped (content unchanged)', { postId });
        return;
      }
    }

    // Gera via Gemini
    const result = await generateShareSummary(db, title, content, env);
    if (!result) {
      structuredLog('warn', 'Share summary generation returned null', { postId });
      return;
    }

    await db
      .prepare(`
      INSERT INTO mainsite_post_ai_summaries (post_id, summary_og, summary_ld, content_hash, is_manual, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(post_id) DO UPDATE SET
        summary_og = excluded.summary_og,
        summary_ld = excluded.summary_ld,
        content_hash = excluded.content_hash,
        is_manual = 0,
        model = '',
        updated_at = CURRENT_TIMESTAMP
    `)
      .bind(postId, result.summary_og, result.summary_ld, newHash)
      .run();

    structuredLog('info', 'Share summary generated successfully', {
      postId,
      ogLength: result.summary_og.length,
      ldLength: result.summary_ld.length,
    });
  } catch (err) {
    structuredLog('error', 'Share summary generation failed', {
      postId,
      error: (err as Error).message,
    });
  }
}

// ========== ROTAS ==========

// GET /api/posts (público) — filtra por is_published=1 e retorna [] em modo hidden.
posts.get('/api/posts', async (c) => {
  try {
    const mode = await readPublishingMode(c.env.DB);
    if (mode === 'hidden') {
      c.header('Cache-Control', 'no-store');
      return c.json([]);
    }
    const { results } = await c.env.DB.prepare(
      `SELECT id, title, substr(content, 1, 8000) AS content, author, created_at, updated_at, is_pinned, display_order
       FROM mainsite_posts
       WHERE is_published = 1
       ORDER BY is_pinned DESC, display_order ASC, created_at DESC`,
    ).all<PublicPostRow>();
    const publicPosts = (results || []).map((post) => {
      const excerpt = toPublicExcerpt(post.content);
      return {
        ...post,
        content: excerpt,
        excerpt,
      };
    });
    return c.json(publicPosts);
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// GET /api/posts/:id (público) — 404 quando hidden global OU is_published=0.
posts.get('/api/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const mode = await readPublishingMode(c.env.DB);
    if (mode === 'hidden') {
      c.header('Cache-Control', 'no-store');
      return c.json({ error: 'Post não encontrado' }, 404);
    }
    const post = await c.env.DB.prepare('SELECT * FROM mainsite_posts WHERE id = ? AND is_published = 1')
      .bind(id)
      .first();
    if (!post) return c.json({ error: 'Post não encontrado' }, 404);
    return c.json(post);
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// POST /api/posts (admin)
posts.post('/api/posts', requireAuth, async (c) => {
  try {
    const postParse = PostBodySchema.safeParse(await c.req.json());
    if (!postParse.success) return c.json({ error: 'Dados inválidos.' }, 400);
    const { title, author } = postParse.data;
    const content = sanitizePostHtml(postParse.data.content || '');
    const authorVal = (author || '').trim() || 'Leonardo Cardozo Vargas';
    const result = await c.env.DB.prepare(
      'INSERT INTO mainsite_posts (title, content, author, is_pinned, display_order) VALUES (?, ?, ?, 0, 0)',
    )
      .bind(title, content, authorVal)
      .run();

    // Fire-and-forget: gerar resumo IA para compartilhamento
    const geminiKey = c.env.GEMINI_API_KEY;
    if (geminiKey && title && content && result.meta?.last_row_id) {
      c.executionCtx.waitUntil(triggerSummaryGeneration(c.env.DB, result.meta.last_row_id, title, content, c.env));
    }

    // Sinaliza mudança para o polling de content-fingerprint
    c.executionCtx.waitUntil(bumpContentVersion(c.env.DB));

    // Notifica IndexNow (Bing/Yandex/Seznam/Naver/Yep) — fire-and-forget
    if (result.meta?.last_row_id) {
      c.executionCtx.waitUntil(pingIndexNow([buildPostUrl(result.meta.last_row_id)]));
    }

    return c.json({ success: true }, 201);
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// PUT /api/posts/:id (admin)
posts.put('/api/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const postParse = PostBodySchema.safeParse(await c.req.json());
    if (!postParse.success) return c.json({ error: 'Dados inválidos.' }, 400);
    const { title, author } = postParse.data;
    const content = sanitizePostHtml(postParse.data.content || '');
    const authorVal = (author || '').trim() || 'Leonardo Cardozo Vargas';
    await c.env.DB.prepare(
      'UPDATE mainsite_posts SET title = ?, content = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    )
      .bind(title, content, authorVal, id)
      .run();

    const geminiKey = c.env.GEMINI_API_KEY;
    if (geminiKey && title && content && id) {
      c.executionCtx.waitUntil(triggerSummaryGeneration(c.env.DB, id, title, content, c.env));
    }

    c.executionCtx.waitUntil(bumpContentVersion(c.env.DB));

    // Notifica IndexNow para re-indexação após edição
    if (id) c.executionCtx.waitUntil(pingIndexNow([buildPostUrl(id)]));

    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// DELETE /api/posts/:id (admin)
posts.delete('/api/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_posts WHERE id = ?').bind(id).run();
    c.executionCtx.waitUntil(bumpContentVersion(c.env.DB));
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// PUT /api/posts/:id/pin (admin)
posts.put('/api/posts/:id/pin', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const post = await c.env.DB.prepare('SELECT is_pinned FROM mainsite_posts WHERE id = ?')
      .bind(id)
      .first<{ is_pinned: number }>();
    const newStatus = post && post.is_pinned ? 0 : 1;
    if (newStatus === 1) await c.env.DB.prepare('UPDATE mainsite_posts SET is_pinned = 0').run();
    await c.env.DB.prepare('UPDATE mainsite_posts SET is_pinned = ? WHERE id = ?').bind(newStatus, id).run();
    c.executionCtx.waitUntil(bumpContentVersion(c.env.DB));
    return c.json({ success: true, is_pinned: newStatus });
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// PUT /api/posts/reorder (admin)
posts.put('/api/posts/reorder', requireAuth, async (c) => {
  try {
    const reorderParse = PostReorderSchema.safeParse(await c.req.json());
    if (!reorderParse.success) return c.json({ error: 'Dados inválidos.' }, 400);
    const items = reorderParse.data;
    const statements = items.map((item) =>
      c.env.DB.prepare('UPDATE mainsite_posts SET display_order = ? WHERE id = ?').bind(item.display_order, item.id),
    );
    await c.env.DB.batch(statements);
    c.executionCtx.waitUntil(bumpContentVersion(c.env.DB));
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Posts] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default posts;
