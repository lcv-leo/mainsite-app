# Changelog — Mainsite Worker (Backend)

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
