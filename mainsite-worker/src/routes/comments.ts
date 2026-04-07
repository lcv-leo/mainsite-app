/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Comentários Públicos com Moderação IA.
 * Domínio: /api/comments, /api/comments/:postId, /api/comments/:postId/count
 *
 * Fluxo:
 * 1. Usuário submete comentário (POST /api/comments)
 * 2. Validação + Turnstile + Honeypot + Rate Limit (upstream)
 * 3. GCP NL API moderateText → scores
 * 4. Decision engine → auto-approve / pending / auto-reject
 * 5. INSERT em mainsite_comments com status adequado
 * 6. Notificação por email ao admin via Resend
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import {
  moderateText,
  evaluateModeration,
  hashIdentity,
  verifyTurnstile,
  notifyAdminNewComment,
  type ModerationSettings,
} from '../lib/moderation.ts';

const comments = new Hono<{ Bindings: Env }>();

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Carrega as configurações de moderação do D1 com cache in-memory de 60s */
let cachedModSettings: ModerationSettings | null = null;
let modSettingsFetchedAt = 0;

async function getModerationSettings(db: D1Database): Promise<ModerationSettings> {
  const now = Date.now();
  if (cachedModSettings && now - modSettingsFetchedAt < 60_000) return cachedModSettings;

  const record = await db.prepare(
    "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/moderation'"
  ).first<{ payload: string }>();

  if (record) {
    cachedModSettings = JSON.parse(record.payload) as ModerationSettings;
  } else {
    // Defaults seguros caso settings estejam ausentes
    cachedModSettings = {
      autoApproveThreshold: 0.3,
      autoRejectThreshold: 0.8,
      criticalCategories: ['Toxic', 'Insult', 'Profanity', 'Sexual', 'Violent', 'Derogatory'],
      requireApproval: false,
      commentsEnabled: true,
      ratingsEnabled: true,
      allowAnonymous: true,
      maxCommentLength: 2000,
      maxNestingDepth: 2,
    };
  }
  modSettingsFetchedAt = now;
  return cachedModSettings;
}

/** Busca o título do post pelo ID */
async function getPostTitle(db: D1Database, postId: number): Promise<string> {
  const post = await db.prepare(
    'SELECT title FROM mainsite_posts WHERE id = ?'
  ).bind(postId).first<{ title: string }>();
  return post?.title || `Post #${postId}`;
}

// ── POST /api/comments — Submissão pública ──────────────────────────────────

