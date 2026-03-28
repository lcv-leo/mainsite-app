# Changelog — Mainsite Worker (Backend)

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
