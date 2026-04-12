# Changelog — Mainsite Worker (Backend)

## [v02.09.01] - 2026-04-12
### Adicionado
- **`routes/payments.ts`**: Rota pública `GET /api/sumup/fees` que retorna `{ sumupRate, sumupFixed }` lendo **direto do D1** (`mainsite_settings`/`mainsite/fees`) — sem o fallback defensivo de `loadFeeConfig()`. Se a configuração não existir ou o D1 estiver indisponível, retorna 503 para que o `DonationModal` desabilite a opção "Cobrir as taxas" em vez de exibir um preview baseado em valores incorretos. Sem auth (read-only de configuração já considerada pública pelo admin).

## [v02.09.00] - 2026-04-12
### Adicionado
- **`lib/indexnow.ts`**: Cliente IndexNow para notificar buscadores (Bing, Yandex, Seznam, Naver, Yep) quando um post é criado ou editado. Função `pingIndexNow(urlList)` faz POST para `https://api.indexnow.org/IndexNow`. Helper `postUrl(id)` constrói a URL canônica do post.
- **`routes/posts.ts`**: Hook fire-and-forget via `executionCtx.waitUntil(pingIndexNow(...))` no POST e PUT de posts. Zero impacto no response time. Falhas silenciosas.

### Notas de impacto
- Chave de validação IndexNow (`c8f3a7d6b2e9415d8f3c7a6b9e2d4f8c`) precisa estar acessível em `https://www.reflexosdaalma.blog/c8f3a7d6b2e9415d8f3c7a6b9e2d4f8c.txt` — arquivo provisionado em `mainsite-frontend/public/` na release v03.10.00.
- Re-indexação típica: 1-30 minutos no Bing, horas no Yandex.
- Sem ping no DELETE de post — buscadores tratam 404 organicamente no próximo crawl.

## [v02.08.00] - 2026-04-11
### Removido
- **payments-mp.ts**: Deletado. Todas as rotas MP removidas.
- **mercadopago**: Dependência removida do package.json
- **PIX nativo**: Rota /api/pix/generate removida (substituída por PIX via processador)
- **Headers.prototype.raw polyfill**: Removido (era exclusivo do SDK MP)
- **MERCADO_PAGO_WEBHOOK_SECRET**: Removido dos secrets
- **MP fee constants**: Removidos do financial.ts
- **validateMercadoPagoSignatureAsync**: Removida

### Alterado
- **payments-sumup.ts → payments.ts**: Renomeado sem referência a provedor

### Adicionado
- **PIX via processador**: POST /api/sumup/checkout/:id/pix com payment_type pix

## [v02.07.01] — 2026-04-11
### Alterado
- **Log prefix**: Todos os logs (structuredLog, Hono logger, console direto) agora prefixados com `[mainsite-motor]` para observabilidade unificada.

## [v02.07.00] — 2026-04-10
### Adicionado
- **Server-side HTML sanitization**: `sanitizePostHtml()` em `lib/sanitize.ts` — strip de tags perigosas (script, iframe, style), event handlers e javascript: URLs antes de armazenar no D1.
- **Orders API**: Migração de `Payment.create()` → `Order.create()` com `processing_mode: "automatic"`. Somente cartão de crédito, sem parcelamento.
- **Webhook Orders API**: HMAC validation atualizada com `x-request-id` e `data.id` lowercase conforme docs oficiais.
- **MERCADO_PAGO_WEBHOOK_SECRET**: Binding adicionado via Secrets Store.
- **items no order**: `title`, `description`, `category_id`, `quantity`, `unit_price`, `external_code` para compliance de qualidade MP.

### Alterado
- **Zod 3 → 4**: Upgrade de `zod ^3.23.0` para `^4.3.6`. Schemas compatíveis sem breaking changes.
- **Descrição de pagamento**: `Doação de {nome} - Reflexos da Alma` (consistente com SumUp).
- **Webhook age check removido**: Check de 5 minutos rejeitava retries legítimos do MP (a cada 15 min). HMAC validation é suficiente.

