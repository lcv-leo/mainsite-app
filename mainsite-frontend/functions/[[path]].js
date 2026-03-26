// Módulo: mainsite-frontend/functions/[[path]].js
// Descrição: Middleware nativo do Cloudflare Pages (HTMLRewriter).
// Intercepta a resposta do HTML estático e injeta dinamicamente as Open Graph Tags para SEO (WhatsApp, Facebook, etc.)
// Lê dados diretamente do D1 via binding DB, sem chamada a URL externa.

/* global HTMLRewriter */

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Se a URL aponta para um arquivo estático (assets, imagens, fontes etc.),
  // bypass do middleware OG — o _routes.json já exclui /assets/*, mas este guard
  // cobre quaisquer outros arquivos com extensão que passem pelo handler.
  // Se o servidor retornar text/html para uma requisição de asset (arquivo ausente
  // na deployment / fallback SPA), responde com 404 limpo em vez de entregar HTML
  // com MIME errado, o que quebraria o carregamento dos módulos JS.
  const isStaticFile = /\.(js|css|mjs|ts|jsx|tsx|ico|png|jpg|jpeg|gif|svg|webp|avif|woff2?|ttf|eot|map|json|txt|asc|xml|gz|br|pdf)$/i.test(url.pathname);
  if (isStaticFile) {
    const assetResponse = await context.next();
    const contentType = assetResponse.headers.get('Content-Type') || '';
    if (contentType.includes('text/html')) {
      return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return assetResponse;
  }

  // Bypass para rotas de API — o catch-all proxy cuida dessas
  if (url.pathname.startsWith('/api/')) {
    return context.next();
  }

  // 1. Pega a resposta original (o seu index.html estático do React)
  const response = await context.next();
  
  const queryPostId = url.searchParams.get('p');
  const pathMatch = url.pathname.match(/^\/(?:p|post|materia|m|s)\/(\d+)\/?$/i);
  const postId = queryPostId || (pathMatch ? pathMatch[1] : null);

  // 2. Se o usuário estiver acessando a página inicial genérica, apenas entrega o HTML padrão.
  if (!postId) return response;

  try {
    // 3. Consulta direta ao D1 via binding — sem chamada a URL externa
    const db = context.env.DB;
    const post = await db.prepare('SELECT id, title, content FROM posts WHERE id = ?').bind(postId).first();
    if (!post) return response;
    
    // 4. Limpa o conteúdo de tags HTML para gerar uma descrição limpa para o card do WhatsApp.
    const cleanBase = (post.content || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
    const cleanText = `${cleanBase.substring(0, 160)}${cleanBase.length > 160 ? '...' : ''}`;
    const pageTitle = `${post.title} | Divagações Filosóficas`;
    const canonicalUrl = `https://www.lcv.rio.br/p/${post.id}`;

    // 5. MÁGICA DO CLOUDFLARE: Injeta as metatags dinamicamente antes do HTML chegar ao WhatsApp.
    return new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(pageTitle); } })
      .on('meta[property="og:type"]', { element(e) { e.setAttribute('content', 'article'); } })
      .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', pageTitle); } })
      .on('meta[name="twitter:title"]', { element(e) { e.setAttribute('content', post.title); } })
      .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', cleanText); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute('content', cleanText); } })
      .on('meta[name="twitter:description"]', { element(e) { e.setAttribute('content', cleanText); } })
      .on('meta[name="twitter:card"]', { element(e) { e.setAttribute('content', 'summary_large_image'); } })
      .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', canonicalUrl); } })
      .on('head', {
        element(e) {
          e.append(`<meta property="og:site_name" content="Divagações Filosóficas">`, { html: true });
          e.append(`<link rel="canonical" href="${canonicalUrl}">`, { html: true });
        }
      })
      .transform(response);
  } catch {
    // Em caso de falha silenciosa, a página carrega normalmente sem interromper o site.
    return response;
  }
}