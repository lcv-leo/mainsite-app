import type { D1Database } from '@cloudflare/workers-types';
import { describe, expect, it } from 'vitest';
import { getPublicPostById, listPublicAuthorPosts, listPublicPosts, readPublishingMode } from './publishing';

interface MockPost {
  id: number;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
  is_published: number;
}

interface MockDbOptions {
  mode?: 'normal' | 'hidden' | 'broken';
  posts?: MockPost[];
}

function createMockDb(options: MockDbOptions = {}): D1Database {
  const posts = options.posts || [];
  const mode = options.mode || 'normal';

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const statement = {
        bind(...args: unknown[]) {
          bound = args;
          return statement;
        },
        async first<T>() {
          if (sql.includes('mainsite_settings')) {
            if (mode === 'broken') return { payload: '{broken' } as T;
            return { payload: JSON.stringify({ mode }) } as T;
          }

          if (sql.includes('mainsite_posts') && sql.includes('WHERE id = ?')) {
            const id = Number(bound[0]);
            const post = posts.find((item) => item.id === id && item.is_published === 1);
            return (post || null) as T | null;
          }

          return null;
        },
        async all<T>() {
          const visible = posts.filter((item) => item.is_published === 1);
          const limit = typeof bound[0] === 'number' ? bound[0] : visible.length;
          return { results: visible.slice(0, limit) as T[] };
        },
      };
      return statement;
    },
  } as unknown as D1Database;
}

const publishedPost: MockPost = {
  id: 1,
  title: 'Publicado',
  content: '<p>texto publico</p>',
  author: 'Leonardo Cardozo Vargas',
  created_at: '2026-04-24 12:00:00',
  updated_at: '2026-04-24 12:00:00',
  is_published: 1,
};

const unpublishedPost: MockPost = {
  ...publishedPost,
  id: 2,
  title: 'Oculto',
  content: '<p>segredo</p>',
  is_published: 0,
};

describe('Pages Functions publishing guard', () => {
  it('reads hidden mode from mainsite/publishing', async () => {
    await expect(readPublishingMode(createMockDb({ mode: 'hidden' }))).resolves.toBe('hidden');
  });

  it('fails open to normal mode for malformed settings payloads', async () => {
    await expect(readPublishingMode(createMockDb({ mode: 'broken' }))).resolves.toBe('normal');
  });

  it('does not return posts while global publishing mode is hidden', async () => {
    const db = createMockDb({ mode: 'hidden', posts: [publishedPost] });

    await expect(getPublicPostById(db, 1)).resolves.toBeNull();
    await expect(listPublicPosts(db)).resolves.toEqual([]);
    await expect(listPublicAuthorPosts(db)).resolves.toEqual([]);
  });

  it('filters unpublished posts from direct lookup and public lists', async () => {
    const db = createMockDb({ posts: [publishedPost, unpublishedPost] });

    await expect(getPublicPostById(db, 1)).resolves.toMatchObject({ id: 1 });
    await expect(getPublicPostById(db, 2)).resolves.toBeNull();
    await expect(listPublicPosts(db)).resolves.toEqual([publishedPost]);
    await expect(listPublicAuthorPosts(db)).resolves.toEqual([publishedPost]);
  });
});