## [v02.06.00] — 2026-04-09
### Adicionado
- **Zod env validation**: `EnvSecretsSchema` adicionado a `src/lib/schemas.ts`. Middleware pós-resolução de secrets em `index.ts` valida todas as 12 variáveis e loga warn para as ausentes (não bloqueia deploy).
- **Hono logger**: `import { logger } from 'hono/logger'` + `app.use('*', logger())` — logs de request/response no stdout do Worker.
- **Hono timing**: `import { timing } from 'hono/timing'` + `app.use('*', timing())` — header `Server-Timing` em todas as respostas.
- **Biome linter**: Habilitado em `biome.json` com `recommended: true` (sem regras React; `noConsole` e `noExplicitAny` desligados).
- **Biome organizeImports**: Habilitado em `biome.json`.
- **Vitest UI**: `@vitest/ui ^4.1.2`; script `"test:ui": "vitest --ui"`.

## [v02.05.00] — 2026-04-09
### Adicionado
- **AppType export**: `export type AppType = typeof app` adicionado a `src/index.ts` para habilitar consumidores Hono RPC.
- **Script `npm run types`**: `wrangler types` adicionado ao `package.json` para gerar `worker-configuration.d.ts` a partir de `wrangler.json`.
- **Testes de rota Hono** (`vitest`):
  - `src/routes/ratings.test.ts`: GET `/api/ratings/abc` → 400 `Post ID inválido.`
  - `src/routes/comments.test.ts`: GET `/api/comments/config` com DB indisponível → 200 com defaults seguros
  - `vitest.config.ts`: ambiente `node`, include `src/**/*.test.ts`
  - `tsconfig.json`: `exclude` adicionado para `**/*.test.ts`

## [v02.04.02] — 2026-04-08
### Corrigido
- **NPM Audit Fix**: Atualizadas as versões de subdependências vulneráveis (hono, @hono/node-server) em virtude de alertas Moderate reportados pelo Dependabot para fechar riscos de directory traversal e proxy bypass.

## [v02.03.01] — 2026-04-07
### Adicionado
- **GCP NL API — Dual-Mode Auth (`moderation.ts`)**: Detecção automática do formato de credencial. Se `GCP_NL_API_KEY` contém JSON de Service Account, gera JWT via Web Crypto API e troca por access token OAuth2. Se é API Key simples (`AIzaSy...`), usa `?key=` na URL. Compatível com ambos os cenários sem configuração manual.
- **Error Logging — GCP NL API**: Response body agora logado em caso de erro HTTP, permitindo diagnóstico preciso (quota, API desabilitada, credencial inválida).

### Corrigido
- **Turnstile — Validação Estrita Restaurada**: Revertido o afrouxamento temporário da validação Turnstile. Comentários sem token são rejeitados com HTTP 400. Tokens inválidos são rejeitados com HTTP 403.

### Alterado
- **Secrets Store Cleanup (`wrangler.json`)**: Removidos `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` do `secrets_store_secrets` (excedem limite de caracteres). Gerenciados como Environment Variables no Dashboard Cloudflare.

### Controle de versão
- `mainsite-worker`: v02.03.00 → v02.03.01

## [v02.03.00] — 2026-04-07
### Adicionado
- **Content Fingerprint System**: Motor de versionamento atômico para sincronização em tempo real com o frontend.
  - **`lib/content-version.ts`**: Funções `bumpContentVersion()` (incrementa atomicamente o counter em D1) e `getContentFingerprint()` (retorna versão + headline post ID).
  - **`GET /api/content-fingerprint`**: Endpoint público ultra-leve (1 query D1, ~200 bytes, Cache-Control: 5s) para smart polling do frontend.
  - **Hooks de mutação**: `bumpContentVersion()` integrado via `executionCtx.waitUntil()` em todas as mutações de posts (create, update, delete, pin, reorder) em `posts.ts` e no cron `scheduled()` em `index.ts`.

### Controle de versão
- `mainsite-worker`: v02.02.03 → v02.03.00

