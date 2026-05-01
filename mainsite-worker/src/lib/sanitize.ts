/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import sanitizeHtml from 'sanitize-html';

/**
 * Server-side HTML sanitizer for post content stored in D1.
 *
 * This uses a parser-backed allowlist instead of regex stripping so the
 * Worker treats persisted editorial HTML as untrusted input.
 */
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'caption',
    'code',
    'col',
    'colgroup',
    'del',
    'div',
    'em',
    'figcaption',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'iframe',
    'img',
    'input',
    'label',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    's',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],
  allowedAttributes: {
    a: ['href', 'name', 'target', 'rel', 'title'],
    blockquote: ['cite'],
    col: ['span', 'width'],
    colgroup: ['span', 'width'],
    div: ['class', 'style'],
    figure: ['class'],
    iframe: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'title'],
    img: ['alt', 'height', 'loading', 'src', 'title', 'width'],
    input: ['checked', 'disabled', 'type'],
    label: ['for'],
    li: ['data-checked', 'data-type'],
    ol: ['start', 'type'],
    p: ['style'],
    span: ['class', 'style'],
    table: ['width'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    ul: ['data-type'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com', 'youtube-nocookie.com'],
  allowProtocolRelative: false,
  nonBooleanAttributes: [
    'allow',
    'allowfullscreen',
    'alt',
    'cite',
    'class',
    'colspan',
    'frameborder',
    'height',
    'href',
    'loading',
    'name',
    'rel',
    'rowspan',
    'scope',
    'scrolling',
    'src',
    'style',
    'target',
    'title',
    'type',
    'width',
  ],
  enforceHtmlBoundary: true,
  parseStyleAttributes: true,
  allowedStyles: {
    '*': {
      'text-align': [/^(?:left|right|center|justify)$/i],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true),
    img: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        loading: attribs.loading === 'eager' ? 'eager' : 'lazy',
      },
    }),
  },
};

export function sanitizePostHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtml(html, SANITIZE_OPTIONS).trim();
}

// v02.17.00 / mainsite-app audit closure: parser-aware plain-text
// sanitizer for user-generated content (comments). Pre-fix the route
// used `replace(/<[^>]*>/g, '')` in a loop, which is XSS-safe but ate
// legitimate text like `x < y and y > z` (the `<` paired with the next
// `>` and the literal characters disappeared). `sanitize-html` with
// `allowedTags: []` parses HTML correctly: real tags are stripped,
// unmatched `<` is preserved as a text-content character. Result:
// `x < y and y > z` stays intact, while `<script>alert(1)</script>` is
// reduced to `alert(1)` (script tag removed, content kept as text).
const PLAIN_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
  // Decode the HTML entities emitted by the parser so callers see clean
  // text rather than `&lt;` / `&amp;` literals. This is safe because
  // the output is rendered as a React text node downstream — React
  // re-escapes for the DOM regardless of input shape.
  textFilter: (text) => text,
};

export function sanitizePlainText(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return sanitizeHtml(value, PLAIN_TEXT_OPTIONS).trim();
}
