// Módulo: mainsite-frontend/functions/autor/[slug].ts
// Descrição: Página de autor server-rendered (SSR no edge), independente da SPA.
// Responde GET /autor/{slug} com HTML completo + JSON-LD CollectionPage / ProfilePage,
// listando todos os posts daquele autor. Bots de IA e humanos veem o mesmo conteúdo.
// Cache de 1h no edge.

import type { D1Database, EventContext, Params } from '@cloudflare/workers-types';
import { listPublicAuthorPosts } from '../_lib/publishing';

interface Env {
  DB: D1Database;
}

const SITE_URL = 'https://www.reflexosdaalma.blog';
const SITE_NAME = 'Reflexos da Alma';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugToName(slug: string): string {
  return decodeURIComponent(slug)
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function formatDate(raw: string): string {
  if (!raw) return '';
  const date = new Date(raw.replace(' ', 'T') + (raw.includes('Z') ? '' : 'Z'));
  return date.toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: '2-digit' });
}

export async function onRequest(context: EventContext<Env, 'slug', Params<'slug'>>) {
  const slugParam = context.params.slug;
  const slug = Array.isArray(slugParam) ? slugParam[0] : slugParam;
  if (!slug) return new Response('Not Found', { status: 404 });

  try {
    const db = context.env.DB;
    const allPosts = await listPublicAuthorPosts(db);
    const candidates = allPosts.filter((p) => nameToSlug(p.author || '') === slug);
    if (candidates.length === 0) return new Response('Author Not Found', { status: 404 });

    const authorName = candidates[0].author || slugToName(slug);
    const pageUrl = `${SITE_URL}/autor/${slug}`;
    const pageTitle = `${authorName} | ${SITE_NAME}`;
    const description = `Todos os ensaios e textos publicados por ${authorName} em ${SITE_NAME}.`;

    const collectionSchema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: pageTitle,
      description,
      url: pageUrl,
      inLanguage: 'pt-BR',
      author: {
        '@type': 'Person',
        name: authorName,
        url: SITE_URL,
      },
      hasPart: candidates.map((p) => ({
        '@type': 'Article',
        headline: p.title,
        url: `${SITE_URL}/p/${p.id}`,
        datePublished: p.created_at,
        author: { '@type': 'Person', name: authorName },
      })),
    });

    const breadcrumbSchema = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: authorName, item: pageUrl },
      ],
    });

    const postsList = candidates
      .map(
        (p) => `        <li class="post-item">
          <a href="/p/${p.id}" class="post-link">
            <span class="post-title">${escapeHtml(p.title)}</span>
            <time class="post-date" datetime="${p.created_at}">${formatDate(p.created_at)}</time>
          </a>
        </li>`,
      )
      .join('\n');

    const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(pageTitle)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta name="robots" content="index, follow" />
<meta name="author" content="${escapeHtml(authorName)}" />
<link rel="canonical" href="${pageUrl}" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<meta name="theme-color" content="#16171d" media="(prefers-color-scheme: dark)" />
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />

<meta property="og:type" content="profile" />
<meta property="og:title" content="${escapeHtml(pageTitle)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:url" content="${pageUrl}" />
<meta property="og:site_name" content="${SITE_NAME}" />
<meta property="og:image" content="${SITE_URL}/og-image.png" />
<meta property="profile:first_name" content="${escapeHtml(authorName.split(' ')[0])}" />
<meta property="profile:last_name" content="${escapeHtml(authorName.split(' ').slice(1).join(' '))}" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${SITE_URL}/og-image.png" />

<script type="application/ld+json">${collectionSchema}</script>
<script type="application/ld+json">${breadcrumbSchema}</script>

<style>
:root { color-scheme: light dark; --bg:#fff; --fg:#16171d; --muted:#64748b; --accent:#0066cc; --border:#e2e8f0; }
@media (prefers-color-scheme: dark) { :root { --bg:#16171d; --fg:#e2e8f0; --muted:#94a3b8; --accent:#60a5fa; --border:#334155; } }
* { box-sizing: border-box; }
body { margin:0; padding:0; background:var(--bg); color:var(--fg); font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; line-height:1.6; }
.container { max-width:760px; margin:0 auto; padding:3rem 1.5rem; }
.breadcrumb { font-size:0.875rem; color:var(--muted); margin-bottom:2rem; }
.breadcrumb a { color:var(--muted); text-decoration:none; }
.breadcrumb a:hover { color:var(--accent); }
h1 { font-size:2.25rem; font-weight:800; margin:0 0 0.5rem 0; letter-spacing:-0.02em; }
.bio { color:var(--muted); font-size:1.1rem; margin:0 0 3rem 0; }
.section-label { font-size:0.75rem; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--muted); margin:0 0 1rem 0; }
.post-list { list-style:none; padding:0; margin:0; }
.post-item { border-bottom:1px solid var(--border); }
.post-item:first-child { border-top:1px solid var(--border); }
.post-link { display:flex; justify-content:space-between; align-items:baseline; gap:1rem; padding:1.25rem 0; text-decoration:none; color:var(--fg); transition:color 0.15s; }
.post-link:hover { color:var(--accent); }
.post-title { font-size:1.0625rem; font-weight:500; flex:1; }
.post-date { font-size:0.8125rem; color:var(--muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
.footer { margin-top:3rem; padding-top:2rem; border-top:1px solid var(--border); text-align:center; color:var(--muted); font-size:0.875rem; }
.footer a { color:var(--accent); text-decoration:none; }
</style>
</head>
<body>
<div class="container">
  <nav class="breadcrumb" aria-label="breadcrumb">
    <a href="/">${SITE_NAME}</a> &nbsp;/&nbsp; ${escapeHtml(authorName)}
  </nav>
  <h1>${escapeHtml(authorName)}</h1>
  <p class="bio">${escapeHtml(description)}</p>

  <h2 class="section-label">Publicações (${candidates.length})</h2>
  <ul class="post-list">
${postsList}
  </ul>

  <footer class="footer">
    <a href="/">&larr; Voltar para ${SITE_NAME}</a>
  </footer>
</div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch {
    return new Response('Internal Server Error', { status: 500 });
  }
}