## [v02.02.03] — 2026-04-06
### Adicionado
- **Cross-Service AI Telemetry**: `logAiUsage` centralizado em `genai.ts` dentro da função `generate()`, instrumentando automaticamente todos os endpoints AI (chat, transform, shareSummary). Registro de tokens, latência e status no `ai_usage_logs` (D1).
### Alterado
- **Compatibility Date**: `wrangler.json` atualizado para `2026-04-06`.
### Controle de versão
- `mainsite-worker`: v02.02.02 → v02.02.03


## [v02.02.02] — 2026-04-06
### Alterado
- **Observability 100%**: `head_sampling_rate: 1`, `invocation_logs: true` e `logs.enabled: true` ativados no `wrangler.json` do mainsite-motor.

### Controle de versão
- `mainsite-worker`: v02.02.01 → v02.02.02

## [v02.02.01] — 2026-04-06
### Migração de Pages Functions + Limpeza AI Gateway
- **Rotas R2 media migradas do frontend**: `GET /api/media/:filename` e `GET /api/mainsite/media/:filename` agora servidas nativamente pelo worker via binding `BUCKET` (mesmo bucket R2 `mainsite-media`). Pages Functions correspondentes deletadas.
- **Sitemap duplicado removido (`misc.ts`)**: rota `GET /api/sitemap.xml` removida — o sitemap canônico é servido pela Pages Function `sitemap.xml.ts` em `/sitemap.xml`.
- **Expurgo final CF_AI_GATEWAY**: substituídas todas as 6 referências residuais de `CF_AI_GATEWAY` por `GEMINI_API_KEY` em `posts.ts`, `post-summaries.ts` e `index.ts`. Guard conditions agora validam a credencial real usada pelo SDK Gemini.
- **Arquivos obsoletos removidos**: `test-genai.ts` (teste AI Gateway) e `log.txt` (log de debug) deletados.

### Controle de versão
- `mainsite-worker`: v02.02.00 → v02.02.01

## [v02.02.00] — 2026-04-06
### Alterado
- **Migração de Domínio Principal**: todas as URLs hardcoded de `www.lcv.rio.br` substituídas por `www.reflexosdaalma.blog` nos sitemaps (`misc.ts`) e URLs internas.
- **CORS Expandido (`index.ts`)**: origin check ampliado de apenas `lcv.rio.br` para todos os 9 domínios personalizados do mainsite-frontend (reflexosdaalma.blog, cardozovargas.com, lcvleo.com, etc.), com suporte a www.
- **Uploads CORS (`uploads.ts`)**: `Access-Control-Allow-Origin` alterado de `https://www.lcv.rio.br` para `*` por servir assets para múltiplos domínios.
- **E-mail do autor (`ai.ts`)**: `lcv@lcv.rio.br` substituído por `cal@reflexosdaalma.blog` no system prompt e no recipient do Resend.

### Removido
- **Webhook MP — notificação por e-mail (`payments-mp.ts`)**: removido o bloco de envio de e-mail via Resend no webhook do Mercado Pago. Webhook mantido plenamente funcional (HMAC + timestamp + ACK) como exigência de compliance, porém sem ação de e-mail.
- **Custom domain route (`wrangler.json`)**: removida a rota `mainsite-app.lcv.rio.br` com `custom_domain: true`. O worker opera exclusivamente via domínio interno `.workers.dev` e Service Binding.

### Controle de versão
- `mainsite-worker`: v02.01.08 → v02.02.00

## [v02.01.08] — 2026-04-04
### Segurança & Remoções (Tech Debt)
- **Migração Concluída: Retorno ao SDK Gemini**: Finalizada com sucesso a remoção completa do Cloudflare AI Gateway e Workers AI. 
- O arquivo `genai.ts` teve a configuração forçada da propriedade `httpOptions` banida, desativando a proxy Layer da Cloudflare e efetuando a requisição nativamente, a fim de expurgar o risco estrito de falhas de timeout formatuais (Erro 524) identificadas durante chamadas de texto pesadas nas features do app.
- A rota `ai.ts` teve toda a infraestrutura baseada no Workers AI removida. O SDK `@google/genai` processa tudo direto pelo end-point da Google. 
- A chave e variáveis `CF_AI_GATEWAY` foram erradicadas dos mapeamentos de `wrangler.json`, Types e Secrets Store para garantir estanqueidade da reversão. Adicionalmente `CF_AI_TOKEN` removida.

