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

import type { Context } from 'hono';
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { structuredLog } from '../lib/logger.ts';
import {
  evaluateModeration,
  hashIdentity,
  type ModerationSettings,
  moderateText,
  notifyAdminNewComment,
  verifyTurnstile,
} from '../lib/moderation.ts';
import { isPostPublicallyVisible } from '../lib/publishing.ts';
import { NewCommentSchema } from '../lib/schemas.ts';

const comments = new Hono<{ Bindings: Env }>();
type RouteContext = Context<{ Bindings: Env }>;

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Carrega as configurações de moderação diretamente do D1 (sem cache) */

const DEFAULT_MOD_SETTINGS: ModerationSettings = {
  commentsEnabled: true,
  ratingsEnabled: true,
  allowAnonymous: true,
  requireEmail: false,
  requireApproval: false,
  minCommentLength: 3,
  maxCommentLength: 2000,
  maxNestingDepth: 2,
  autoApproveThreshold: 0.3,
  autoRejectThreshold: 0.8,
  criticalCategories: ['Toxic', 'Insult', 'Profanity', 'Sexual', 'Violent', 'Derogatory'],
  apiUnavailableBehavior: 'pending',
  rateLimitPerIpPerHour: 10,
  blocklistWords: [],
  linkPolicy: 'allow',
  duplicateWindowHours: 24,
  autoCloseAfterDays: 0,
  notifyOnNewComment: true,
  notifyEmail: '',
};

async function getModerationSettings(db: D1Database): Promise<ModerationSettings> {
  const record = await db
    .prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/moderation'")
    .first<{ payload: string }>();

  if (record) {
    const stored = JSON.parse(record.payload) as Partial<ModerationSettings>;
    return { ...DEFAULT_MOD_SETTINGS, ...stored };
  }
  return { ...DEFAULT_MOD_SETTINGS };
}

/** Busca o título do post pelo ID */
async function getPostTitle(db: D1Database, postId: number): Promise<string> {
  const post = await db
    .prepare('SELECT title FROM mainsite_posts WHERE id = ?')
    .bind(postId)
    .first<{ title: string }>();
  return post?.title || `Post #${postId}`;
}

async function getCommentDepth(
  db: D1Database,
  postId: number,
  parentId: number,
): Promise<{ depth: number; error?: string }> {
  let currentId: number | null = parentId;
  let depth = 1;
  const visited = new Set<number>();

  while (currentId !== null) {
    if (visited.has(currentId)) {
      return { depth, error: 'Estrutura de comentários inválida.' };
    }
    visited.add(currentId);

    const current: { id: number; parent_id: number | null; post_id: number; status: string } | null = await db
      .prepare('SELECT id, parent_id, post_id, status FROM mainsite_comments WHERE id = ?')
      .bind(currentId)
      .first<{ id: number; parent_id: number | null; post_id: number; status: string }>();

    if (!current || current.status !== 'approved') {
      return { depth, error: 'Comentário pai não encontrado ou não aprovado.' };
    }

    if (current.post_id !== postId) {
      return { depth, error: 'Comentário pai pertence a outro post.' };
    }

    if (current.parent_id === null) {
      return { depth, error: undefined };
    }

    depth += 1;
    currentId = current.parent_id;
  }

  return { depth, error: undefined };
}

async function requireTurnstileValidation(c: RouteContext, token: string | undefined): Promise<Response | null> {
  const turnstileSecret = c.env.TURNSTILE_SECRET_KEY?.trim();
  if (!turnstileSecret) {
    return c.json({ error: 'Proteção antiabuso temporariamente indisponível.' }, 503);
  }
  if (!token) {
    return c.json({ error: 'Token de verificação ausente.' }, 400);
  }
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const isValid = await verifyTurnstile(token, turnstileSecret, ip);
  if (!isValid) {
    return c.json({ error: 'Verificação de segurança falhou. Tente novamente.' }, 403);
  }
  return null;
}

function buildThreadedComments(results: Array<Record<string, unknown>>) {
  const byId = new Map<number, Record<string, unknown> & { replies: Array<Record<string, unknown>> }>();
  const roots: Array<Record<string, unknown> & { replies: Array<Record<string, unknown>> }> = [];

  for (const raw of results) {
    const id = Number(raw.id);
    byId.set(id, { ...raw, replies: [] });
  }

  for (const comment of byId.values()) {
    const parentId = comment.parent_id === null ? null : Number(comment.parent_id);
    if (parentId !== null) {
      const parent = byId.get(parentId);
      if (parent) {
        parent.replies.push(comment);
        continue;
      }
    }
    roots.push(comment);
  }

  return roots;
}

// ── POST /api/comments — Submissão pública ──────────────────────────────────

