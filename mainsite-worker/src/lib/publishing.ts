/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * publishing.ts — Kill switch e visibilidade de posts do mainsite.
 *
 * Duas camadas de controle (ambas devem permitir para um texto aparecer):
 *   - Geral: chave `mainsite/publishing` em mainsite_settings, mode ∈ {'normal','hidden'}.
 *           Quando 'hidden', NENHUM texto é servido por nenhuma rota pública.
 *   - Individual: coluna `is_published` em mainsite_posts. is_published=0 oculta o post.
 *
 * Regra de precedência: um texto só é visível publicamente quando
 *   mode='normal' E is_published=1.
 *
 * Todas as rotas do worker que leem mainsite_posts OU mainsite_post_ai_summaries
 * DEVEM consultar readPublishingMode antes de responder e filtrar pelo
 * is_published ativo. Isto é especialmente crítico em endpoints consumidos
 * por crawlers (OG/Open Graph, JSON-LD, sitemap) — vazamento ali permite
 * que conteúdo oculto apareça em previews de rede social.
 */

export type PublishingMode = 'normal' | 'hidden';

export interface PublishingNotice {
  mode: PublishingMode;
  notice_title: string;
  notice_message: string;
}

const DEFAULT_NOTICE: PublishingNotice = {
  mode: 'normal',
  notice_title: '',
  notice_message: '',
};

const stripAllHtml = (raw: string): string => {
  let previous: string;
  let current = raw;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, '');
  } while (current !== previous);
  return current.replace(/[<>]/g, '');
};

export async function readPublishing(db: D1Database): Promise<PublishingNotice> {
  try {
    const row = await db
      .prepare('SELECT payload FROM mainsite_settings WHERE id = ? LIMIT 1')
      .bind('mainsite/publishing')
      .first<{ payload: string }>();

    if (!row?.payload) return DEFAULT_NOTICE;

    const parsed = JSON.parse(row.payload) as Partial<PublishingNotice>;
    const mode: PublishingMode = parsed.mode === 'hidden' ? 'hidden' : 'normal';
    // Defesa-em-profundidade: refaz o strip mesmo já tendo sido feito no admin-motor.
    const notice_title = stripAllHtml(String(parsed.notice_title ?? '')).trim();
    const notice_message = stripAllHtml(String(parsed.notice_message ?? ''));
    return { mode, notice_title, notice_message };
  } catch {
    return DEFAULT_NOTICE;
  }
}

export async function readPublishingMode(db: D1Database): Promise<PublishingMode> {
  const { mode } = await readPublishing(db);
  return mode;
}

export function isHidden(notice: Pick<PublishingNotice, 'mode'>): boolean {
  return notice.mode === 'hidden';
}

/**
 * Retorna true se o post está acessível ao público: kill switch global
 * `mode='normal'` AND `is_published=1` da linha em `mainsite_posts`.
 * Usado por todas as rotas que expõem interações vinculadas a um post específico
 * (comments, ratings, share email) — evita vazamento de existência do post via
 * contagem, listagem derivada ou confirmação de POST aceito.
 */
export async function isPostPublicallyVisible(db: D1Database, postId: number): Promise<boolean> {
  const mode = await readPublishingMode(db);
  if (mode === 'hidden') return false;
  const row = await db
    .prepare('SELECT is_published FROM mainsite_posts WHERE id = ? LIMIT 1')
    .bind(postId)
    .first<{ is_published: number }>();
  if (!row) return false;
  return Number(row.is_published ?? 1) !== 0;
}
