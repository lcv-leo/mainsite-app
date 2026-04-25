// Módulo: mainsite-frontend/functions/sitemap.xml.js
// Versão: v2.0.0
// Repassa o User-Agent original para manter compatibilidade com detecção de bots.

import type { D1Database, EventContext } from '@cloudflare/workers-types';
import { listPublicPosts } from './_lib/publishing';

interface Env {
  DB: D1Database;
}

export async function onRequest(context: EventContext<Env, string, Record<string, unknown>>) {
  try {
    const db = context.env.DB;

    // Busca somente posts publicamente visíveis, ordenados pelo mais recente.
    const results = await listPublicPosts(db);

    let hasAboutContent = false;
    try {
      const about = await db
        .prepare('SELECT content FROM mainsite_about WHERE id = 1 LIMIT 1')
        .first<{ content?: string }>();
      hasAboutContent = Boolean(about?.content && about.content.trim().length > 0);
    } catch {
      hasAboutContent = false;
    }

    const siteUrl = 'https://www.reflexosdaalma.blog';

    const nameToSlug = (name: string): string =>
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Monta o XML do sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n';

    // Página principal
    xml += '  <url>\n';
    xml += `    <loc>${siteUrl}/</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += `    <xhtml:link rel="alternate" hreflang="pt-BR" href="${siteUrl}/" />\n`;
    xml += `    <xhtml:link rel="alternate" hreflang="x-default" href="${siteUrl}/" />\n`;
    xml += '  </url>\n';

    // Feed RSS
    xml += '  <url>\n';
    xml += `    <loc>${siteUrl}/feed.xml</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>0.6</priority>\n';
    xml += '  </url>\n';

    if (hasAboutContent) {
      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}/sobre-este-site</loc>\n`;
      xml += '    <changefreq>monthly</changefreq>\n';
      xml += '    <priority>0.5</priority>\n';
      xml += `    <xhtml:link rel="alternate" hreflang="pt-BR" href="${siteUrl}/sobre-este-site" />\n`;
      xml += '  </url>\n';
    }

    // Páginas de autor (uma por autor único)
    const authorSlugs = new Set<string>();
    for (const post of results || []) {
      const author = (post.author || 'Leonardo Cardozo Vargas').trim();
      const slug = nameToSlug(author);
      if (slug && !authorSlugs.has(slug)) {
        authorSlugs.add(slug);
        xml += '  <url>\n';
        xml += `    <loc>${siteUrl}/autor/${slug}</loc>\n`;
        xml += '    <changefreq>weekly</changefreq>\n';
        xml += '    <priority>0.7</priority>\n';
        xml += '  </url>\n';
      }
    }

    // Cada post publicado
    for (const post of results || []) {
      const lastmod = post.created_at
        ? new Date(post.created_at as string).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}/p/${post.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += `    <xhtml:link rel="alternate" hreflang="pt-BR" href="${siteUrl}/p/${post.id}" />\n`;
      xml += '  </url>\n';
    }

    xml += '</urlset>';

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });
  } catch {
    // Fallback: XML vazio mas válido
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        status: 200,
        headers: { 'Content-Type': 'application/xml; charset=utf-8' },
      }
    );
  }
}
