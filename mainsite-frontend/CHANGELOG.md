# Changelog — Mainsite Frontend

## [v03.02.03] - 2026-03-31
### Adicionado
- **Governança de Licenciamento (GNU AGPLv3)**: Inserção do `LicencasModule` e `ComplianceBanner` no frontend para fechamento do SaaS Loophole com conformidade total.

### Controle de versão
- `mainsite`: APP v03.02.02 -> APP v03.02.03

## [v03.02.02] - 2026-03-31
### Corrigido
- **Compliance - GNU AGPLv3**: corrigido erro 404 no invólucro do arquivo LICENSE, publicando o texto integral da licença (~34KB) em conformidade técnica e jurídica.

### Controle de versão
- "mainsite": APP v03.02.01   APP v03.02.02

## [v03.02.02] — 2026-03-31
### Corrigido
- **PostReader — links abrindo na mesma janela**: DOMPurify remove `target="_blank"` internamente como medida anti-tab-nabbing, mesmo com `ADD_ATTR: ['target']`. Adicionado pós-processamento determinístico que força `target="_blank"` e `rel="noopener noreferrer"` em todos os links não-YouTube **após** a sanitização do DOMPurify.

### Controle de versão
- `mainsite-frontend`: APP v03.02.01 → APP v03.02.02

## [v03.02.01] — 2026-03-31
### Alterado
- **Fluxo indireto `preview` padronizado**: branch operacional `preview` adotado no monorepo para promoções consistentes para `main`.
- **Automação de promoção**: workflow `.github/workflows/preview-auto-pr.yml` adicionado/atualizado para abrir/reusar PR `preview -> main`, habilitar auto-merge e tentar merge imediato quando elegível.
- **Permissões do GitHub Actions**: ajuste para permitir criação/aprovação de PR por workflow, eliminando falhas 403 operacionais.

### Controle de versão
- `mainsite-frontend`: APP v03.02.00 → APP v03.02.01

## [v03.02.00] — 2026-03-29
### Alterado
- **Autor dinâmico no PostReader**: byline e Schema.org JSON-LD agora consomem `post.author` do banco de dados em vez de string hardcoded. Fallback para "Leonardo Cardozo Vargas" para posts sem autor definido.
- **Edge pre-rendering dinâmico**: `functions/[[path]].js` inclui `author` na query D1 e usa o valor real nas meta tags `article:author` e Schema.org `Article.author`.
- **Tipo `Post` expandido**: campo `author?: string` adicionado à interface em `types.ts`.

### Controle de versão
- `mainsite-frontend`: APP v03.01.03 → APP v03.02.00

## [v03.01.03] — 2026-03-29
### Alterado
- **CI/CD branch standardization**: workflow de deploy do monorepo `mainsite` padronizado para publicar o frontend no branch `main` na Cloudflare Pages, com trigger GitHub em `main` e `concurrency.group` atualizado para `deploy-main`.

### Controle de versão
- `mainsite-frontend`: APP v03.01.02 → APP v03.01.03

## [v03.01.02] — 2026-03-29
### Corrigido
- **OG metadata — tabela D1 corrigida**: `functions/[[path]].js` consultava tabela inexistente `posts` em vez de `mainsite_posts`, causando falha silenciosa na injeção de metadados OG/Schema.org dinâmicos por post. Links compartilhados em redes sociais/WhatsApp agora exibem título, descrição e URL específicos do post.

### Controle de versão
- `mainsite-frontend`: APP v03.01.01 → APP v03.01.02
## [v03.01.01] — 2026-03-29
### Corrigido
- **Sitemap vazio**: `functions/sitemap.xml.js` corrigido — nome da tabela (`mainsite_posts` em vez de `posts`) e nome da coluna (`display_order` em vez de `created_at`) ajustados para refletir o schema real do D1. Sitemap agora retorna URLs válidas para todos os posts publicados.

## [v03.01.00] — 2026-03-29
### Adicionado
- **Fase 4 — Redesign visual editorial**: títulos blue accent (`var(--accent)`), barra divisória gradiente, byline com avatar/autor/data, borda lateral de acento nos posts, barra de progresso de leitura, grid editorial 2 colunas no arquivo, seletores de ano em pill, ícones de compartilhamento minimalistas.

