/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Ratings (Estrelas + Reações).
 * Domínio: /api/ratings, /api/ratings/:postId
 *
 * Implementa votação por estrelas (1-5) e reações emoji,
 * com deduplicação cookie-free via hash server-side.
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { hashIdentity } from '../lib/moderation.ts';
import { isPostPublicallyVisible } from '../lib/publishing.ts';
import { RatingsSchema } from '../lib/schemas.ts';

const ratings = new Hono<{ Bindings: Env }>();

// Tipos de reação válidos
const VALID_REACTIONS = ['love', 'insightful', 'thought-provoking', 'inspiring', 'beautiful'] as const;
type ReactionType = (typeof VALID_REACTIONS)[number];

// ── POST /api/ratings — Submissão/atualização de voto ───────────────────────

ratings.post('/api/ratings', async (c) => {
  try {
    const parseResult = RatingsSchema.safeParse(await c.req.json());
    if (!parseResult.success) return c.json({ error: 'Dados inválidos.' }, 400);
    const body = parseResult.data;

    if (!body.post_id) {
      return c.json({ error: 'Post ID é obrigatório.' }, 400);
    }

    if (!(await isPostPublicallyVisible(c.env.DB, body.post_id))) {
      return c.json({ error: 'Post não encontrado' }, 404);
    }

    if (!body.rating || body.rating < 1 || body.rating > 5 || !Number.isInteger(body.rating)) {
      return c.json({ error: 'Rating deve ser um inteiro entre 1 e 5.' }, 400);
    }

    // Validação de reaction_type (se fornecido)
    if (body.reaction_type && !VALID_REACTIONS.includes(body.reaction_type as ReactionType)) {
      return c.json({ error: 'Tipo de reação inválido.' }, 400);
    }

    // Gera voter_hash (cookie-free dedup via IP + UA + postId)
    const clientIp = c.req.header('cf-connecting-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    const voterHash = await hashIdentity(clientIp, userAgent, `rating:${body.post_id}`);

    // UPSERT: atualiza se já votou, insere se é novo voto
    // D1 suporta INSERT OR REPLACE com UNIQUE constraint
    await c.env.DB.prepare(
      `INSERT INTO mainsite_ratings (post_id, rating, voter_hash, reaction_type)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(post_id, voter_hash) DO UPDATE SET
         rating = excluded.rating,
         reaction_type = excluded.reaction_type`,
    )
      .bind(body.post_id, body.rating, voterHash, body.reaction_type || null)
      .run();

    // Retorna stats atualizados para feedback imediato
    const stats = await getPostRatingStats(c.env.DB, body.post_id, voterHash);

    return c.json({
      success: true,
      ...stats,
    });
  } catch (err) {
    console.error('[Ratings] Erro ao processar rating:', err);
    return c.json({ error: 'Falha ao registrar avaliação.' }, 500);
  }
});

// ── GET /api/ratings/:postId — Stats agregados (público) ────────────────────

ratings.get('/api/ratings/:postId', async (c) => {
  try {
    const postId = parseInt(c.req.param('postId'), 10);
    if (Number.isNaN(postId)) return c.json({ error: 'Post ID inválido.' }, 400);

    if (!(await isPostPublicallyVisible(c.env.DB, postId))) {
      c.header('Cache-Control', 'no-store');
      return c.json({ avgRating: 0, totalVotes: 0, userRating: null, distribution: {}, reactions: {} });
    }

    // Gera voter_hash para check "já votou?"
    const clientIp = c.req.header('cf-connecting-ip') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';
    const voterHash = await hashIdentity(clientIp, userAgent, `rating:${postId}`);

    const stats = await getPostRatingStats(c.env.DB, postId, voterHash);
    return c.json(stats);
  } catch (err) {
    console.error('[Ratings] Erro ao buscar stats:', err);
    return c.json({ avgRating: 0, totalVotes: 0, userRating: null, distribution: {}, reactions: {} });
  }
});

// ── Helper: calcula stats completos de um post ──────────────────────────────

async function getPostRatingStats(db: D1Database, postId: number, voterHash: string) {
  // Stats gerais
  const aggregate = await db
    .prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as total_votes FROM mainsite_ratings WHERE post_id = ?')
    .bind(postId)
    .first<{ avg_rating: number | null; total_votes: number }>();

  // Distribuição por estrela (1-5)
  const { results: distResults } = await db
    .prepare('SELECT rating, COUNT(*) as count FROM mainsite_ratings WHERE post_id = ? GROUP BY rating ORDER BY rating')
    .bind(postId)
    .all();

  const distribution: Record<number, number> = {};
  for (const row of (distResults || []) as Array<{ rating: number; count: number }>) {
    distribution[row.rating] = row.count;
  }

  // Contagem por tipo de reação
  const { results: reactionResults } = await db
    .prepare(
      `SELECT reaction_type, COUNT(*) as count
     FROM mainsite_ratings
     WHERE post_id = ? AND reaction_type IS NOT NULL
     GROUP BY reaction_type`,
    )
    .bind(postId)
    .all();

  const reactions: Record<string, number> = {};
  for (const row of (reactionResults || []) as Array<{ reaction_type: string; count: number }>) {
    reactions[row.reaction_type] = row.count;
  }

  // Voto do visitante atual (se já votou)
  const userVote = await db
    .prepare('SELECT rating, reaction_type FROM mainsite_ratings WHERE post_id = ? AND voter_hash = ?')
    .bind(postId, voterHash)
    .first<{ rating: number; reaction_type: string | null }>();

  return {
    avgRating: aggregate?.avg_rating ? Math.round(aggregate.avg_rating * 10) / 10 : 0,
    totalVotes: aggregate?.total_votes || 0,
    distribution,
    reactions,
    userRating: userVote?.rating || null,
    userReaction: userVote?.reaction_type || null,
  };
}

export default ratings;
