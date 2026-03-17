// Módulo: mainsite-frontend/functions/[[path]].js
// Descrição: Middleware nativo do Cloudflare Pages (HTMLRewriter).
// Intercepta a resposta do HTML estático e injeta dinamicamente as Open Graph Tags para SEO (WhatsApp, Facebook, etc.)

export async function onRequest(context) {
  // 1. Pega a resposta original (o seu index.html estático do React)
  const response = await context.next();
  
  const url = new URL(context.request.url);
  const postId = url.searchParams.get('p');

  // 2. Se o usuário estiver acessando a página inicial genérica, apenas entrega o HTML padrão.
  if (!postId) return response;

  try {
    // 3. Consulta a nova rota rápida do Worker para pegar APENAS os dados deste texto.
    const apiRes = await fetch(`https://mainsite-app.lcv.rio.br/api/posts/${postId}`);
    if (!apiRes.ok) return response;
    
    const post = await apiRes.json();
    
    // 4. Limpa o conteúdo de tags HTML para gerar uma descrição limpa para o card do WhatsApp.
    const cleanText = post.content.replace(/<[^>]*>?/gm, '').substring(0, 160) + '...';
    const pageTitle = `${post.title} | Divagações Filosóficas`;

    // 5. MÁGICA DO CLOUDFLARE: Injeta as metatags dinamicamente antes do HTML chegar ao WhatsApp.
    return new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(pageTitle); } })
      .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', post.title); } })
      .on('meta[name="twitter:title"]', { element(e) { e.setAttribute('content', post.title); } })
      .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', cleanText); } })
      .on('meta[name="description"]', { element(e) { e.setAttribute('content', cleanText); } })
      .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', url.toString()); } })
      .transform(response);
  } catch (e) {
    // Em caso de falha silenciosa, a página carrega normalmente sem interromper o site.
    return response;
  }
}