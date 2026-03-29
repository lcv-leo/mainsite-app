# Changelog — Mainsite Worker (Backend)

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
