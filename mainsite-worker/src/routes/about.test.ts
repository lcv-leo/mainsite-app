import { describe, expect, it } from 'vitest';
import type { Env } from '../env.ts';
import about from './about.ts';

const mockEnv = (row: Record<string, unknown> | null, options?: { missingTable?: boolean }) =>
  ({
    DB: {
      prepare() {
        return {
          async first() {
            if (options?.missingTable) {
              throw new Error('D1_ERROR: no such table: mainsite_about');
            }
            return row;
          },
        };
      },
    },
  }) as unknown as Env;

describe('GET /api/about', () => {
  it('returns null when the about row does not exist', async () => {
    const res = await about.request('/api/about', {}, mockEnv(null));
    const body = (await res.json()) as { about: unknown };

    expect(res.status).toBe(200);
    expect(body.about).toBeNull();
  });

  it('returns null when the table does not exist yet', async () => {
    const res = await about.request('/api/about', {}, mockEnv(null, { missingTable: true }));
    const body = (await res.json()) as { about: unknown };

    expect(res.status).toBe(200);
    expect(body.about).toBeNull();
  });

  it('returns normalized about content', async () => {
    const res = await about.request(
      '/api/about',
      {},
      mockEnv({
        id: 1,
        title: ' Sobre Este Site ',
        content: ' <p>Texto</p> ',
        author: ' Leonardo ',
        source_post_id: 7,
        created_at: '2026-04-24 12:00:00',
        updated_at: '2026-04-24 13:00:00',
      }),
    );
    const body = (await res.json()) as { about: { title: string; content: string; author: string; source_post_id: number } };

    expect(res.status).toBe(200);
    expect(body.about.title).toBe('Sobre Este Site');
    expect(body.about.content).toBe('<p>Texto</p>');
    expect(body.about.author).toBe('Leonardo');
    expect(body.about.source_post_id).toBe(7);
  });
});
