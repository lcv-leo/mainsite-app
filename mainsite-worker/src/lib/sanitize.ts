/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Server-side HTML sanitizer for post content stored in D1.
 *
 * Cloudflare Workers have no DOM, so DOMPurify is unavailable.
 * This regex-based sanitizer strips the highest-risk XSS vectors:
 *   • Executable tags: <script>, <style>, <iframe>, <object>, <embed>,
 *     <applet>, <form>, <input>, <base>, <meta>, <link rel=stylesheet>
 *   • Inline event handlers: onclick, onerror, onload, …
 *   • javascript: and data: URLs in href/src/action attributes
 *
 * Intentionally permissive for trusted admin content: safe structural
 * tags (p, h1-h6, ul, ol, a, img, table, …) are preserved intact.
 * Defense-in-depth — admin is already behind CF Access JWT validation.
 */

// Tags whose presence is always dangerous
const DANGEROUS_TAG_RE =
  /<\/?\s*(?:script|style|iframe|frame|frameset|object|embed|applet|form|input|button|select|textarea|base|meta|link)\b[^>]*>/gi;

// Inline event handlers: on[a-z]+ = "..." or '...' or bare value
const EVENT_HANDLER_RE = /\s+on[a-z][a-z0-9]*\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi;

// javascript: / data: / vbscript: in href, src, action, formaction
const JS_URL_ATTR_RE =
  /\s+(?:href|src|action|formaction|xlink:href|data)\s*=\s*(?:"(?:javascript|data|vbscript):[^"]*"|'(?:javascript|data|vbscript):[^']*')/gi;

/**
 * Strips dangerous HTML constructs from admin-created post content.
 * Safe for storage in D1 and subsequent rendering on the mainsite.
 */
export function sanitizePostHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return html
    .replace(DANGEROUS_TAG_RE, '')
    .replace(EVENT_HANDLER_RE, '')
    .replace(JS_URL_ATTR_RE, '');
}
