import { describe, expect, it } from 'vitest';
import { sanitizePostHtml } from './sanitize.ts';

describe('sanitizePostHtml', () => {
  it('removes executable payloads and unsafe URLs', () => {
    const input = '<p onclick="alert(1)">Oi</p><script>alert(1)</script><a href="javascript:alert(2)">link</a><img src="data:text/html;base64,abc" onerror="alert(3)">';
    const output = sanitizePostHtml(input);

    expect(output).toContain('<p>Oi</p>');
    expect(output).not.toContain('onclick');
    expect(output).not.toContain('<script');
    expect(output).not.toContain('javascript:');
    expect(output).not.toContain('data:text/html');
    expect(output).not.toContain('onerror');
  });

  it('preserves trusted editorial structures', () => {
    const input = '<figure class="tiptap-figure"><img src="https://cdn.example.com/a.jpg" alt="A" width="640"><figcaption>Legenda</figcaption></figure><p style="text-align:center">Centro</p>';
    const output = sanitizePostHtml(input);

    expect(output).toContain('figure');
    expect(output).toContain('figcaption');
    expect(output).toContain('text-align:center');
    expect(output).toContain('loading="lazy"');
  });
});
