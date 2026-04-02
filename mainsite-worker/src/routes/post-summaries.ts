/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas admin de gerenciamento de resumos IA para compartilhamento social.
 * Domínio: /api/post-summaries/*
 *
 * Endpoints:
 * - GET  /api/post-summaries                       → lista todos os resumos
 * - GET  /api/post-summaries/:postId               → resumo de um post
 * - PUT  /api/post-summaries/:postId               → edição manual (override humano)
 * - POST /api/post-summaries/:postId/regenerate     → forçar regeneração via IA
 * - POST /api/post-summaries/generate-all           → gerar resumos para todos os posts existentes
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { generateShareSummary, hashContent, stripHtml } from '../lib/gemini.ts';
import { structuredLog } from '../lib/logger.ts';

const postSummaries = new Hono<{ Bindings: Env }>();

// Auto-migração da tabela (idempotente)
async function ensureTable(db: D1Database): Promise<void> {
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
}

// GET /api/post-summaries — lista todos
postSummaries.get('/api/post-summaries', requireAuth, async (c) => {
  try {
    await ensureTable(c.env.DB);
    const { results } = await c.env.DB.prepare(`
      SELECT s.*, p.title AS post_title
      FROM mainsite_post_ai_summaries s
      LEFT JOIN mainsite_posts p ON p.id = s.post_id
      ORDER BY s.updated_at DESC
    `).all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/post-summaries/:postId — resumo específico
postSummaries.get('/api/post-summaries/:postId', requireAuth, async (c) => {
  try {
    await ensureTable(c.env.DB);
    const postId = c.req.param('postId');
    const summary = await c.env.DB.prepare(
      'SELECT * FROM mainsite_post_ai_summaries WHERE post_id = ?'
    ).bind(postId).first();
    if (!summary) return c.json({ error: 'Resumo não encontrado para este post' }, 404);
    return c.json(summary);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// PUT /api/post-summaries/:postId — edição manual (override humano)
postSummaries.put('/api/post-summaries/:postId', requireAuth, async (c) => {
  try {
    await ensureTable(c.env.DB);
    const postId = c.req.param('postId');
    const { summary_og, summary_ld } = (await c.req.json()) as {
      summary_og?: string;
      summary_ld?: string;
    };

    if (!summary_og || summary_og.trim().length === 0) {
      return c.json({ error: 'summary_og é obrigatório' }, 400);
    }

    // Busca o post para computar hash atual
    const post = await c.env.DB.prepare(
      'SELECT content FROM mainsite_posts WHERE id = ?'
    ).bind(postId).first<{ content: string }>();

    if (!post) return c.json({ error: 'Post não encontrado' }, 404);

    const contentHash = await hashContent(stripHtml(post.content));

    await c.env.DB.prepare(`
      INSERT INTO mainsite_post_ai_summaries (post_id, summary_og, summary_ld, content_hash, is_manual, updated_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      ON CONFLICT(post_id) DO UPDATE SET
        summary_og = excluded.summary_og,
        summary_ld = excluded.summary_ld,
        content_hash = excluded.content_hash,
        is_manual = 1,
        updated_at = CURRENT_TIMESTAMP
    `).bind(
      postId,
      summary_og.trim().substring(0, 200),
      (summary_ld || summary_og).trim().substring(0, 300),
      contentHash
    ).run();

    structuredLog('info', 'Share summary manually updated', { postId });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// POST /api/post-summaries/:postId/regenerate — forçar regeneração via IA
postSummaries.post('/api/post-summaries/:postId/regenerate', requireAuth, async (c) => {
  try {
    await ensureTable(c.env.DB);
    const postId = c.req.param('postId');
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY não configurada' }, 503);

    const post = await c.env.DB.prepare(
      'SELECT id, title, content FROM mainsite_posts WHERE id = ?'
    ).bind(postId).first<{ id: number; title: string; content: string }>();

    if (!post) return c.json({ error: 'Post não encontrado' }, 404);

    const cleanContent = stripHtml(post.content);
    const contentHash = await hashContent(cleanContent);

    const result = await generateShareSummary(c.env.DB, post.title, post.content, apiKey);
    if (!result) {
      return c.json({ error: 'Falha na geração do resumo pela IA' }, 502);
    }

    await c.env.DB.prepare(`
      INSERT INTO mainsite_post_ai_summaries (post_id, summary_og, summary_ld, content_hash, is_manual, updated_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      ON CONFLICT(post_id) DO UPDATE SET
        summary_og = excluded.summary_og,
        summary_ld = excluded.summary_ld,
        content_hash = excluded.content_hash,
        is_manual = 0,
        model = 'gemini-pro-latest',
        updated_at = CURRENT_TIMESTAMP
    `).bind(postId, result.summary_og, result.summary_ld, contentHash).run();

    structuredLog('info', 'Share summary regenerated via AI', { postId });
    return c.json({ success: true, ...result });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// POST /api/post-summaries/generate-all — gerar resumos para todos os posts existentes
// Processa sequencialmente para respeitar rate limits do Gemini.
// Pula posts com override manual (is_manual = 1) e posts com hash idêntico.
postSummaries.post('/api/post-summaries/generate-all', requireAuth, async (c) => {
  try {
    await ensureTable(c.env.DB);
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: 'GEMINI_API_KEY não configurada' }, 503);

    // Modo: 'missing' = só posts sem resumo; 'all' = todos (exceto manual overrides)
    const mode = (c.req.query('mode') || 'missing') as string;

    const { results: allPosts } = await c.env.DB.prepare(
      'SELECT id, title, content FROM mainsite_posts ORDER BY id ASC'
    ).all<{ id: number; title: string; content: string }>();

    if (!allPosts || allPosts.length === 0) {
      return c.json({ success: true, generated: 0, skipped: 0, failed: 0, total: 0 });
    }

    // Carrega resumos existentes para comparação
    const { results: existingSummaries } = await c.env.DB.prepare(
      'SELECT post_id, content_hash, is_manual FROM mainsite_post_ai_summaries'
    ).all<{ post_id: number; content_hash: string; is_manual: number }>();

    const summaryMap = new Map<number, { content_hash: string; is_manual: number }>();
    for (const s of existingSummaries || []) {
      summaryMap.set(s.post_id, { content_hash: s.content_hash, is_manual: s.is_manual });
    }

    let generated = 0;
    let skipped = 0;
    let failed = 0;
    const details: Array<{ postId: number; title: string; status: string }> = [];

    for (const post of allPosts) {
      const cleanContent = stripHtml(post.content);
      const newHash = await hashContent(cleanContent);
      const existing = summaryMap.get(post.id);

      // Pular manual overrides
      if (existing?.is_manual === 1) {
        skipped++;
        details.push({ postId: post.id, title: post.title, status: 'skipped_manual' });
        continue;
      }

      // Em modo 'missing', pular se já tem resumo com hash idêntico
      if (mode === 'missing' && existing && existing.content_hash === newHash) {
        skipped++;
        details.push({ postId: post.id, title: post.title, status: 'skipped_unchanged' });
        continue;
      }

      // Conteúdo muito curto
      if (cleanContent.length < 50) {
        skipped++;
        details.push({ postId: post.id, title: post.title, status: 'skipped_too_short' });
        continue;
      }

      try {
        const result = await generateShareSummary(c.env.DB, post.title, post.content, apiKey);
        if (!result) {
          failed++;
          details.push({ postId: post.id, title: post.title, status: 'failed_ai' });
          continue;
        }

        await c.env.DB.prepare(`
          INSERT INTO mainsite_post_ai_summaries (post_id, summary_og, summary_ld, content_hash, is_manual, updated_at)
          VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
          ON CONFLICT(post_id) DO UPDATE SET
            summary_og = excluded.summary_og,
            summary_ld = excluded.summary_ld,
            content_hash = excluded.content_hash,
            is_manual = 0,
            model = 'gemini-pro-latest',
            updated_at = CURRENT_TIMESTAMP
        `).bind(post.id, result.summary_og, result.summary_ld, newHash).run();

        generated++;
        details.push({ postId: post.id, title: post.title, status: 'generated' });

        structuredLog('info', 'Bulk share summary generated', {
          postId: post.id,
          ogLength: result.summary_og.length,
        });
      } catch (err) {
        failed++;
        details.push({ postId: post.id, title: post.title, status: `error: ${(err as Error).message}` });
      }
    }

    structuredLog('info', 'Bulk share summary generation complete', {
      total: allPosts.length,
      generated,
      skipped,
      failed,
    });

    return c.json({
      success: true,
      total: allPosts.length,
      generated,
      skipped,
      failed,
      details,
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default postSummaries;
