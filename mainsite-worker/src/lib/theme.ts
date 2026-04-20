/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

interface ThemePalette {
  bgColor?: string;
  bgImage?: string;
  fontColor?: string;
  titleColor?: string;
}

interface ThemeSharedSettings {
  fontSize?: string;
  titleFontSize?: string;
  fontFamily?: string;
  bodyWeight?: string;
  titleWeight?: string;
  lineHeight?: string;
  textAlign?: string;
  textIndent?: string;
  paragraphSpacing?: string;
  contentMaxWidth?: string;
  linkColor?: string;
}

export interface ThemeSettings {
  allowAutoMode?: boolean;
  light?: ThemePalette;
  dark?: ThemePalette;
  shared?: ThemeSharedSettings;
}

export interface NormalizedThemeSettings {
  allowAutoMode: boolean;
  light: Required<ThemePalette>;
  dark: Required<ThemePalette>;
  shared: Required<ThemeSharedSettings>;
}

export const DEFAULT_THEME_SETTINGS: NormalizedThemeSettings = {
  allowAutoMode: true,
  light: {
    bgColor: '#f8f9fa',
    bgImage: '',
    fontColor: '#202124',
    titleColor: '#4285f4',
  },
  dark: {
    bgColor: '#16171d',
    bgImage: '',
    fontColor: '#d1d5db',
    titleColor: '#8ab4f8',
  },
  shared: {
    fontSize: '1.15rem',
    titleFontSize: '1.8rem',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    bodyWeight: '500',
    titleWeight: '700',
    lineHeight: '1.9',
    textAlign: 'justify',
    textIndent: '3.5rem',
    paragraphSpacing: '2.2rem',
    contentMaxWidth: '1126px',
    linkColor: '#4da6ff',
  },
};

const ALLOWED_FONT_FAMILIES = new Set([
  "'Inter', system-ui, -apple-system, sans-serif",
  'system-ui, -apple-system, sans-serif',
  'sans-serif',
  "'Georgia', serif",
  "'Times New Roman', Times, serif",
  "'Courier New', Courier, monospace",
  'monospace',
]);

const ALLOWED_TEXT_ALIGN = new Set(['justify', 'left']);
const LENGTH_PATTERN = /^(?:0|(?:\d+(?:\.\d+)?)(?:px|rem|em|%))$/;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const FONT_WEIGHT_PATTERN = /^(?:400|500|600|700|800|900)$/;
const LINE_HEIGHT_PATTERN = /^(?:1\.[4-9]|2(?:\.[0-4])?)$/;
const ABSOLUTE_URL_PATTERN = /^https:\/\/[^\s"'()<>]+$/i;
const RELATIVE_URL_PATTERN = /^\/[^\s"'()<>]*$/;

function escapeCssValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function sanitizeHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value.trim()) ? value.trim() : fallback;
}

function sanitizeLength(value: unknown, fallback: string): string {
  return typeof value === 'string' && LENGTH_PATTERN.test(value.trim()) ? value.trim() : fallback;
}

function sanitizeFontWeight(value: unknown, fallback: string): string {
  return typeof value === 'string' && FONT_WEIGHT_PATTERN.test(value.trim()) ? value.trim() : fallback;
}

function sanitizeLineHeight(value: unknown, fallback: string): string {
  return typeof value === 'string' && LINE_HEIGHT_PATTERN.test(value.trim()) ? value.trim() : fallback;
}

function deriveTitleWeights(value: string): { softer: string; softest: string } {
  const base = Number.parseInt(value, 10);
  if (!Number.isFinite(base)) {
    return { softer: '600', softest: '500' };
  }
  return {
    softer: String(Math.max(400, base - 100)),
    softest: String(Math.max(400, base - 200)),
  };
}

function sanitizeTextAlign(value: unknown, fallback: string): string {
  return typeof value === 'string' && ALLOWED_TEXT_ALIGN.has(value.trim()) ? value.trim() : fallback;
}

function sanitizeFontFamily(value: unknown, fallback: string): string {
  return typeof value === 'string' && ALLOWED_FONT_FAMILIES.has(value.trim()) ? value.trim() : fallback;
}

function sanitizeImageUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (ABSOLUTE_URL_PATTERN.test(trimmed) || RELATIVE_URL_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function buildBackgroundImage(url: string, fallback: string): string {
  if (!url) return fallback;
  return `url("${escapeCssValue(url)}")`;
}

export function normalizeThemeSettings(input: ThemeSettings | null | undefined): NormalizedThemeSettings {
  const source = input || {};
  return {
    allowAutoMode:
      typeof source.allowAutoMode === 'boolean' ? source.allowAutoMode : DEFAULT_THEME_SETTINGS.allowAutoMode,
    light: {
      bgColor: sanitizeHexColor(source.light?.bgColor, DEFAULT_THEME_SETTINGS.light.bgColor),
      bgImage: sanitizeImageUrl(source.light?.bgImage),
      fontColor: sanitizeHexColor(source.light?.fontColor, DEFAULT_THEME_SETTINGS.light.fontColor),
      titleColor: sanitizeHexColor(source.light?.titleColor, DEFAULT_THEME_SETTINGS.light.titleColor),
    },
    dark: {
      bgColor: sanitizeHexColor(source.dark?.bgColor, DEFAULT_THEME_SETTINGS.dark.bgColor),
      bgImage: sanitizeImageUrl(source.dark?.bgImage),
      fontColor: sanitizeHexColor(source.dark?.fontColor, DEFAULT_THEME_SETTINGS.dark.fontColor),
      titleColor: sanitizeHexColor(source.dark?.titleColor, DEFAULT_THEME_SETTINGS.dark.titleColor),
    },
    shared: {
      fontSize: sanitizeLength(source.shared?.fontSize, DEFAULT_THEME_SETTINGS.shared.fontSize),
      titleFontSize: sanitizeLength(source.shared?.titleFontSize, DEFAULT_THEME_SETTINGS.shared.titleFontSize),
      fontFamily: sanitizeFontFamily(source.shared?.fontFamily, DEFAULT_THEME_SETTINGS.shared.fontFamily),
      bodyWeight: sanitizeFontWeight(source.shared?.bodyWeight, DEFAULT_THEME_SETTINGS.shared.bodyWeight),
      titleWeight: sanitizeFontWeight(source.shared?.titleWeight, DEFAULT_THEME_SETTINGS.shared.titleWeight),
      lineHeight: sanitizeLineHeight(source.shared?.lineHeight, DEFAULT_THEME_SETTINGS.shared.lineHeight),
      textAlign: sanitizeTextAlign(source.shared?.textAlign, DEFAULT_THEME_SETTINGS.shared.textAlign),
      textIndent: sanitizeLength(source.shared?.textIndent, DEFAULT_THEME_SETTINGS.shared.textIndent),
      paragraphSpacing: sanitizeLength(source.shared?.paragraphSpacing, DEFAULT_THEME_SETTINGS.shared.paragraphSpacing),
      contentMaxWidth: sanitizeLength(source.shared?.contentMaxWidth, DEFAULT_THEME_SETTINGS.shared.contentMaxWidth),
      linkColor: sanitizeHexColor(source.shared?.linkColor, DEFAULT_THEME_SETTINGS.shared.linkColor),
    },
  };
}

export async function loadThemeSettings(db: D1Database): Promise<NormalizedThemeSettings> {
  const row = await db
    .prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/appearance'")
    .first<{ payload?: string }>();
  if (!row?.payload) return DEFAULT_THEME_SETTINGS;
  try {
    return normalizeThemeSettings(JSON.parse(row.payload) as ThemeSettings);
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

export function buildThemeStylesheet(settings: NormalizedThemeSettings): string {
  const lightDefaultPattern =
    'radial-gradient(circle at 15% 40%, rgba(26, 115, 232, 0.08), transparent 45%), radial-gradient(circle at 85% 60%, rgba(161, 66, 244, 0.08), transparent 45%)';
  const darkDefaultPattern =
    'radial-gradient(circle at 15% 40%, rgba(138, 180, 248, 0.15), transparent 45%), radial-gradient(circle at 85% 60%, rgba(197, 138, 248, 0.15), transparent 45%)';
  const titleWeights = deriveTitleWeights(settings.shared.titleWeight);

  return [
    '.site-shell {',
    `  --site-font-size: ${settings.shared.fontSize};`,
    `  --site-title-font-size: ${settings.shared.titleFontSize};`,
    `  --site-font-family: ${settings.shared.fontFamily};`,
    `  --site-body-weight: ${settings.shared.bodyWeight};`,
    `  --site-title-weight: ${settings.shared.titleWeight};`,
    `  --site-title-weight-soft: ${titleWeights.softer};`,
    `  --site-title-weight-softest: ${titleWeights.softest};`,
    `  --site-line-height: ${settings.shared.lineHeight};`,
    `  --site-text-align: ${settings.shared.textAlign};`,
    `  --site-text-indent: ${settings.shared.textIndent};`,
    `  --site-paragraph-spacing: ${settings.shared.paragraphSpacing};`,
    `  --site-content-max-width: ${settings.shared.contentMaxWidth};`,
    `  --site-link-color: ${settings.shared.linkColor};`,
    '}',
    '.site-shell.theme-light {',
    `  --site-bg-color: ${settings.light.bgColor};`,
    `  --site-bg-image: ${buildBackgroundImage(settings.light.bgImage, lightDefaultPattern)};`,
    `  --site-font-color: ${settings.light.fontColor};`,
    `  --site-title-color: ${settings.light.titleColor};`,
    '}',
    '.site-shell.theme-dark {',
    `  --site-bg-color: ${settings.dark.bgColor};`,
    `  --site-bg-image: ${buildBackgroundImage(settings.dark.bgImage, darkDefaultPattern)};`,
    `  --site-font-color: ${settings.dark.fontColor};`,
    `  --site-title-color: ${settings.dark.titleColor};`,
    '}',
  ].join('\n');
}
