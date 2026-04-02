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
import { generateShareSummary, hashContent, stripHtml } from '../lib/gemini.ts';
import { structuredLog } from '../lib/logger.ts';

const posts = new Hono<{ Bindings: Env }>();

// ========== SUMMARY GENERATION HELPER ==========

/**
 * Gera (ou regenera) o resumo IA para compartilhamento social.
 * - Cria tabela automaticamente se não existir (idempotente).
 * - Compara hash do conteúdo para evitar regenerações desnecessárias.
 * - Respeita overrides manuais (is_manual = 1): não sobrescreve.
 */
async function triggerSummaryGeneration(
  db: D1Database,
  apiKey: string,
  postId: string | number,
  title: string,
  content: string
): Promise<void> {
  try {
    // Auto-migração
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS mainsite_post_ai_summaries (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id      INTEGER NOT NULL UNIQUE,
        summary_og   TEXT NOT NULL,
        summary_ld   TEXT,
        content_hash TEXT NOT NULL,
        model        TEXT DEFAULT 'gemini-pro-latest',
        is_manual    INTEGER DEFAULT 0,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    const cleanContent = stripHtml(content);
    const newHash = await hashContent(cleanContent);

    // Verifica se já existe resumo com mesmo hash ou override manual
    const existing = await db.prepare(
      'SELECT content_hash, is_manual FROM mainsite_post_ai_summaries WHERE post_id = ?'
    ).bind(postId).first<{ content_hash: string; is_manual: number }>();

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
    const result = await generateShareSummary(db, title, content, apiKey);
    if (!result) {
      structuredLog('warn', 'Share summary generation returned null', { postId });
      return;
    }

    await db.prepare(`
      INSERT INTO mainsite_post_ai_summaries (post_id, summary_og, summary_ld, content_hash, is_manual, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(post_id) DO UPDATE SET
        summary_og = excluded.summary_og,
        summary_ld = excluded.summary_ld,
        content_hash = excluded.content_hash,
        is_manual = 0,
        model = 'gemini-pro-latest',
        updated_at = CURRENT_TIMESTAMP
    `).bind(postId, result.summary_og, result.summary_ld, newHash).run();

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

// GET /api/posts (público)
posts.get('/api/posts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC'
    ).all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/posts/:id (público)
posts.get('/api/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare('SELECT * FROM mainsite_posts WHERE id = ?').bind(id).first();
    if (!post) return c.json({ error: 'Post não encontrado' }, 404);
    return c.json(post);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// POST /api/posts (admin)
posts.post('/api/posts', requireAuth, async (c) => {
  try {
    const { title, content, author } = (await c.req.json()) as { title?: string; content?: string; author?: string };
    const authorVal = (author || '').trim() || 'Leonardo Cardozo Vargas';
    const result = await c.env.DB.prepare(
      'INSERT INTO mainsite_posts (title, content, author, is_pinned, display_order) VALUES (?, ?, ?, 0, 0)'
    )
      .bind(title, content, authorVal)
      .run();

    // Fire-and-forget: gerar resumo IA para compartilhamento
    const apiKey = c.env.GEMINI_API_KEY;
    if (apiKey && title && content && result.meta?.last_row_id) {
      c.executionCtx.waitUntil(
        triggerSummaryGeneration(c.env.DB, apiKey, result.meta.last_row_id, title, content)
      );
    }

    return c.json({ success: true }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// PUT /api/posts/:id (admin)
posts.put('/api/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    const { title, content, author } = (await c.req.json()) as { title?: string; content?: string; author?: string };
    const authorVal = (author || '').trim() || 'Leonardo Cardozo Vargas';
    await c.env.DB.prepare(
      'UPDATE mainsite_posts SET title = ?, content = ?, author = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    )
      .bind(title, content, authorVal, id)
      .run();

    // Fire-and-forget: regenerar resumo IA se conteúdo mudou
    const apiKey = c.env.GEMINI_API_KEY;
    if (apiKey && title && content && id) {
      c.executionCtx.waitUntil(
        triggerSummaryGeneration(c.env.DB, apiKey, id, title, content)
      );
    }

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// DELETE /api/posts/:id (admin)
posts.delete('/api/posts/:id', requireAuth, async (c) => {
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_posts WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
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
    return c.json({ success: true, is_pinned: newStatus });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// PUT /api/posts/reorder (admin)
posts.put('/api/posts/reorder', requireAuth, async (c) => {
  try {
    const items = (await c.req.json()) as Array<{ id: string | number; display_order: number }>;
    const statements = items.map((item) =>
      c.env.DB.prepare('UPDATE mainsite_posts SET display_order = ? WHERE id = ?').bind(item.display_order, item.id)
    );
    await c.env.DB.batch(statements);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default posts;
