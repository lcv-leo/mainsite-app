// Módulo: mainsite-frontend/functions/[[path]].js
// Descrição: Middleware nativo do Cloudflare Pages (HTMLRewriter).
// Intercepta a resposta do HTML estático e injeta dinamicamente as Open Graph Tags para SEO (WhatsApp, Facebook, etc.)

/* global HTMLRewriter */

export async function onRequest(context) {
  // 1. Pega a resposta original (o seu index.html estático do React)
  const response = await context.next();
  
  const url = new URL(context.request.url);
  const queryPostId = url.searchParams.get('p');
  const pathMatch = url.pathname.match(/^\/(?:p|post|materia|m|s)\/(\d+)\/?$/i);
  const postId = queryPostId || (pathMatch ? pathMatch[1] : null);

  // 2. Se o usuário estiver acessando a página inicial genérica, apenas entrega o HTML padrão.
  if (!postId) return response;

  try {
    // 3. Consulta a nova rota rápida do Worker para pegar APENAS os dados deste texto.
    const apiRes = await fetch(`https://mainsite-app.lcv.rio.br/api/posts/${postId}`);
    if (!apiRes.ok) return response;
    
    const post = await apiRes.json();
    
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