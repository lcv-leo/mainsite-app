# Changelog — Mainsite Frontend

## [v02.19.01] — 26/03/2026
### Corrigido
- **ArchiveMenu — datas completas nos cards quadrados**: cards da primeira fileira (rotação) exibiam apenas data curta (`dd/mm/aaaa`). Corrigido para "Publicado em dd/mm/aaaa, hh:mm:ss | Atualizado em dd/mm/aaaa, hh:mm:ss", consistente com os cards do acervo histórico. Helper `fmtDate` extraído para escopo de componente.
- **ArchiveMenu — React Rules of Hooks**: early return `if (!activePalette)` antes dos hooks causava chamadas condicionais de `useMemo`/`useEffect`. Guard movido para após todos os hooks.
- **ArchiveMenu — useEffect com setState síncrono**: dois `useEffect` que chamavam `setShowOlderYears` substituídos por variável derivada `effectiveShowOlderYears`, eliminando renders em cascata.
- **ArchiveMenu — React Compiler memoização**: `filteredArchive` e `historicalArchive` envolvidos em `useMemo` para preservar memoização e evitar dependências mutáveis.

## [v02.19.00] — 26/03/2026
### Adicionado
- **[NEW] `functions/api/mainsite/media/[filename].js`**: rota R2 para servir imagens de posts no path `/api/mainsite/media/` (espelha admin-app), corrigindo 404 em imagens migradas

### Corrigido
- **CSP — Google Fonts bloqueado**: adicionado `https://fonts.googleapis.com` ao `style-src` e `font-src 'self' https://fonts.gstatic.com` para permitir carregamento da fonte Inter

### Removido
- **Cache-Control customizado**: removidas todas as regras de cache do `_headers` e dos handlers de mídia — cache gerenciado nativamente pelo Cloudflare

## [v02.18.00] — 26/03/2026
### Adicionado
- **Rodapé de metadados nas postagens**: exibe "Publicado em dd/mm/aaaa, hh:mm:ss | Atualizado em dd/mm/aaaa, hh:mm:ss" de forma elegante e discreta (opacity 0.45, 11px) entre o conteúdo e a barra de compartilhamento
- **Datas completas nos cards do arquivo**: formato "Publicado em dd/mm/aaaa, hh:mm:ss" com linha "Atualizado em" quando diferente, substituindo a exibição anterior que era apenas data

### Alterado
- **Cards do arquivo reduzidos ~30%**: padding 24→16px, squares 220→154px, grid min 200→140px, border-radius 24→16px, gap 24→16px
- **Fonte das datas nos cards +20%**: 10→12px para melhor legibilidade

### Removido
- **Terser removido**: substituído por esbuild nativo do Vite 8 com `drop: ['console', 'debugger']`. Build acelerou de ~3s para ~460ms e elimina warning `[PLUGIN_TIMINGS] vite:terser`

## [v02.17.00] — 26/03/2026
### Adicionado
- **11 controles configuráveis na seção "Configurações Globais"**: peso do corpo/títulos, altura de linha (slider), alinhamento de texto, recuo de parágrafo, espaçamento entre parágrafos, largura máxima de leitura, cor dos links
- **Largura de leitura dinâmica**: `#root` width agora é controlável via admin (680px a tela cheia)

### Corrigido
- **Separação Editor vs. Settings**: `.html-content p` mantém `text-align` e `text-indent` como defaults configuráveis pelo admin (preserva posts legados). Quando o TipTap define alinhamento explícito via inline `style`, o CSS de maior especificidade sobrescreve o default, e `text-indent` é zerado automaticamente
- Conteúdo plaintext (`.p-content`) mantém os valores configuráveis do admin

## [v02.16.00] — 26/03/2026
### Adicionado
- **Tipografia Inter** (Google Fonts) como fonte primária, inspirada no design do tiptap.dev
- **Títulos editoriais**: removido `text-transform: uppercase` e `letter-spacing: 0.3em`, substituído por estilo editorial com `letter-spacing: -0.02em` e `font-weight: 700`
- **Espaçamento generoso**: margem entre parágrafos aumentada de 1.8rem para 2.2rem
- **Hierarquia tipográfica por peso**: headings H1-H3 com `line-height` explícito e letter-spacing negativo
- **Dark mode refinado**: background de `#131314` (preto puro) para `#16171d` (azul-charcoal sutil)

### Corrigido
- Peso do corpo de texto reduzido de 700 para 500 (mais confortável para leitura longa)
- Letter-spacing dos botões reduzido de 1.5px para 0.8px (mais refinado)
- Glassmorphism removido dos botões de ação AI (mantido apenas em toasts/modais/floating)

## [v02.15.00] — 26/03/2026
### Corrigido
- **Brand icons usavam URL externa**: `.env` apontava para `https://mainsite-app.lcv.rio.br/api/uploads/brands`. Corrigido para rota relativa `/api/uploads/brands` via proxy + Service Binding interno

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