### Controle de versão
- `mainsite-worker`: v02.01.07 → v02.01.08

## [v02.01.07] — 2026-04-04
### Corrigido
- **Workers AI max_tokens Limiter Fix**: Adicionado suporte direto na rota `/api/ai/workers/translate` e `summarize` para suportar cargas compridas no backend, parametrizando as chamadas ao Llama-3 com `max_tokens: 4000` limitador contra fragmentação decorrente do hard-limit nativo da Cloudflare (256 tokens).

### Controle de versão
- `mainsite-worker`: v02.01.06 → v02.01.07

## [v02.01.06] — 2026-04-03
### SecOps & Fixes
- **Restabelecimento Cloudflare AI Gateway**: Refatoração concluída no factory `createClient()` e nas chaves do `wrangler.json`. A proxy URL foi desacoplada corretamente para envio via `baseUrl` e a autenticação do token `CF_AI_GATEWAY` restabelecida via header explícito `cf-aig-authorization: Bearer <TOKEN>`.
- **Ajuste de Scope ID no Workers AI**: Remoção de lógica legada de parsing de token usando `split('/')` em favor do literal isolado `workspace-gateway`.
- **Secret Store Sync (Fix)**: Validado deployment 100% positivo; as chaves ausentes da Cloudflare CI/CD `PIX_KEY`, `PIX_NAME` e `PIX_CITY` bem como aliases corrigidos para SumUp e Resend foram fixadas. Pipelines Github Actions rodando em estado green.

### Controle de versão
- `mainsite-worker`: v02.01.05 → v02.01.06

## [v02.01.05] — 2026-04-03
### SecOps & Fixes
- **Remoção de Secrets Legados**: Eliminadas senhas obsoletas (`API_SECRET` e `PIX_KEY`) tanto do código-fonte (midlewares e rotas) como do Cloudflare Secret Store, fechando vetor de segurança.
- **Sincronização de Cofre (Secret Store Compliance)**: Mapeamento corrigido no `wrangler.json` (conversão de `kebab-case` para uppercase estrito em todos os `secret_name`), resolvendo os status `500` engatilhados por secrets undefined em produção (incluindo SumUp, Resend, Gemini e Mercado Pago).
- **Hardening AI Auth**: Implementada autenticação na rota legada via `CLOUDFLARE_PW` no lugar de `API_SECRET`.
- **Cloudflare AI Gateway Slug Fix**: Ajuste de URL e binding de Cloudflare AI Gateway em testes e runtime, restaurando o serviço de IA.

### Controle de versão
- `mainsite-worker`: v02.01.04 → v02.01.05

## [v02.01.04] — 2026-04-03
### Adicionado
- **Integração Cloudflare Workers AI**: injeção do binding `AI` para processamento nativo na Edge a zero custo de API outbound.
- **Análise de Sentimento (Anti-toxicidade)**: adicionado filtro de avaliação em background (`distilbert-sst-2-int8`) nas rotas de contato e comentários (`POST /api/contact`, `POST /api/comment`), injetando marcações visuais de tensão explícita ou feedback efusivo estruturadas nos e-mails disparados ao administrador.
- **Tradução e Sumarização na Edge**: adicionadas novas rotas `/api/ai/workers/translate` (`m2m100-1.2b`) e `/api/ai/workers/summarize` (`llama-3-8b-instruct`), fornecendo primitivas de baixa latência e mitigando a dependência do Gemini para operações básicas.

### Controle de versão
- `mainsite-worker`: v02.01.03 → v02.01.04

## [v02.01.03] — 2026-04-02
### Alterado
- **Gemini SDK Integrado**: Refatoração estrutural no abstraidor lógico de IA (`src/lib/genai.ts`) migrando totalmente da antiga requisição REST (`fetch`) para o pacote oficial e mais seguro `@google/genai`. 
- Incorporada persistência de configuração *thinking models*, tratamento estrito de erro unificado e instanciamento via `apiKey`.