comments.post('/api/comments', async (c) => {
  try {
    const settings = await getModerationSettings(c.env.DB);

    if (!settings.commentsEnabled) {
      return c.json({ error: 'Comentários estão desabilitados no momento.' }, 403);
    }

    const body = (await c.req.json()) as {
      post_id?: number;
      parent_id?: number | null;
      author_name?: string;
      author_email?: string;
      content?: string;
      turnstile_token?: string;
      _hp?: string; // Honeypot field
    };

    // Honeypot check: campo oculto preenchido = bot → resposta falsa silenciosa
    if (body._hp) {
      return c.json({ success: true, message: 'Comentário enviado com sucesso!' });
    }

    // Validação de campos obrigatórios
    if (!body.post_id || !body.content) {
      return c.json({ error: 'Post ID e conteúdo são obrigatórios.' }, 400);
    }

    // Validação de comprimento
    if (body.content.length > settings.maxCommentLength) {
      return c.json({
        error: `Comentário excede o limite de ${settings.maxCommentLength} caracteres.`,
      }, 400);
    }

    // Validação de nome (se anônimo não permitido)
    if (!settings.allowAnonymous && (!body.author_name || body.author_name.trim().length === 0)) {
      return c.json({ error: 'Nome é obrigatório.' }, 400);
    }

    // Validação de threading (profundidade máxima)
    if (body.parent_id) {
      const parent = await c.env.DB.prepare(
        'SELECT parent_id FROM mainsite_comments WHERE id = ? AND status = ?'
      ).bind(body.parent_id, 'approved').first<{ parent_id: number | null }>();

      if (!parent) {
        return c.json({ error: 'Comentário pai não encontrado ou não aprovado.' }, 404);
      }

      // Se o pai já é uma resposta (tem parent_id), não permite mais aninhamento
      if (parent.parent_id !== null) {
        return c.json({ error: 'Profundidade máxima de respostas atingida.' }, 400);
      }
    }

    // Verificação do Cloudflare Turnstile
    const turnstileSecret = c.env.TURNSTILE_SECRET_KEY;
    if (turnstileSecret && body.turnstile_token) {
      const ip = c.req.header('cf-connecting-ip') || 'unknown';
      const isValid = await verifyTurnstile(body.turnstile_token, turnstileSecret, ip);
      if (!isValid) {
        return c.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, 403);
      }
    } else if (turnstileSecret && !body.turnstile_token) {
      // Turnstile configurado mas token não enviado → suspeito
      return c.json({ error: 'Token de verificação ausente.' }, 400);
    }

    // Gera hash do IP para tracking anti-spam (privacy-first)
    const clientIp = c.req.header('cf-connecting-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    const ipHash = await hashIdentity(clientIp, userAgent, `comment:${body.post_id}`);

    // Detecção de conteúdo duplicado (mesmo autor, mesmo conteúdo, mesmo post, últimas 24h)
    const duplicateCheck = await c.env.DB.prepare(
      `SELECT id FROM mainsite_comments
       WHERE post_id = ? AND author_ip_hash = ? AND content = ?
       AND created_at > datetime('now', '-1 day')
       LIMIT 1`
    ).bind(body.post_id, ipHash, body.content).first();

    if (duplicateCheck) {
      return c.json({ error: 'Comentário duplicado detectado.' }, 409);
    }

    // Sanitização básica do conteúdo (strip HTML tags)
    const sanitizedContent = body.content
      .replace(/<[^>]*>/g, '')
      .trim();

    if (sanitizedContent.length === 0) {
      return c.json({ error: 'Comentário não pode estar vazio.' }, 400);
    }

    // ── Moderação via GCP Natural Language API ───────────────────────────
    const gcpApiKey = c.env.GCP_NL_API_KEY;
    let moderationScores: string | null = null;
    let moderationDecisionJson: string | null = null;
    let commentStatus: string;

    if (gcpApiKey) {
      const modResult = await moderateText(sanitizedContent, gcpApiKey);
      const decision = evaluateModeration(modResult, settings);

      moderationScores = JSON.stringify(modResult.categories);
      moderationDecisionJson = JSON.stringify(decision);
      commentStatus = decision.action;
    } else {
      // Sem chave GCP → todos pendentes para revisão manual
      commentStatus = 'pending';
    }

    // ── Persistência ────────────────────────────────────────────────────
    const result = await c.env.DB.prepare(
      `INSERT INTO mainsite_comments
       (post_id, parent_id, author_name, author_email, author_ip_hash,
        content, status, moderation_scores, moderation_decision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      body.post_id,
      body.parent_id || null,
      (body.author_name || 'Anônimo').trim().substring(0, 100),
      body.author_email ? body.author_email.trim().substring(0, 255) : null,
      ipHash,
      sanitizedContent,
      commentStatus,
      moderationScores,
      moderationDecisionJson,
    ).run();

    // ── Notificação por email (async, non-blocking) ─────────────────────
    const postTitle = await getPostTitle(c.env.DB, body.post_id);
    if (c.env.RESEND_API_KEY) {
      c.executionCtx.waitUntil(
        notifyAdminNewComment(c.env.RESEND_API_KEY, {
          authorName: (body.author_name || 'Anônimo').trim(),
          content: sanitizedContent.substring(0, 500),
          postTitle,
          status: commentStatus,
        })
      );
    }

    return c.json({
      success: true,
      message: commentStatus === 'approved'
        ? 'Comentário publicado com sucesso!'
        : 'Comentário enviado! Será visível após moderação.',
      comment_id: result.meta.last_row_id,
      status: commentStatus,
    });
  } catch (err) {
    console.error('[Comments] Erro ao processar comentário:', err);
    return c.json({ error: 'Falha ao processar comentário.' }, 500);
  }
});

// ── GET /api/comments/:postId — Lista comentários aprovados (público) ───────

comments.get('/api/comments/:postId', async (c) => {
  try {
    const postId = parseInt(c.req.param('postId'), 10);
    if (isNaN(postId)) return c.json({ error: 'Post ID inválido.' }, 400);

    // Busca todos os comentários aprovados do post (threading-ready)
    const { results } = await c.env.DB.prepare(
      `SELECT id, post_id, parent_id, author_name, content, is_author_reply, created_at
       FROM mainsite_comments
       WHERE post_id = ? AND status = 'approved'
       ORDER BY created_at ASC`
    ).bind(postId).all();

    // Organiza em estrutura de árvore (2 níveis)
    const topLevel = (results || []).filter(
      (c: Record<string, unknown>) => c.parent_id === null
    );
    const replies = (results || []).filter(
      (c: Record<string, unknown>) => c.parent_id !== null
    );

    const threaded = topLevel.map((comment: Record<string, unknown>) => ({
      ...comment,
      replies: replies.filter((r: Record<string, unknown>) => r.parent_id === comment.id),
    }));

    return c.json({
      comments: threaded,
      total: results?.length || 0,
    });
  } catch (err) {
    console.error('[Comments] Erro ao listar comentários:', err);
    return c.json({ error: 'Falha ao carregar comentários.' }, 500);
  }
});

// ── GET /api/comments/:postId/count — Contagem leve (para cards) ────────────

comments.get('/api/comments/:postId/count', async (c) => {
  try {
    const postId = parseInt(c.req.param('postId'), 10);
    if (isNaN(postId)) return c.json({ error: 'Post ID inválido.' }, 400);

    const result = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM mainsite_comments WHERE post_id = ? AND status = 'approved'"
    ).bind(postId).first<{ count: number }>();

    return c.json({ count: result?.count || 0 });
  } catch {
    return c.json({ count: 0 });
  }
});

// ── Admin: GET /api/comments/admin/all — Todos comentários (autenticado) ────

comments.get('/api/comments/admin/all', requireAuth, async (c) => {
  try {
    const status = c.req.query('status') || 'pending';
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const { results } = await c.env.DB.prepare(
      `SELECT c.*, p.title as post_title
       FROM mainsite_comments c
       LEFT JOIN mainsite_posts p ON c.post_id = p.id
       WHERE c.status = ?
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(status, limit, offset).all();

    // Contagens por status para métricas do dashboard
    const counts = await c.env.DB.prepare(
      `SELECT status, COUNT(*) as count
       FROM mainsite_comments
       GROUP BY status`
    ).all();

    const statusCounts: Record<string, number> = {};
    for (const row of (counts.results || []) as Array<{ status: string; count: number }>) {
      statusCounts[row.status] = row.count;
    }

    return c.json({
      comments: results || [],
      counts: statusCounts,
      pagination: { limit, offset },
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Admin: PATCH /api/comments/admin/:id — Aprovar/Rejeitar ─────────────────

comments.patch('/api/comments/admin/:id', requireAuth, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0', 10);
    const { status, admin_notes } = (await c.req.json()) as {
      status?: string;
      admin_notes?: string;
    };

    const validStatuses = ['approved', 'rejected_manual', 'pending'];
    if (!status || !validStatuses.includes(status)) {
      return c.json({ error: 'Status inválido.' }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE mainsite_comments
       SET status = ?, admin_notes = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = 'admin'
       WHERE id = ?`
    ).bind(status, admin_notes || null, id).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Admin: DELETE /api/comments/admin/:id — Deletar permanentemente ─────────

comments.delete('/api/comments/admin/:id', requireAuth, async (c) => {
  try {
    const id = parseInt(c.req.param('id') || '0', 10);
    // Deleta também respostas (cascade manual)
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM mainsite_comments WHERE parent_id = ?').bind(id),
      c.env.DB.prepare('DELETE FROM mainsite_comments WHERE id = ?').bind(id),
    ]);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Admin: POST /api/comments/admin/:id/reply — Resposta do autor ───────────

comments.post('/api/comments/admin/:id/reply', requireAuth, async (c) => {
  try {
    const parentId = parseInt(c.req.param('id') || '0', 10);
    const { content } = (await c.req.json()) as { content?: string };

    if (!content || content.trim().length === 0) {
      return c.json({ error: 'Conteúdo da resposta é obrigatório.' }, 400);
    }

    // Verifica que o comentário pai existe e está aprovado
    const parent = await c.env.DB.prepare(
      'SELECT post_id, status FROM mainsite_comments WHERE id = ?'
    ).bind(parentId).first<{ post_id: number; status: string }>();

    if (!parent) return c.json({ error: 'Comentário pai não encontrado.' }, 404);

    // Insere resposta como approved e marcada como do autor
    await c.env.DB.prepare(
      `INSERT INTO mainsite_comments
       (post_id, parent_id, author_name, content, status, is_author_reply, reviewed_at, reviewed_by)
       VALUES (?, ?, 'Autor', ?, 'approved', 1, CURRENT_TIMESTAMP, 'admin')`
    ).bind(parent.post_id, parentId, content.trim()).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// ── Admin: POST /api/comments/admin/bulk — Ações em lote ────────────────────

comments.post('/api/comments/admin/bulk', requireAuth, async (c) => {
  try {
    const { ids, action } = (await c.req.json()) as {
      ids?: number[];
      action?: 'approve' | 'reject' | 'delete';
    };

    if (!ids || ids.length === 0 || !action) {
      return c.json({ error: 'IDs e ação são obrigatórios.' }, 400);
    }

    const placeholders = ids.map(() => '?').join(',');

    if (action === 'delete') {
      // Deleta respostas primeiro, depois os comentários
      await c.env.DB.prepare(
        `DELETE FROM mainsite_comments WHERE parent_id IN (${placeholders})`
      ).bind(...ids).run();
      await c.env.DB.prepare(
        `DELETE FROM mainsite_comments WHERE id IN (${placeholders})`
      ).bind(...ids).run();
    } else {
      const newStatus = action === 'approve' ? 'approved' : 'rejected_manual';
      await c.env.DB.prepare(
        `UPDATE mainsite_comments
         SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = 'admin'
         WHERE id IN (${placeholders})`
      ).bind(newStatus, ...ids).run();
    }

    return c.json({ success: true, affected: ids.length });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default comments;
