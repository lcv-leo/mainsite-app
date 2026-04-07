// Módulo: mainsite-frontend/functions/[[path]].js
// Descrição: Edge pre-rendering via Cloudflare HTMLRewriter.
// Intercepta respostas HTML para injetar dinamicamente:
//   1. Open Graph + Twitter Card meta tags (para WhatsApp, Facebook, Twitter)
//   2. Schema.org JSON-LD (Article, BreadcrumbList) para AI-era visibility (GEO/AEO)
//   3. Canonical URL corrigida por post
// Lê dados diretamente do D1 via binding DB, sem chamada a URL externa.

import type { D1Database, EventContext, Element } from '@cloudflare/workers-types';

interface Env {
  DB: D1Database;
}

// HTMLRewriter é um global do runtime Cloudflare Pages — não exportado como valor pelo @cloudflare/workers-types
declare const HTMLRewriter: {
  new (): import('@cloudflare/workers-types').HTMLRewriter;
};

export async function onRequest(context: EventContext<Env, string, Record<string, unknown>>) {
  const url = new URL(context.request.url);

  // Segurança & SEO: Nunca vazar url interna final no Google
  // O mainsite tem múltiplos domínios (lcv.rio.br, cardozovargas.com, etc.), servindo tudo transparente.
  // Requisições diretas ao origin host (*.pages.dev) devem ser redirecionadas (301) ao domínio principal.
  if (url.hostname.endsWith('.pages.dev')) {
    return Response.redirect(`https://reflexosdaalma.blog${url.pathname}${url.search}`, 301);
  }

  // Bypass para sitemap — /functions/sitemap.xml.js gera o sitemap dinâmico
  if (url.pathname === '/sitemap.xml') {
    return context.next();
  }

  // Bypass para rotas de API — deve ficar ANTES da checagem de extensão estática
  // para que URLs como /api/uploads/brands/mastercard.svg não sejam interceptadas
  // pelo handler de arquivos estáticos.
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // Bypass para arquivos estáticos com extensão conhecida.
  // Se o servidor retornar text/html para um asset (fallback SPA),
  // responde 404 limpo em vez de HTML com MIME errado.
  const isStaticFile = /\.(js|css|mjs|ts|jsx|tsx|ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|eot|map|json|txt|asc|xml|gz|br|pdf)$/i.test(url.pathname);
  if (isStaticFile) {
    const assetResponse = await context.next();
    const contentType = assetResponse.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return assetResponse;
  }

  // 1. Obtém a resposta original (index.html estático do React/Vite)
  const response = await context.next();

  const queryPostId = url.searchParams.get('p');
  const pathMatch = url.pathname.match(/^\/(?:p|post|materia|m|s)\/(\d+)\/?$/i);
  const postId = queryPostId || (pathMatch ? pathMatch[1] : null);

  // 2. Sem post ID: página inicial — HTML estático (já contém WebSite + Person JSON-LD)
  if (!postId) return response;

  try {
    // 3. Consulta D1 — inclui created_at e updated_at para Schema.org dateModified
    const db = context.env.DB;
    const post = await db
      .prepare('SELECT id, title, content, author, created_at, updated_at FROM mainsite_posts WHERE id = ?')
      .bind(postId)
      .first<{ id: number, title: string, content: string, author: string, created_at: string, updated_at: string }>();

    if (!post) return response;

    const postAuthor = (post.author || '').trim() || 'Leonardo Cardozo Vargas';

    // 4. Consulta resumo IA pré-computado para compartilhamento social
    let aiSummary = null;
    try {
      aiSummary = await db
        .prepare('SELECT summary_og, summary_ld FROM mainsite_post_ai_summaries WHERE post_id = ?')
        .bind(postId)
        .first<{ summary_og: string, summary_ld: string }>();
    } catch {
      // Tabela pode não existir ainda — fallback silencioso
    }

    // 5. Gera descrições — IA tem prioridade, fallback para strip+truncate
    const cleanBase = (post.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    const fallbackShort = `${cleanBase.substring(0, 160)}${cleanBase.length > 160 ? '...' : ''}`;
    const fallbackLong = `${cleanBase.substring(0, 300)}${cleanBase.length > 300 ? '...' : ''}`;
    const shortDesc = (aiSummary && aiSummary.summary_og) || fallbackShort;
    const longDesc = (aiSummary && (aiSummary.summary_ld || aiSummary.summary_og)) || fallbackLong;
    const wordCount = cleanBase.split(/\s+/).filter(Boolean).length;
    const pageTitle = `${post.title} | Reflexos da Alma`;
    const canonicalUrl = `https://www.reflexosdaalma.blog/p/${post.id}`;

    // 5. Calcula datas ISO 8601
    const toISO = (raw: string) => {
      if (!raw) return new Date().toISOString();
      const suffix = raw.includes('Z') || raw.includes('+') ? '' : 'Z';
      return new Date(raw.replace(' ', 'T') + suffix).toISOString();
    };
    const datePublished = toISO(post.created_at);
    const dateModified = toISO(post.updated_at || post.created_at);

    // 6. Schema.org JSON-LD — Article completo para AI crawlers (GEO/AEO)
    const articleSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": post.title,
      "description": longDesc,
      "author": {
        "@type": "Person",
        "name": postAuthor,
        "url": "https://www.reflexosdaalma.blog",
        "sameAs": [
          "https://github.com/lcv-leo",
          "https://www.linkedin.com/in/lcv-leo"
        ]
      },
      "datePublished": datePublished,
      "dateModified": dateModified,
      "publisher": {
        "@type": "Organization",
        "name": "Reflexos da Alma",
        "url": "https://www.reflexosdaalma.blog",
        "logo": { "@type": "ImageObject", "url": "https://www.reflexosdaalma.blog/favicon.svg" }
      },
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
      "inLanguage": "pt-BR",
      "articleSection": "Filosofia",
      "wordCount": wordCount,
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": [".h1-title", ".ai-summary-box", ".p-content"]
      }
    });

    // BreadcrumbList para navegação estruturada
    const breadcrumbSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://www.reflexosdaalma.blog"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": post.title,
          "item": canonicalUrl
        }
      ]
    });

    // 7. HTMLRewriter — injeta meta tags + Schema.org no edge
    return new HTMLRewriter()
      .on('title', { element(e: Element) { e.setInnerContent(pageTitle); } })
      .on('meta[property="og:type"]', { element(e: Element) { e.setAttribute('content', 'article'); } })
      .on('meta[property="og:title"]', { element(e: Element) { e.setAttribute('content', pageTitle); } })
      .on('meta[name="twitter:title"]', { element(e: Element) { e.setAttribute('content', post.title); } })
      .on('meta[property="og:description"]', { element(e: Element) { e.setAttribute('content', shortDesc); } })
      .on('meta[name="description"]', { element(e: Element) { e.setAttribute('content', shortDesc); } })
      .on('meta[name="twitter:description"]', { element(e: Element) { e.setAttribute('content', shortDesc); } })
      .on('meta[name="twitter:card"]', { element(e: Element) { e.setAttribute('content', 'summary_large_image'); } })
      .on('meta[property="og:url"]', { element(e: Element) { e.setAttribute('content', canonicalUrl); } })
      // Corrige canonical existente em vez de duplicar (fix SEO)
      .on('link[rel="canonical"]', { element(e: Element) { e.setAttribute('href', canonicalUrl); } })
      .on('head', {
        element(e: Element) {
          e.append(`<meta property="og:site_name" content="Reflexos da Alma">`, { html: true });
          e.append(`<meta property="article:published_time" content="${datePublished}">`, { html: true });
          e.append(`<meta property="article:modified_time" content="${dateModified}">`, { html: true });
          e.append(`<meta property="article:author" content="${postAuthor}">`, { html: true });
          e.append(`<meta property="article:section" content="Filosofia">`, { html: true });
          // Schema.org JSON-LD — visível para crawlers que NÃO executam JS
          e.append(`<script type="application/ld+json">${articleSchema}</script>`, { html: true });
          e.append(`<script type="application/ld+json">${breadcrumbSchema}</script>`, { html: true });
        }
      })
      .transform(response);
  } catch {
    // Em caso de falha silenciosa, a página carrega normalmente sem interromper o site.
    return response;
  }
}