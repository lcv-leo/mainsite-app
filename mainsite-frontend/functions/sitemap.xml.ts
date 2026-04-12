// Módulo: mainsite-frontend/functions/sitemap.xml.js
// Versão: v2.0.0
// Repassa o User-Agent original para manter compatibilidade com detecção de bots.

import type { D1Database, EventContext } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

export async function onRequest(context: EventContext<Env, string, Record<string, unknown>>) {
  try {
    const db = context.env.DB;

    // Busca todos os posts publicados, ordenados pelo mais recente
    const { results } = await db.prepare(
      'SELECT id, author, created_at FROM mainsite_posts ORDER BY created_at DESC'
    ).all<{ id: number; author: string; created_at: string }>();

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
        'Cache-Control': 'public, max-age=3600',
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