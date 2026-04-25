import type { D1Database } from '@cloudflare/workers-types';

export type PublishingMode = 'normal' | 'hidden';

interface PublishingPayload {
  mode?: unknown;
}

export interface PublicPostRow {
  id: number;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface PublicAuthorPostRow {
  id: number;
  title: string;
  author: string;
  created_at: string;
  content: string;
}

export async function readPublishingMode(db: D1Database): Promise<PublishingMode> {
  try {
    const row = await db
      .prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/publishing' LIMIT 1")
      .first<{ payload?: string }>();

    if (!row?.payload) return 'normal';

    const parsed = JSON.parse(row.payload) as PublishingPayload;
    return parsed.mode === 'hidden' ? 'hidden' : 'normal';
  } catch {
    return 'normal';
  }
}

export async function isPublicPublishingEnabled(db: D1Database): Promise<boolean> {
  return (await readPublishingMode(db)) === 'normal';
}

export async function getPublicPostById(db: D1Database, postId: string | number): Promise<PublicPostRow | null> {
  if (!(await isPublicPublishingEnabled(db))) return null;

  return await db
    .prepare(
      `SELECT id, title, content, author, created_at, updated_at
       FROM mainsite_posts
       WHERE id = ? AND is_published = 1`,
    )
    .bind(postId)
    .first<PublicPostRow>();
}

export async function listPublicPosts(db: D1Database, limit?: number): Promise<PublicPostRow[]> {
  if (!(await isPublicPublishingEnabled(db))) return [];

  const statement =
    typeof limit === 'number'
      ? db
          .prepare(
            `SELECT id, title, content, author, created_at, updated_at
             FROM mainsite_posts
             WHERE is_published = 1
             ORDER BY created_at DESC
             LIMIT ?`,
          )
          .bind(limit)
      : db.prepare(
          `SELECT id, title, content, author, created_at, updated_at
           FROM mainsite_posts
           WHERE is_published = 1
           ORDER BY created_at DESC`,
        );

  const { results } = await statement.all<PublicPostRow>();
  return results || [];
}

export async function listPublicAuthorPosts(db: D1Database): Promise<PublicAuthorPostRow[]> {
  if (!(await isPublicPublishingEnabled(db))) return [];

  const { results } = await db
    .prepare(
      `SELECT id, title, author, created_at, content
       FROM mainsite_posts
       WHERE is_published = 1
       ORDER BY created_at DESC`,
    )
    .all<PublicAuthorPostRow>();

  return results || [];
}
