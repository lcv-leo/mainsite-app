import { describe, it, expect } from 'vitest'
import type { Env } from '../env.ts'
import comments from './comments.ts'

describe('GET /api/comments/config', () => {
  it('returns safe defaults when DB is unavailable', async () => {
    const mockEnv = {
      DB: {
        prepare: () => { throw new Error('DB unavailable') },
      },
    } as unknown as Env

    const res = await comments.request('/api/comments/config', {}, mockEnv)
    expect(res.status).toBe(200)
    const body = await res.json() as {
      commentsEnabled: boolean
      allowAnonymous: boolean
      requireEmail: boolean
      minCommentLength: number
      maxCommentLength: number
    }
    expect(body.commentsEnabled).toBe(true)
    expect(body.allowAnonymous).toBe(true)
    expect(body.requireEmail).toBe(false)
    expect(body.minCommentLength).toBe(3)
    expect(body.maxCommentLength).toBe(2000)
  })
})