### Controle de versão
- `mainsite-worker`: v02.01.02 → v02.01.03

## [v02.01.02] — 2026-03-31
### Alterado
- **Dependências atualizadas**: upgrade de `@sumup/sdk`, `@cloudflare/workers-types` e `wrangler` para versões recentes, com lockfile sincronizado.
- **Dependabot para worker reforçado**: adicionado agrupamento de devDependencies (`eslint*`, `typescript`, `@types/*`, `wrangler`) para reduzir ruído operacional de PRs.

### Controle de versão
- `mainsite-worker`: v02.01.01 → v02.01.02

## [v02.01.01] — 2026-03-29
### Alterado
- **Autor dinâmico em posts**: `posts.ts` INSERT e UPDATE aceitam campo `author` no body JSON e persistem na coluna `author` da tabela `mainsite_posts`. Fallback para "Leonardo Cardozo Vargas". Paridade com `admin-app` v01.73.00.

### Controle de versão
- `mainsite-worker`: v02.01.00 → v02.01.01

## [v02.01.00] — 2026-03-29
### Alterado (MAJOR) — D1 Financial Log Deprecation
- **Arquitetura Live API-first**: todas as escritas e leituras de `mainsite_financial_logs` removidas.
  - `payments-sumup.ts`: D1 INSERT removido do endpoint `/pay`; status polling (`/status`) refatorado para consultar SDK SumUp diretamente.
  - `payments-mp.ts`: webhook `/api/webhooks/mercadopago` mantido para compliance MP (HMAC + ACK 200 + email), mas sem D1.
- **D1 binding `DB` permanece** apenas para `loadFeeConfig()` lendo `mainsite_settings` (configuração, não transação).

### Removido
- **SumUp (endpoints mortos)**: `/api/sumup/sync`, `/api/sumup/reindex-statuses`, `/api/sumup-financial-logs` (GET/check/DELETE), `/api/sumup-balance`, `/api/sumup-payment/:id/refund`, `/api/financeiro/sumup-refund`, `/api/sumup-payment/:id/cancel`, `/api/financeiro/sumup-cancel`.
- **MP (endpoints mortos)**: `/api/mp-payment/:id/refund`, `/api/mp-payment/:id/cancel`, `/api/mp-balance`, `/api/mp/sync`, `/api/financial-logs` (GET/check/DELETE).
- **Helpers órfãos**: `resolveTxnId()`, `parseSumupCancelRefundError()`.
- **Tabela `mainsite_financial_logs`**: sem escritor e sem leitor — pronta para DROP no D1.

## [v02.00.01] — 2026-03-29
### Corrigido
- **SumUp — detecção inteligente de reembolsos**: `payments-sumup.ts` agora itera todo o array `transactions[]` do checkout SumUp, identificando transações com `type: "REFUND"` e somando valores para determinar status `REFUNDED` (total) ou `PARTIALLY_REFUNDED` (parcial). Antes, apenas `transactions[0]` (pagamento original) era inspecionado.
- **Mercado Pago — detecção de reembolso parcial**: `payments-mp.ts` expandido para verificar `refunds[]` e `refund_resources[]` no payload MP, resolvendo status `PARTIALLY_REFUNDED` quando o total reembolsado é menor que o valor original.

## [v02.00.00] — 29/03/2026
### Adicionado (MAJOR)
- **Decomposição modular Hono + TypeScript**: monólito `index.js` (3013 linhas) decomposto em arquitetura modular tipada:
  - 8 módulos de rotas: `ai.ts`, `posts.ts`, `contact.ts`, `settings.ts`, `uploads.ts`, `misc.ts`, `payments-sumup.ts`, `payments-mp.ts`.
  - 4 bibliotecas compartilhadas: `auth.ts`, `logger.ts`, `rate-limit.ts`, `financial.ts`.
  - Entry point `src/index.ts` com CORS, rate limit, cron triggers e module mounts.
  - Tipagem estrita de bindings Cloudflare via `env.ts`.
