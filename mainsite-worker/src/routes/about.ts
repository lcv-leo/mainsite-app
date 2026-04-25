/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rota pública da página institucional "Sobre Este Site".
 * Domínio: /api/about
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { structuredLog } from '../lib/logger.ts';

const about = new Hono<{ Bindings: Env }>();

type AboutRow = {
  id?: number;
  title?: string;
  content?: string;
  author?: string;
  source_post_id?: number | null;
  created_at?: string;
  updated_at?: string | null;
};

const isMissingTableError = (error: unknown) =>
  error instanceof Error && /no such table/i.test(error.message);

const mapAboutRow = (row: AboutRow | null) => {
  if (!row) return null;
  return {
    id: 1,
    title: String(row.title ?? '').trim(),
    content: String(row.content ?? '').trim(),
    author: String(row.author ?? '').trim(),
    source_post_id: row.source_post_id ?? null,
    created_at: String(row.created_at ?? '').trim(),
    updated_at: row.updated_at ? String(row.updated_at).trim() : null,
  };
};

async function readAbout(db: D1Database) {
  try {
    const row = await db
      .prepare(
        `SELECT id, title, content, author, source_post_id, created_at, updated_at
         FROM mainsite_about
         WHERE id = 1
         LIMIT 1`,
      )
      .first<AboutRow>();
    return mapAboutRow(row);
  } catch (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

about.get('/api/about', async (c) => {
  try {
    const result = await readAbout(c.env.DB);
    return c.json({ about: result });
  } catch (err) {
    structuredLog('error', '[About] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default about;