## [v03.00.01] — 29/03/2026
### Corrigido
- **Barras pretas verticais laterais removidas**: eliminado `background-color: #030303` fixo no inline style do `index.html` que causava faixas pretas nas laterais do viewport em telas mais largas que o container de 1126px. O background agora é controlado exclusivamente pelas CSS variables `var(--bg)` — branco em light mode, `#16171d` em dark mode.
- **Dark mode flash prevention**: adicionada media query `prefers-color-scheme: dark` inline para definir `background-color: #16171d` antes do carregamento do CSS externo, evitando lampejo branco para usuários em dark mode.

## [v03.00.00] — 29/03/2026
### Adicionado (MAJOR)
- **Migração TypeScript completa**: todos os 10 componentes migrados de `.jsx` para `.tsx` tipados. Infraestrutura TypeScript adicionada (`tsconfig.json`, `vite-env.d.ts`, `types.ts`).
- **SEO & AI-Era Visibility (GEO/AEO)**: implementada estratégia triple-layer:
  - `robots.txt`: 10 AI crawlers explicitamente permitidos (GPTBot, PerplexityBot, ClaudeBot, Amazonbot, etc.)
  - `index.html`: JSON-LD site-level `WebSite` + `Person` para Google Knowledge Graph e AI engines.
  - `PostReader.tsx`: Schema.org `Article` expandido com `dateModified`, `description`, `wordCount`, `inLanguage`, `articleSection`, `speakable` (voice assistants) e `sameAs` (identity graph).
  - Dynamic meta tags per-post (title, OG, Twitter, canonical) já implementados no `App.tsx`.
- **Edge pre-rendering (HTMLRewriter)**: `[[path]].js` reescrito para injetar Schema.org `Article` + `BreadcrumbList` + OG `article:` properties no edge Cloudflare, garantindo que crawlers sem JS recebam structured data completa. Corrigida duplicação de canonical link.

### Alterado
- **UI/UX tiptap.dev refinements**: tokens de design atualizados — `shape-md` 16→20px, `shape-lg` 24→28px, `shape-xl` 28→32px; shadows mais difusas e ambientes; edge treatment de `border-inline` para `inset box-shadow` sutil.
- **Meta author**: corrigido de "Divagações Filosóficas" para "Leonardo Cardozo Vargas".

### Removido
- Todos os arquivos `.jsx` legados (11 arquivos) substituídos por `.tsx`.
- `main.jsx` substituído por `main.tsx`.

## [v02.21.01] — 28/03/2026
### Corrigido
- **DonationModal — polling 3DS com ID não canônico**: o fluxo de status do SumUp passou a priorizar `payData.id` (retornado no processamento do pagamento) com fallback para `checkoutId`, evitando inconsistência entre ID de polling e `payment_id` persistido no backend.
- **Transição 3DS → sucesso**: reduzidos cenários em que o modal aguardava apenas o retorno tardio do iframe para avançar, melhorando o tempo de confirmação visual após autenticação.

## [v02.21.00] — 28/03/2026
### Adicionado
- **Integração de Pagamentos SumUp/MP via MCP**: Implementado sistema de pagamentos avançados integrados (SumUp/MercadoPago), com destaque para o processamento robusto do desafio de Autenticação Segura (3DS). O layout do `DonationModal` foi adequado com manipuladores de redirecionamento dinâmico via `iframe` para a captura da etapa `next_step` e confirmações do banco emissor.

### Corrigido/Alterado
- **Ajuste flexível na Content-Security-Policy (CSP)**: As regras do `public/_headers` foram relaxadas (`https:`) para transpor as limitações de bloqueio que ocorriam na renderização de gateways terceirizados, scripts embarcados do SumUp/Mercado Pago, e redirecionamentos cross-origin complexos do fluxo emissor 3DS.


## [v02.20.00] — 26/03/2026
### Removido
- **Hardcoded text-indent e paragraphSpacing em `.html-content p`**: removidos os defaults forçados de `text-indent: 3.5rem` e `margin-bottom: 2.2rem` para posts HTML (TipTap). Agora o `text-indent` vem exclusivamente do inline style definido pelo editor, e o espaçamento entre parágrafos usa `1.2rem` neutro. Posts legados (`.p-content`) mantêm os valores configuráveis do admin
- **Override `text-indent: 0` em parágrafos alinhados** (`p[style*="text-align"]`): regra CSS removida — o editor agora controla o recuo por parágrafo individualmente

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
