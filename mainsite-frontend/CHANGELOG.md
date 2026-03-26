# Changelog — Mainsite Frontend

## [v02.14.00] — 26/03/2026
### Adicionado
- Conformidade WCAG 2.1 AA + eMAG em todos os componentes
- Link "Ir para o conteúdo principal" (skip-to-content)
- `role="alert"` e `aria-live="assertive"` em toasts
- `role="dialog"`, `aria-modal`, `aria-labelledby` em todos os modais (ContactModal, CommentModal, ShareOverlay, DonationModal, DisclaimerModal)
- `role="complementary"` e `role="log"` no ChatWidget
- `role="toolbar"` e `aria-label` nos FloatingControls
- `<article>` semântico e `<nav>` para compartilhamento no PostReader
- `<label>` sr-only para todos os campos de formulário
- `aria-label` em todos os botões icon-only
- `title` descritivo em iframes YouTube
- `alt` descritivo em imagens (usando legenda quando disponível)
- Classe CSS `.sr-only` para conteúdo acessível via screen reader
- `prefers-reduced-motion` para desabilitar animações
- `:focus-visible` estendido para `<a>` e `[tabindex]`

## [v02.13.00] — 26/03/2026
### Alterado
- Eliminação de todas as URLs externas (`https://mainsite-app.lcv.rio.br`) na comunicação intra-app
- `API_URL` convertido de URL externa para rota relativa `/api`
- Brand icons fallback convertido para `/api/uploads/brands` (interno)
- OG tags (`functions/[[path]].js`) reescrito para consultar `bigdata_db` via binding D1 direto
- Sitemap (`functions/sitemap.xml.js`) reescrito para consultar `bigdata_db` via binding D1 direto
- CSP `connect-src` removido referência ao domínio externo do worker

### Adicionado
- Service Binding (`WORKER` → `mainsite-app`) no `wrangler.json` para comunicação interna
- R2 binding (`MEDIA_BUCKET`) para servir mídia internamente
- Catch-all proxy `functions/api/[[path]].js` para rotear `/api/*` via Service Binding
- Rota R2 de mídia `functions/api/media/[filename].js` para resolver links legados

### Infra
- Consolidação do versionamento para `APP v02.13.00`

## [v02.12.00] — 2026-03-24
### Alterado
- Migração de binding D1 para `bigdata_db` no `wrangler.json`, mantendo binding lógico `DB`

### Infra
- Consolidação do versionamento para `APP v02.12.00` + `package.json` 2.12.0

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
