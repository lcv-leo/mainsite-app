// Módulo: mainsite-frontend/functions/feed.xml.ts
// Descrição: Feed RSS 2.0 dos ensaios mais recentes, gerado a partir do D1.
// Limita aos 30 posts mais recentes (suficiente para agregadores e bots de IA).
// Cache de 1h no edge.

import type { D1Database, EventContext } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

interface PostRow {
  id: number;
  title: string;
  content: string;
  author: string;
  created_at: string;
  updated_at: string;
}

const SITE_URL = 'https://www.reflexosdaalma.blog';
const SITE_TITLE = 'Reflexos da Alma';
const SITE_DESCRIPTION = 'Abstrações de uma mente em constante autorreflexão. Textos, ensaios e explorações filosóficas.';
const FEED_LIMIT = 30;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRfc822(raw: string | null | undefined): string {
  const date = raw ? new Date(raw.replace(' ', 'T') + (raw.includes('Z') ? '' : 'Z')) : new Date();
  return date.toUTCString();
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

export async function onRequest(context: EventContext<Env, string, Record<string, unknown>>) {
  try {
    const db = context.env.DB;
    const { results } = await db
      .prepare('SELECT id, title, content, author, created_at, updated_at FROM mainsite_posts ORDER BY created_at DESC LIMIT ?')
      .bind(FEED_LIMIT)
      .all<PostRow>();

    const lastBuildDate = toRfc822(results?.[0]?.updated_at || results?.[0]?.created_at || null);

    const items = (results || []).map((post) => {
      const link = `${SITE_URL}/p/${post.id}`;
      const description = stripHtml(post.content || '').substring(0, 500);
      const author = (post.author || 'Leonardo Cardozo Vargas').trim();
      return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${toRfc822(post.created_at)}</pubDate>
      <dc:creator>${escapeXml(author)}</dc:creator>
      <description>${escapeXml(description)}</description>
    </item>`;
    }).join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
    <language>pt-BR</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESCRIPTION)}</description>
  </channel>
</rss>`;
    return new Response(fallback, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
    });
  }
}
