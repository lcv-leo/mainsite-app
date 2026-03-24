# Changelog — Mainsite Frontend

## [v02.11.00] — 2026-03-23
### Corrigido
- Remoção de fallback hardcoded da chave pública do Mercado Pago no formulário de doações
- Fluxo de leitura de chave pública padronizado para `VITE_MERCADOPAGO_PUBLIC_KEY` sem valor embutido em código

### Infra
- Injeção de variáveis `VITE_` consolidada no pipeline de deploy para build-time do frontend
- Configuração de build ajustada para eliminar conflito entre opções de minificação no Vite 8

## [v02.10.00] — 2026-03-22
### Alterado
- Upgrade Gemini API: modelo gemini-pro-latest, endpoint v1beta, thinkingLevel HIGH, safetySettings, retry
- Padronização do sistema de versão para formato APP v00.00.00
- Cabeçalho de código traduzido para português (Módulo/Versão/Descrição)

## [v02.09.00] — Anterior
### Histórico
- Versão anterior à padronização do controle de versão
