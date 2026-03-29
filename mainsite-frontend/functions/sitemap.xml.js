// Módulo: mainsite-frontend/functions/sitemap.xml.js
// Versão: v2.0.0
// Descrição: Gera o sitemap.xml diretamente via binding D1, sem proxy para URL externa.
// Repassa o User-Agent original para manter compatibilidade com detecção de bots.

export async function onRequest(context) {
  try {
    const db = context.env.DB;

    // Busca todos os posts publicados, ordenados pelo mais recente
    const { results } = await db.prepare(
      'SELECT id, created_at FROM mainsite_posts ORDER BY created_at DESC'
    ).all();

    const siteUrl = 'https://www.lcv.rio.br';

    // Monta o XML do sitemap
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Página principal
    xml += '  <url>\n';
    xml += `    <loc>${siteUrl}/</loc>\n`;
    xml += '    <changefreq>daily</changefreq>\n';
    xml += '    <priority>1.0</priority>\n';
    xml += '  </url>\n';

    // Cada post publicado
    for (const post of results || []) {
      const lastmod = post.created_at
        ? new Date(post.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      xml += '  <url>\n';
      xml += `    <loc>${siteUrl}/p/${post.id}</loc>\n`;
      xml += `    <lastmod>${lastmod}</lastmod>\n`;
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '    <priority>0.8</priority>\n';
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
  } catch (err) {
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