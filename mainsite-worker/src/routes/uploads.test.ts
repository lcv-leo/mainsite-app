import { describe, expect, it } from 'vitest';
import type { Env } from '../env.ts';
import uploads from './uploads.ts';

function mockEnvForUploads(): Env {
  return {
    CLOUDFLARE_PW: 'secret',
    BUCKET: {
      async get(key: string) {
        if (key !== 'legacy.svg' && key !== 'brands/legacy.svg') return null;
        return {
          httpEtag: '"svg-etag"',
          body: new Response('<svg><script>alert(1)</script></svg>').body,
          writeHttpMetadata(headers: Headers) {
            headers.set('Content-Type', 'image/svg+xml');
          },
        };
      },
      async put() {
        return null;
      },
    },
  } as unknown as Env;
}

describe('uploads security hardening', () => {
  it('rejects new SVG uploads', async () => {
    const form = new FormData();
    form.set('file', new File(['<svg />'], 'unsafe.svg', { type: 'image/svg+xml' }));

    const res = await uploads.request(
      '/api/upload',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer secret' },
        body: form,
      },
      mockEnvForUploads(),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('Tipo de arquivo não permitido'),
    });
  });

  it('serves legacy SVG objects with sandbox CSP', async () => {
    const res = await uploads.request('/api/uploads/legacy.svg', {}, mockEnvForUploads());

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
  });
});
