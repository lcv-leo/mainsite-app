import { describe, expect, it } from 'vitest';
import { getAllowedOrigin } from './origins.ts';

describe('getAllowedOrigin', () => {
  it('allows configured public HTTPS origins', () => {
    expect(getAllowedOrigin('https://www.reflexosdaalma.blog')).toBe('https://www.reflexosdaalma.blog');
    expect(getAllowedOrigin('https://lcv.rio.br')).toBe('https://lcv.rio.br');
  });

  it('rejects configured hostnames over plain HTTP', () => {
    expect(getAllowedOrigin('http://www.reflexosdaalma.blog')).toBeNull();
  });

  it('rejects unknown or malformed origins', () => {
    expect(getAllowedOrigin('https://example.com')).toBeNull();
    expect(getAllowedOrigin('not-a-url')).toBeNull();
  });
});
