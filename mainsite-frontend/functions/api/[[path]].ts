// Módulo: mainsite-frontend/functions/api/[[path]].js
// Descrição: Catch-all proxy que encaminha todas as requisições /api/* para o
// mainsite-worker via Service Binding interno da Cloudflare, eliminando
// chamadas a URLs externas entre apps no mesmo edge.

import type { EventContext, Fetcher } from '@cloudflare/workers-types';

interface Env {
  WORKER: Fetcher;
}

export async function onRequest(context: EventContext<Env, string, Record<string, unknown>>) {
  const { request, env, params } = context;

  // Reconstrói o path a partir dos segmentos capturados pelo catch-all
  const paramPath = params.path;
  const pathSegments = Array.isArray(paramPath) ? paramPath : paramPath ? [paramPath] : [];
  const apiPath = '/api/' + pathSegments.join('/');

  // Preserva a query string original
  const url = new URL(request.url);
  const targetUrl = new URL(apiPath, 'https://internal.worker');
  targetUrl.search = url.search;

  // Cria a requisição interna preservando método, headers e body
  const proxyRequest = new Request(targetUrl.toString(), {
    method: request.method,
    headers: request.headers as unknown as HeadersInit,
    body: request.body ? (request.body as unknown as BodyInit) : null,
    redirect: 'follow',
  });

  // Encaminha via Service Binding interno (sem sair da rede Cloudflare)
  const response = await env.WORKER.fetch(proxyRequest as unknown as import('@cloudflare/workers-types').Request);

  // Retorna a resposta do worker ao cliente
  return new Response(response.body ? (response.body as unknown as BodyInit) : null, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers as unknown as HeadersInit,
  });
}
