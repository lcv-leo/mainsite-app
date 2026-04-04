# Changelog — Mainsite Worker (Backend)

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