comments.post('/api/comments', async (c) => {
  try {
    const settings = await getModerationSettings(c.env.DB);

    if (!settings.commentsEnabled) {
      return c.json({ error: 'Comentários estão desabilitados no momento.' }, 403);
    }

    const rawBody = await c.req.json();
    const bodyResult = NewCommentSchema.safeParse(rawBody);
    if (!bodyResult.success) {
      return c.json({ error: 'Post ID e conteúdo são obrigatórios.' }, 400);
    }
    const body = bodyResult.data;

    // Honeypot check: campo oculto preenchido = bot → resposta falsa silenciosa
    if (body._hp) {
      return c.json({ success: true, message: 'Comentário enviado com sucesso!' });
    }

    // Validação de campos obrigatórios
    if (!body.post_id || !body.content) {
      return c.json({ error: 'Post ID e conteúdo são obrigatórios.' }, 400);
    }

    // Kill switch / visibilidade individual: não aceita comentário em post oculto
    if (!(await isPostPublicallyVisible(c.env.DB, body.post_id))) {
      return c.json({ error: 'Post não encontrado' }, 404);
    }

    // Validação de comprimento máximo
    if (body.content.length > settings.maxCommentLength) {
      return c.json(
        {
          error: `Comentário excede o limite de ${settings.maxCommentLength} caracteres.`,
        },
        400,
      );
    }

    // Validação de comprimento mínimo
    if (body.content.trim().length < settings.minCommentLength) {
      return c.json(
        {
          error: `Comentário deve ter ao menos ${settings.minCommentLength} caractere(s).`,
        },
        400,
      );
    }

    // Validação de nome (se anônimo não permitido)
    if (!settings.allowAnonymous && (!body.author_name || body.author_name.trim().length === 0)) {
      return c.json({ error: 'Nome é obrigatório.' }, 400);
    }

    // Validação de email (se requireEmail habilitado)
    if (settings.requireEmail && (!body.author_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.author_email.trim()))) {
      return c.json({ error: 'Email válido é obrigatório.' }, 400);
    }

    // ── Auto-close: rejeitar em posts antigos ────────────────────────────
    if (settings.autoCloseAfterDays > 0) {
      const post = await c.env.DB.prepare('SELECT created_at FROM mainsite_posts WHERE id = ?')
        .bind(body.post_id)
        .first<{ created_at: string }>();

      if (post) {
        const postDate = new Date(post.created_at.replace(' ', 'T') + (post.created_at.includes('Z') ? '' : 'Z'));
        const ageDays = (Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays > settings.autoCloseAfterDays) {
          return c.json(
            { error: `Comentários foram encerrados para este post (após ${settings.autoCloseAfterDays} dias).` },
            403,
          );
        }
      }
    }

    // Validação de threading (profundidade máxima configurável)
    if (body.parent_id) {
      if (settings.maxNestingDepth <= 1) {
        return c.json({ error: 'Respostas a comentários estão desabilitadas.' }, 400);
      }

      const parentDepth = await getCommentDepth(c.env.DB, body.post_id, body.parent_id);
      if (parentDepth.error) {
        return c.json({ error: parentDepth.error }, 404);
      }
      if (parentDepth.depth + 1 > settings.maxNestingDepth) {
        return c.json({ error: 'Profundidade máxima de respostas atingida.' }, 400);
      }
    }

    const turnstileFailure = await requireTurnstileValidation(c, body.turnstile_token);
    if (turnstileFailure) return turnstileFailure;

    // Gera hash do IP para tracking anti-spam (privacy-first)
    const clientIp = c.req.header('cf-connecting-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    // Use date-based rotation salt to prevent long-term tracking while keeping
    // within-day dedup effective. The salt changes daily.
    const dailySalt = `comment:${body.post_id}:${new Date().toISOString().slice(0, 10)}`;
    const ipHash = await hashIdentity(clientIp, userAgent, dailySalt);

    // ── Rate limiting por IP (configurável) ──────────────────────────────
    if (settings.rateLimitPerIpPerHour > 0) {
      const windowHours = 1;
      const recentCount = await c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM mainsite_comments
         WHERE author_ip_hash = ? AND created_at > datetime('now', ? || ' hours')`,
      )
        .bind(ipHash, `-${windowHours}`)
        .first<{ cnt: number }>();

      if (recentCount && recentCount.cnt >= settings.rateLimitPerIpPerHour) {
        return c.json({ error: 'Limite de comentários por hora atingido. Tente novamente mais tarde.' }, 429);
      }
    }

    // Detecção de conteúdo duplicado (janela configurável)
    const dupWindow = settings.duplicateWindowHours || 24;
    const duplicateCheck = await c.env.DB.prepare(
      `SELECT id FROM mainsite_comments
       WHERE post_id = ? AND author_ip_hash = ? AND content = ?
       AND created_at > datetime('now', ? || ' hours')
       LIMIT 1`,
    )
      .bind(body.post_id, ipHash, body.content, `-${dupWindow}`)
      .first();

    if (duplicateCheck) {
      return c.json({ error: 'Comentário duplicado detectado.' }, 409);
    }

    // Sanitização básica do conteúdo (strip HTML tags)
    const sanitizedContent = body.content.replace(/<[^>]*>/g, '').trim();

    if (sanitizedContent.length === 0) {
      return c.json({ error: 'Comentário não pode estar vazio.' }, 400);
    }

    // ── Blocklist de palavras (rejeição imediata) ────────────────────────
    if (settings.blocklistWords.length > 0) {
      const contentLower = sanitizedContent.toLowerCase();
      const blocked = settings.blocklistWords.find((word) => contentLower.includes(word.toLowerCase()));
      if (blocked) {
        return c.json({ error: 'Comentário contém conteúdo não permitido.' }, 403);
      }
    }

    // ── Política de links ────────────────────────────────────────────────
    const hasLinks = /https?:\/\/|www\./i.test(sanitizedContent);
    let linkOverrideStatus: string | null = null;
    if (hasLinks) {
      if (settings.linkPolicy === 'block') {
        return c.json({ error: 'Links não são permitidos nos comentários.' }, 400);
      }
      if (settings.linkPolicy === 'pending') {
        linkOverrideStatus = 'pending';
      }
    }

    // ── Moderação via GCP Natural Language API ───────────────────────────
    const gcpApiKey = c.env.GCP_NL_API_KEY;
    let moderationScores: string | null = null;
    let moderationDecisionJson: string | null = null;
    let commentStatus: string;

    if (!gcpApiKey) {
      return c.json({ error: 'Moderação indisponível no momento. Tente novamente mais tarde.' }, 503);
    }

    const modResult = await moderateText(sanitizedContent, gcpApiKey);
    const decision = evaluateModeration(modResult, settings);

    moderationScores = JSON.stringify(modResult.categories);
    moderationDecisionJson = JSON.stringify(decision);
    commentStatus = decision.action;

    // Link policy override (se linkPolicy = 'pending', força pending independente da IA)
    if (linkOverrideStatus === 'pending' && commentStatus === 'approved') {
      commentStatus = 'pending';
    }

    // ── Persistência ────────────────────────────────────────────────────
    const result = await c.env.DB.prepare(
      `INSERT INTO mainsite_comments
       (post_id, parent_id, author_name, author_email, author_ip_hash,
        content, status, moderation_scores, moderation_decision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        body.post_id,
        body.parent_id || null,
        (body.author_name || 'Anônimo').trim().substring(0, 100),
        body.author_email ? body.author_email.trim().substring(0, 255) : null,
        ipHash,
        sanitizedContent,
        commentStatus,
        moderationScores,
        moderationDecisionJson,
      )
      .run();

    // ── Notificação por email (async, non-blocking) ─────────────────────
    const postTitle = await getPostTitle(c.env.DB, body.post_id);
    if (settings.notifyOnNewComment && c.env.RESEND_API_KEY && settings.notifyEmail) {
      c.executionCtx.waitUntil(
        notifyAdminNewComment(
          c.env.RESEND_API_KEY,
          {
            authorName: (body.author_name || 'Anônimo').trim(),
            content: sanitizedContent.substring(0, 500),
            postTitle,
            status: commentStatus,
          },
          settings.notifyEmail,
        ),
      );
    }

    return c.json({
      success: true,
      message:
        commentStatus === 'approved'
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

// ── GET /api/comments/config — Settings públicas para o formulário ───────────

comments.get('/api/comments/config', async (c) => {
  try {
    const settings = await getModerationSettings(c.env.DB);
    // Expõe apenas as configurações necessárias para o formulário público
    return c.json({
      commentsEnabled: settings.commentsEnabled,
      allowAnonymous: settings.allowAnonymous,
      requireEmail: settings.requireEmail,
      minCommentLength: settings.minCommentLength,
      maxCommentLength: settings.maxCommentLength,
      maxNestingDepth: settings.maxNestingDepth,
    });
  } catch {
    // Fallback seguro: formulário funcional com defaults
    return c.json({
      commentsEnabled: true,
      allowAnonymous: true,
      requireEmail: false,
      minCommentLength: 3,
      maxCommentLength: 2000,
      maxNestingDepth: 2,
    });
  }
});

// ── GET /api/comments/:postId — Lista comentários aprovados (público) ───────

comments.get('/api/comments/:postId', async (c) => {
  try {
    const postId = parseInt(c.req.param('postId'), 10);
    if (Number.isNaN(postId)) return c.json({ error: 'Post ID inválido.' }, 400);

    // Post oculto (kill switch global ou visibilidade individual): não lista comentários.
    if (!(await isPostPublicallyVisible(c.env.DB, postId))) {
      c.header('Cache-Control', 'no-store');
      return c.json({ comments: [], total: 0 });
    }

    // Busca todos os comentários aprovados do post (threading-ready)
    const { results } = await c.env.DB.prepare(
      `SELECT id, post_id, parent_id, author_name, content, is_author_reply, created_at
       FROM mainsite_comments
       WHERE post_id = ? AND status = 'approved'
       ORDER BY created_at ASC`,
    )
      .bind(postId)
      .all();

    const threaded = buildThreadedComments((results || []) as Array<Record<string, unknown>>);

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
    if (Number.isNaN(postId)) return c.json({ error: 'Post ID inválido.' }, 400);

    if (!(await isPostPublicallyVisible(c.env.DB, postId))) {
      c.header('Cache-Control', 'no-store');
      return c.json({ count: 0 });
    }

    const result = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM mainsite_comments WHERE post_id = ? AND status = 'approved'",
    )
      .bind(postId)
      .first<{ count: number }>();

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
       LIMIT ? OFFSET ?`,
    )
      .bind(status, limit, offset)
      .all();

    // Contagens por status para métricas do dashboard
    const counts = await c.env.DB.prepare(
      `SELECT status, COUNT(*) as count
       FROM mainsite_comments
       GROUP BY status`,
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
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
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
       WHERE id = ?`,
    )
      .bind(status, admin_notes || null, id)
      .run();

    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
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
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
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
    const parent = await c.env.DB.prepare('SELECT post_id, status FROM mainsite_comments WHERE id = ?')
      .bind(parentId)
      .first<{ post_id: number; status: string }>();

    if (!parent) return c.json({ error: 'Comentário pai não encontrado.' }, 404);

    // Insere resposta como approved e marcada como do autor
    await c.env.DB.prepare(
      `INSERT INTO mainsite_comments
       (post_id, parent_id, author_name, content, status, is_author_reply, reviewed_at, reviewed_by)
       VALUES (?, ?, 'Autor', ?, 'approved', 1, CURRENT_TIMESTAMP, 'admin')`,
    )
      .bind(parent.post_id, parentId, content.trim())
      .run();

    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
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
      await c.env.DB.prepare(`DELETE FROM mainsite_comments WHERE parent_id IN (${placeholders})`)
        .bind(...ids)
        .run();
      await c.env.DB.prepare(`DELETE FROM mainsite_comments WHERE id IN (${placeholders})`)
        .bind(...ids)
        .run();
    } else {
      const newStatus = action === 'approve' ? 'approved' : 'rejected_manual';
      await c.env.DB.prepare(
        `UPDATE mainsite_comments
         SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewed_by = 'admin'
         WHERE id IN (${placeholders})`,
      )
        .bind(newStatus, ...ids)
        .run();
    }

    return c.json({ success: true, affected: ids.length });
  } catch (err) {
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// ── GET /api/comments/admin/settings — Carrega configurações de moderação ──

comments.get('/api/comments/admin/settings', requireAuth, async (c) => {
  try {
    const settings = await getModerationSettings(c.env.DB);
    return c.json({ settings });
  } catch (err) {
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// ── PUT /api/comments/admin/settings — Salva configurações de moderação ──

comments.put('/api/comments/admin/settings', requireAuth, async (c) => {
  try {
    const body = await c.req.json<Partial<ModerationSettings>>();

    // Carrega settings atuais como base (já inclui todos os defaults)
    const current = await getModerationSettings(c.env.DB);

    // Merge: current (com defaults) + body (override parcial)
    const merged: ModerationSettings = { ...current, ...body };

    // Validações
    if (merged.autoApproveThreshold < 0 || merged.autoApproveThreshold > 1) {
      return c.json({ error: 'autoApproveThreshold deve estar entre 0 e 1' }, 400);
    }
    if (merged.autoRejectThreshold < 0 || merged.autoRejectThreshold > 1) {
      return c.json({ error: 'autoRejectThreshold deve estar entre 0 e 1' }, 400);
    }
    if (merged.autoApproveThreshold >= merged.autoRejectThreshold) {
      return c.json({ error: 'autoApproveThreshold deve ser menor que autoRejectThreshold' }, 400);
    }
    if (merged.maxCommentLength < 10 || merged.maxCommentLength > 10000) {
      return c.json({ error: 'maxCommentLength deve estar entre 10 e 10000' }, 400);
    }
    if (merged.minCommentLength < 1 || merged.minCommentLength > merged.maxCommentLength) {
      return c.json({ error: 'minCommentLength deve estar entre 1 e maxCommentLength' }, 400);
    }

    // Upsert no D1
    await c.env.DB.prepare(
      `INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/moderation', ?)
       ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`,
    )
      .bind(JSON.stringify(merged))
      .run();

    return c.json({ success: true, settings: merged });
  } catch (err) {
    structuredLog('error', '[Comments] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default comments;
