import { describe, expect, it } from 'vitest';
import type { Env } from '../env.ts';
import ratings from './ratings.ts';

describe('GET /api/ratings/:postId', () => {
  it('returns 400 for non-numeric postId', async () => {
    const mockEnv = {} as Env;
    const res = await ratings.request('/api/ratings/abc', {}, mockEnv);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Post ID inválido.');
  });
});
