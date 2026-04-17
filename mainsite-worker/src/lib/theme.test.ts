import { describe, expect, it } from 'vitest';
import { buildThemeStylesheet, normalizeThemeSettings } from './theme.ts';

describe('theme helpers', () => {
  it('normalizes unsupported values back to safe defaults', () => {
    const normalized = normalizeThemeSettings({
      light: {
        bgColor: 'javascript:alert(1)',
        bgImage: 'javascript:alert(1)',
      },
      shared: {
        fontFamily: 'evil-font',
        textAlign: 'center',
        contentMaxWidth: 'calc(100vw)',
      },
    });

    expect(normalized.light.bgColor).toBe('#f8f9fa');
    expect(normalized.light.bgImage).toBe('');
    expect(normalized.shared.fontFamily).toBe("'Inter', system-ui, -apple-system, sans-serif");
    expect(normalized.shared.textAlign).toBe('justify');
    expect(normalized.shared.contentMaxWidth).toBe('1126px');
  });

  it('builds a safe stylesheet from normalized settings', () => {
    const css = buildThemeStylesheet(normalizeThemeSettings({
      dark: { bgColor: '#111111', titleColor: '#abcdef' },
      shared: { fontSize: '1.2rem', fontFamily: 'sans-serif' },
    }));

    expect(css).toContain('--site-bg-color: #111111;');
    expect(css).toContain('--site-title-color: #abcdef;');
    expect(css).toContain('--site-font-size: 1.2rem;');
    expect(css).toContain('--site-font-family: sans-serif;');
  });
});
