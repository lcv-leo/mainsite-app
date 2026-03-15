// Módulo: mainsite-frontend/functions/sitemap.xml.js
// Versão: v1.1.0
// Descrição: Pages Function de proxy avançado. Repassa os Headers (User-Agent) da requisição original para garantir que a API reconheça o Googlebot como um 'Verified Bot'.

export async function onRequest(context) {
  const { request } = context;

  // Monta a requisição para a API herdando estritamente os cabeçalhos originais do visitante
  const proxyRequest = new Request("https://mainsite-app.lcv.rio.br/api/sitemap.xml", {
    method: request.method,
    headers: request.headers,
  });

  return await fetch(proxyRequest);
}