- **Fee Config dinâmico**: `financial.ts` → `loadFeeConfig()` carrega taxas SumUp/MP da D1 com fallback hardcoded, eliminando valores fixos no código.

### Removido
- Monólito `src/index.js` deletado após migração completa.
- `tsconfig.json` atualizado (removido `baseUrl` deprecated).

### Alterado
- `wrangler.json`: nome do worker atualizado para `mainsite-motor`.
- Build output: 320 KiB (57 KiB gzip) via `wrangler deploy --dry-run`.

## [v01.35.02] — 28/03/2026
### Corrigido
- **SumUp — chave canônica em `mainsite_financial_logs`**: o sync histórico passou a normalizar `payment_id` para `checkout.id`, mantendo compatibilidade com registros legados originalmente persistidos com `transaction.id`.
- **SumUp — estorno/cancelamento agora atingem registros legados**: rotas canônicas e aliases retroativos passaram a atualizar o status usando tanto o checkout UUID quanto o transaction UUID legado, eliminando casos em que o painel permanecia em `SUCCESSFUL` após operação concluída no provider.

## [v01.35.01] — 28/03/2026
### Corrigido
- **SumUp — reconciliação de status no financeiro**: implementada resolução de status com precedência para estados terminais (`PARTIALLY_REFUNDED`, `REFUNDED`, `CANCELLED`, `CHARGE_BACK`, `FAILED`, `EXPIRED`) em `sumup-financial-logs` e `sumup/reindex-statuses`, evitando regressão para `SUCCESSFUL` por payload legado.
- **SumUp — rota de status duplicada**: removido handler redundante de `/api/sumup/checkout/:id/status` para eliminar conflitos de roteamento e preservar o fluxo com lazy sync.

### Adicionado
- **Compatibilidade retroativa de endpoints**: adicionados aliases `POST /api/financeiro/sumup-refund` e `POST /api/financeiro/sumup-cancel` para clientes legados ainda desacoplados das rotas canônicas `/api/sumup-payment/:id/refund|cancel`.

## [v01.35.00] — 28/03/2026
### Adicionado/Alterado
- **Integração SumUp via MCP / Flow 3DS**: Implementados novos endpoints backend de `checkout` e processamento SumUp em lote com captura do `next_step` do desafio de Autorização 3DS (`ACTION_REQUIRED`). 
- **Bypass e Polling**: Enpoints para sinalização de bypass na transição do `iframe` e um webhook/público robusto para recebimento (polling de success/failed fallback) atrelados à arquitetura global MCP.

## [v01.34.00] — 2026-03-24
### Alterado
- Migração total de D1 para namespace `mainsite_*` no `bigdata_db`
- Atualização de queries de `posts`, `settings`, `chat_logs`, `chat_context_audit`, `contact_logs`, `shares` e `financial_logs` para tabelas prefixadas
- Chaves de configuração migradas para namespace contextual: `mainsite/appearance`, `mainsite/rotation`, `mainsite/ratelimit`, `mainsite/disclaimers`

### Infra
- `wrangler.json` atualizado para `bigdata_db` (binding mantido como `DB`)
- Versionamento atualizado para `v01.34.00` + `package.json` 1.34.0

## [v01.33.00] — 2026-03-23
### Corrigido
- Endpoints críticos de pagamento protegidos com autenticação Bearer (`/api/sumup/checkout`, `/api/sumup/checkout/:id/pay`, `/api/mp-payment`)
- Webhook do Mercado Pago reforçado com validação de assinatura HMAC-SHA256 e validação de timestamp

### Segurança
- Redução de superfície de fraude em criação/processamento de pagamentos sem autenticação
- Rejeição explícita de webhooks sem headers de segurança ou assinatura inválida

## [v01.32.00] — 2026-03-22
### Alterado
- Upgrade Gemini API: modelo gemini-pro-latest, endpoint v1beta, thinkingLevel HIGH, safetySettings, retry com 1 tentativa extra, parsing multi-part para modelos thinking
- Padronização do sistema de versão para formato v00.00.00

## [v01.31.00] — Anterior
### Histórico
- Versão anterior à padronização do controle de versão
