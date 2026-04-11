/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * content-version.ts — Motor de fingerprint de conteúdo.
 *
 * Mantém um contador de versão atômico em `mainsite_settings` que é
 * incrementado em toda mutação de posts (CRUD, reorder, pin, rotação).
 *
 * O frontend faz polling leve em `GET /api/content-fingerprint` para
 * detectar mudanças e notificar o leitor em tempo real.
 */

const CONTENT_VERSION_KEY = 'mainsite/content-version';

interface ContentVersionPayload {
  version: number;
  updated_at: string;
}

/**
 * Incrementa o contador de versão de conteúdo.
 * Cria a row automaticamente se não existir (idempotente).
 */
export async function bumpContentVersion(db: D1Database): Promise<void> {
  try {
    const record = await db
      .prepare(`SELECT payload FROM mainsite_settings WHERE id = ?`)
      .bind(CONTENT_VERSION_KEY)
      .first<{ payload: string }>();

    let current: ContentVersionPayload;
    if (record) {
      current = JSON.parse(record.payload) as ContentVersionPayload;
    } else {
      current = { version: 0, updated_at: new Date().toISOString() };
    }

    const next: ContentVersionPayload = {
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    };

    await db
      .prepare(
        `INSERT INTO mainsite_settings (id, payload) VALUES (?, ?)
         ON CONFLICT(id) DO UPDATE SET payload = excluded.payload`
      )
      .bind(CONTENT_VERSION_KEY, JSON.stringify(next))
      .run();
  } catch (err) {
    console.error('[mainsite-motor] [content-version] bumpContentVersion failed:', err);
  }
}

/**
 * Retorna o fingerprint atual do conteúdo:
 * - version: número incremental
 * - updated_at: timestamp ISO da última mutação
 * - headline_post_id: ID do post atualmente na primeira posição (homepage)
 */
export async function getContentFingerprint(
  db: D1Database
): Promise<{ version: number; updated_at: string; headline_post_id: number | null }> {
  // Lê versão
  const record = await db
    .prepare(`SELECT payload FROM mainsite_settings WHERE id = ?`)
    .bind(CONTENT_VERSION_KEY)
    .first<{ payload: string }>();

  let version = 0;
  let updated_at = new Date().toISOString();

  if (record) {
    try {
      const parsed = JSON.parse(record.payload) as ContentVersionPayload;
      version = parsed.version;
      updated_at = parsed.updated_at;
    } catch {
      // payload corrupto — retorna defaults
    }
  }

  // Lê o post que está na homepage (primeiro pela ordem de exibição)
  const headlineRow = await db
    .prepare(
      `SELECT id FROM mainsite_posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC LIMIT 1`
    )
    .first<{ id: number }>();

  return {
    version,
    updated_at,
    headline_post_id: headlineRow?.id ?? null,
  };
}
