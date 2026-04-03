# AI Memory Log - mainsite
 
## 2026-04-03 — Mainsite Frontend v03.04.01 — Integração Frontend com Workers AI
### Alterado
- **Rotas AI Atualizadas**: substituição dos hooks de API do Gemini (`/api/ai/public/translate` e `summarize`) no `PostReader` pelas rotas nativas da infraestrutura da Cloudflare `mainsite-worker` (`/api/ai/workers/translate` e `summarize`). Reduz custos externos e melhora o tempo de resposta da UI.
### Controle de versão
- `mainsite-frontend`: APP v03.04.00 → APP v03.04.01
 
## 2026-04-03 — Mainsite Worker v02.01.04 — Integração Cloudflare Workers AI
### Adicionado
- **Integração Cloudflare Workers AI**: injeção do binding `AI` (`@cf/meta/...` e `@cf/huggingface/...`) para processamento nativo na Edge a zero custo de API outbound.
- **Análise de Sentimento (Anti-toxicidade)**: adicionado filtro de tensão explícita e feedback positivo via AI na submissão de formulário de contato (`POST /api/contact`) e comentários (`POST /api/comment`), adicionando marcações contextuais na subject/body dos painéis admin de email.
- **Micro-primitivas na Edge**: criadas duas rotas extremamente rápidas (`/api/ai/workers/translate` usando `m2m100-1.2b` e `/api/ai/workers/summarize` usando `llama-3-8b-instruct`) desacopladas do framework Gemini para baixa latência.
### Controle de versão
- `mainsite-worker`: v02.01.03 → v02.01.04

## 2026-04-01 — Mainsite Frontend v03.03.04 — Zoom Controls Reintegrated Into FloatingControls Pattern
### Corrigido
- **Paridade visual restaurada**: o zoom foi reintegrado ao `FloatingControls`, adotando o mesmo FAB vertical, o mesmo spacing e a mesma lógica de rearranjo horizontal quando o chat abre.
- **Componente fora do padrão removido**: `FloatingTextZoomControl.tsx` foi eliminado após confirmação de que quebrava o design system do mainsite.
### Controle de versão
- `mainsite-frontend`: APP v03.03.03 → APP v03.03.04

## 2026-04-01 — Mainsite Frontend v03.03.03 — Text Zoom Analytics Disabled Until Backend Exists
### Corrigido
- **404 em produção eliminado**: `useTextZoomAnalytics` foi mantido como infraestrutura futura, porém desativado por padrão; `PostReader` não ativa mais tracking remoto para `/api/analytics/text-zoom` sem endpoint implementado no `mainsite`.
### Controle de versão
- `mainsite-frontend`: APP v03.03.02 → APP v03.03.03

## 2026-04-01 — Mainsite Frontend v03.03.02 — Text Zoom Audit Closure + Workspace Error Sanitation
### Corrigido
- **Fechamento real do text zoom**: `FloatingTextZoomControl.tsx` teve cleanup de props inválidas dentro de `style`, e `useTextZoomVoice.ts` passou a tipar `VoiceCommand.command` como `RegExp` em vez de `string`.
- **Workspace diagnostics zerados**: arquivo `mainsite-frontend/src/components/TEXT_ZOOM_DEMO.ts` removido após identificar que continha pseudo-código TypeScript/JSX não executável e inflava a contagem de erros do workspace apesar do build verde.
- **Gap de processo registrado**: o build do Vite estava verde, mas o workspace TypeScript ainda tinha erros; a diretiva operacional agora volta a exigir checagem de `get_errors` antes de qualquer fechamento final.
### Adicionado
- **Text zoom definitivo no PostReader**: controle movido para padrão flutuante com `createPortal`, atalhos globais de teclado, presets de acessibilidade e integração inicial com hooks de analytics/cloud sync/voice.
### Controle de versão
- `mainsite-frontend`: APP v03.02.05 → APP v03.03.02

## 2026-03-29 — Admin-App v01.73.00 + Mainsite Frontend v03.02.00 + Worker v02.01.01 — Dynamic Post Author
### Adicionado
- **Autor dinâmico de posts**: campo `author` adicionado ao schema `mainsite_posts` (D1) com auto-migração (`ensureAuthorColumn`). `PostEditor` exibe input "Autor do post" entre título e editor. Backend admin-app (`posts.ts`) persiste `author` em INSERT/UPDATE/SELECT. Worker (`posts.ts`) atualizado com paridade.
- **PostReader dinâmico**: byline, Schema.org JSON-LD e edge pre-rendering (`[[path]].js`) consomem `post.author` do D1 em vez de string hardcoded. Fallback "Leonardo Cardozo Vargas" quando vazio.
- **Tipo `Post` expandido**: `author?: string` adicionado em `mainsite-frontend/src/types.ts` e `ManagedPost` no admin-app.
### Controle de versão
- `admin-app`: APP v01.72.01 → APP v01.73.00
- `mainsite-frontend`: APP v03.01.03 → APP v03.02.00
- `mainsite-worker`: v02.01.00 → v02.01.01

## 2026-03-29 — Mainsite Frontend v03.01.02 — OG Metadata Table Fix
### Corrigido
- **OG metadata — tabela D1**: `functions/[[path]].js` consultava tabela inexistente `posts` em vez de `mainsite_posts`. Causava falha silenciosa — links compartilhados em WhatsApp/redes sociais não exibiam título/descrição específicos do post.
### Controle de versão
- `mainsite-frontend`: APP v03.01.01 → APP v03.01.02

## 2026-03-29 — Admin-App v01.67.02 + Mainsite v03.01.01/v02.00.01 — Refund Detection + Sitemap Fix
### Corrigido
- **Financeiro/SumUp — detecção inteligente de reembolsos**: `sumup-sync.ts` e `financeiro.ts` (admin-app) + `payments-sumup.ts` (mainsite-worker) agora iteram todo `transactions[]` do checkout SumUp. Transações `type: "REFUND"` são somadas para resolver `REFUNDED` (total) ou `PARTIALLY_REFUNDED` (parcial). Antes, apenas `transactions[0]` era lido.
- **Financeiro/MP — detecção de reembolso parcial**: `payments-mp.ts` expandido para verificar `refunds[]`/`refund_resources[]` no payload.
- **Prioridade do provedor**: regra formalizada — dados de APIs SumUp/MP sempre sobrescrevem D1; banco serve apenas como cache offline.
- **Sitemap vazio**: `functions/sitemap.xml.js` corrigido — tabela `mainsite_posts` (não `posts`) e coluna `display_order` (não `created_at`).
- **TypeScript lint errors**: interfaces explícitas (`SumUpTransaction`, `SumUpCheckout`, `FinancialLog`), import `D1Database`, tipagem estrita de handlers. Zero `any` implícito.
- **Deps — vulnerabilidades**: `brace-expansion` (moderate) e `picomatch` (high) corrigidos via `npm audit fix`.
### Controle de versão
- `admin-app`: APP v01.67.01 → APP v01.67.02
- `mainsite-frontend`: APP v03.01.00 → APP v03.01.01
- `mainsite-worker`: v02.00.00 → v02.00.01

## 2026-03-29 — Mainsite Frontend v03.00.01 — Black Bars Fix + Settings Audit
### Corrigido
- **Barras pretas verticais laterais removidas**: eliminado `background-color: #030303` fixo no inline style do `index.html` que criava faixas escuras nas laterais do viewport em telas > 1126px. Background agora controlado exclusivamente por CSS variables `var(--bg)`.
- **Dark mode flash prevention**: media query `prefers-color-scheme: dark` adicionada inline para definir `#16171d` antes do CSS externo carregar.
### Auditoria de Settings (Admin-App → D1 → Worker → Frontend)
- **Appearance**: Admin ConfigModule PUT → D1 `mainsite/appearance` → Worker GET `/api/settings` → Frontend `App.tsx` → PostReader inline styles ✅
- **Rotation**: Admin ConfigModule PUT → D1 `mainsite/rotation` → Worker cron (heartbeat `* * * * *`, rotação efetiva conforme `interval`) ✅
- **Disclaimers**: Admin MainsiteModule PUT → D1 `mainsite/disclaimers` → Worker GET `/api/settings/disclaimers` → Frontend DisclaimerModal ✅
- **Rate Limits**: Admin → D1 `mainsite/ratelimit` → Worker middleware per-route ✅
### Controle de versão
- `mainsite-frontend`: APP v03.00.00 → APP v03.00.01

## 2026-03-29 — Mainsite Frontend v03.00.00 — Migração TypeScript + SEO/GEO/AEO + Edge Pre-Rendering
### Adicionado (MAJOR)
- **Migração TypeScript completa**: todos os 10 componentes migrados de `.jsx` para `.tsx` tipados. Infraestrutura TypeScript (`tsconfig.json`, `vite-env.d.ts`, `types.ts`). Build: 327KB JS (104KB gzip), 3.1KB CSS (1.3KB gzip), 1769 módulos.
- **SEO & AI-Era Visibility (GEO/AEO)**: estratégia triple-layer implementada:
  - `robots.txt`: 10 AI crawlers explicitamente permitidos (GPTBot, PerplexityBot, ClaudeBot, Claude-Web, Amazonbot, Google-Extended, Bytespider, Applebot-Extended, meta-externalagent, ChatGPT-User).
  - `index.html`: JSON-LD site-level `WebSite` + `Person` para Knowledge Graph e AI engines.
  - `PostReader.tsx`: Schema.org `Article` expandido com `dateModified`, `description`, `wordCount`, `inLanguage`, `articleSection`, `speakable`, `sameAs`.
  - Dynamic meta tags per-post (title, OG, Twitter, canonical) no `App.tsx`.
- **Edge pre-rendering (HTMLRewriter)**: `[[path]].js` reescrito para injetar Schema.org `Article` + `BreadcrumbList` + OG `article:` properties no edge Cloudflare, cobrindo crawlers sem JS. Corrigida duplicação de canonical link.
### Alterado
- **UI/UX tiptap.dev refinements**: shape tokens bumped (`shape-md` 16→20px, `shape-lg` 24→28px, `shape-xl` 28→32px), shadows mais difusas, edge treatment de `border-inline` para `inset box-shadow`.
- **Meta author**: corrigido de "Reflexos da Alma" para "Leonardo Cardozo Vargas".
### Removido
- Todos os 11 arquivos `.jsx` legados.
### Controle de versão
- `mainsite-frontend`: APP v02.21.01 → APP v03.00.00

## 2026-03-29 — Mainsite Worker v02.00.00 — Decomposição Modular Hono + TypeScript
### Adicionado (MAJOR)
- **Decomposição modular**: monólito `index.js` (3013 linhas) decomposto em 8 módulos de rotas + 4 libs compartilhadas via Hono tipado.
- **Fee Config dinâmico**: `loadFeeConfig()` carrega taxas SumUp/MP da D1 com fallback hardcoded.
### Removido
- Monólito `src/index.js` deletado. Worker renomeado para `mainsite-motor`.
### Controle de versão
- `mainsite-worker`: v01.35.02 → v02.00.00

## 2026-03-28 — Admin-App v01.61.01 — Mainsite Editor Layout Tweaks
### Alterado
- **MainsiteModule**: Removido o botão "Novo Rascunho" da barra de ferramentas.
- **PostEditor**: Botão "Salvar Alterações/Criar post" realocado para a barra superior (`inline-actions`), à esquerda do botão de "Limpar".
- **PopupPortal**: CSS ajustado para permitir que o frame do editor de texto expanda e contraia dinamicamente consumindo todo o pop-up, com margem de 1cm.
### Controle de versão
- `admin-app`: APP v01.61.00 → APP v01.61.01

## 2026-03-28 — SumUp Canonical Checkout ID Reconciliation (Admin-App + Mainsite)
### Corrigido
- **Root cause fechada**: `mainsite_financial_logs` podia alternar entre `checkout.id` e `transaction.id` como `payment_id` durante syncs SumUp. Isso fazia estornos/cancelamentos acertarem um identificador e o painel ler outro, preservando badges em `SUCCESSFUL` apesar do provider já exibir `Refunded`.
- **Admin-App**: `sumup-sync.ts`, `sumup-refund.ts`, `sumup-cancel.ts`, `financeiro.ts`, `reindex-gateways.ts` e `financeiro-helpers.ts` agora convergem para `checkout.id` como chave canônica e preservam estados terminais na reconciliação.
- **Mainsite Worker/Admin**: `sumup/sync`, rotas de refund/cancel e aliases legados foram ajustados para atualizar tanto registros canônicos quanto legados, impedindo regressão visual no `mainsite-admin/financeiro/sumup`.

### Controle de versão
- `admin-app`: APP v01.59.01 → APP v01.59.02
- `mainsite-admin`: APP v03.46.06 → APP v03.46.07
- `mainsite-worker`: v01.35.01 → v01.35.02

## 2026-03-28 — Mainsite-Frontend v02.21.00 + Worker v01.35.00 — Pagamentos 3DS e CSP
### Adicionado
- **Integração SumUp via MCP / Desafio 3DS**: Implementação robusta do fluxo de pagamento 3DS (Autenticação Segura) no ecossistema do Mainsite. O `DonationModal` (`mainsite-frontend`) lida dinamicamente com o payload pass-through de autorização (`next_step`), renderizando o contexto do banco emissor dentro de um `iframe` sob demanda.
- **Worker Endpoints**: Criação/ampliação dos endpoints no `mainsite-worker` projetados para delegar requisições e processamento remoto para o gateway SumUp conectado via MCP do workspace global, incluindo fluxos de webhook públicos, tratativas de polling e bypass transacional pós-sucesso.
- **Mercado Pago API SDK**: Incorporação pareada com SumUp dentro do mesmo componente modal global (Cartão de Crédito).
### Alterado / Segurança
- **CSP Relaxed**: Para contornar bloqueios estritos impostos à renderização terceirizada cross-origin (iframe 3DS de múltiplos emissores bancários, Mercado Pago SDK), o cabeçalho `public/_headers` (Content-Security-Policy) da Cloudflare do frontend público foi relaxado para origens `https:` genéricas provisórias.
### Controle de versão
- `mainsite-frontend`: v02.20.00 → v02.21.00.
- `mainsite-worker`: v01.34.00 → v01.35.00.

## 2026-03-26 — Mainsite Admin v03.46.04 — PopupPortal Dialog Fix

### Diálogos suprimidos no PopupPortal
- **Causa raiz**: `window.prompt()` e `ReactDOM.createPortal(document.body)` referenciavam a janela **principal** (host), não a janela **popup** onde o editor roda. Browsers modernos suprimem `prompt()`/`confirm()` de janelas não-ativas com erro "not the active tab of the front window."
- **Fix prompt modal**: portal target mudou de `document.body` para `editor.view.dom.ownerDocument.body` — modal agora renderiza na popup.
- **Fix BubbleMenu link**: `window.prompt()` substituído por `editor.view.dom.ownerDocument.defaultView.prompt()` — usa a popup window.

### Controle de versão
- `mainsite-admin`: v03.46.03 → v03.46.04.

### Qualidade
- `npm run build` ✅ mainsite-admin (583ms)

## 2026-03-26 — Mainsite Admin v03.46.03 — Menus Arrastáveis + Toolbar Dinâmica

### Menus flutuantes arrastáveis
- **BubbleMenu + FloatingMenu**: drag-and-drop via `onMouseDown` no fundo do menu (botões excluídos do drag via `e.target.closest('button')`).
- Drag handlers registrados no `ownerDocument` da popup (mousemove/mouseup).
- `dragPos` sobrescreve `autoPos` durante arraste; reseta ao mudar a seleção.
- Cursor `grab` (idle) / `grabbing` (arrastando). CSS `.dragging` com `user-select: none`.

### Viewport clamping
- Ambos os menus clampeados ao viewport em auto-posicionamento (`Math.max(4, Math.min(pos, vp - menuSize - 4))`).
- FloatingMenu: se não cabe à esquerda do cursor, reposiciona à direita.
- BubbleMenu: computa `left` como `center - menuW/2` (antes usava `translateX(-50%)` que clampeava mal).

### Toolbar dinâmica (Word-like)
- **MenuBar** `useEffect`: adicionado `editor.on('selectionUpdate', forceUpdate)` além de `transaction`.
- `isActive()` agora é reavaliado em **cada mudança de cursor**, refletindo formatação do texto na posição corrente (bold ativa quando cursor está em texto negrito, desativa quando sai).

### Controle de versão
- `mainsite-admin`: v03.46.02 → v03.46.03.

### Qualidade
- `npm run build` ✅ mainsite-admin (604ms)

## 2026-03-26 — Mainsite Admin v03.46.02 — Editor UI Fixes (3 bugs)

### Botão Justify sempre pressionado
- **Causa raiz**: `TextAlign.configure({ defaultAlignment: 'justify' })` fazia todos os parágrafos terem `textAlign=justify` por padrão → `editor.isActive({ textAlign: 'justify' })` retornava `true` sempre.
- **Fix**: Removido `defaultAlignment: 'justify'` → default volta a `'left'` (nativo TipTap).

### Indicador visual de botão ativo insuficiente
- **Causa raiz**: `getActiveStyle()` usava mudanças sutis (background, inset shadow) insuficientes para distinguir visualmente botão idle vs ativo.
- **Fix**: Adicionada borda inferior colorida de 2px (`inset 0 -2px 0 ${tbActiveFg}`), fundo mais contrastante (`0.22`/`0.16` opacidade vs `0.18`/`0.12`), e borda com cor do accent em 40% opacidade.

### FloatingMenu / BubbleMenu cortados
- **Causa raiz**: Ambos os menus usavam `position: fixed` mas estavam renderizados dentro de `.tiptap-wrapper`, cujo pai `editorContainer` tinha `backdropFilter: blur(12px)`. CSS spec: `backdrop-filter` cria um **novo containing block**, transformando `position: fixed` em `position: absolute` relativo ao container. Com `overflow: hidden` no `editorContainer`, os menus eram clippados.
- **Fix**: Migrados para `ReactDOM.createPortal(editor.view.dom.ownerDocument.body)`, saindo do containing block. `position: fixed` agora funciona relativo ao viewport.

### Lint cleanup
- Variável `tbActiveBg` removida (não mais usada após inlining dos valores de background ativo).

### Controle de versão
- `mainsite-admin`: v03.46.01 → v03.46.02.
- `CHANGELOG.md`: entrada v03.46.02 adicionada.
- `.agents/workflows/version-control.md`: tabela atualizada.

### Qualidade
- `npm run build` ✅ mainsite-admin (540ms)

## 2026-03-26 — Mainsite Admin v03.46.01 + Admin _headers Cleanup

### TipTap v3 — View Guard Fix
- **Erro**: `Cannot access view['dom']. The editor may not be mounted yet.` — `MenuBar` e `EditorFloatingMenu` acessavam `editor.view.dom` antes do editor montar.
- **Fix `MenuBar`**: nova prop `editorReady` (state boolean). `EditorPanel` seta `true` via callback `onCreate` do `useEditor`. `MenuBar` retorna `null` enquanto `!editorReady`, prevenindo chamadas a `editor.isActive()` que internamente acessam `view.dom`.
- **Fix `EditorFloatingMenu`**: `editor.view.dom.closest('.tiptap-wrapper')` no setup do `useEffect` agora envolto em `try { editor.view?.dom?.closest(...) } catch {}`.

### Remoção de `_headers` de todos os admins
- **Diretiva do usuário**: admins não precisam de CSP nem controles de cache (Cloudflare Access protege). Apps públicos mantêm CSP.
- **`mainsite-admin/public/_headers`**: deletado.
- **`adminhub/public/_headers`**: deletado.
- **`astrologo-admin/public/_headers`**: deletado.
- Nenhum app-level `Cache-Control` encontrado em código-fonte (todos em `node_modules`).
- Apps não-admin (`mainsite-frontend`, `astrologo-frontend`, `apphub`) mantêm `_headers` com CSP.

### Diretiva permanente registrada
- **Todos os apps**: não precisam de controles próprios de cache — Cloudflare gerencia nativamente.
- **Todos os admins**: não precisam de políticas de CSP — Cloudflare Access controla acesso.

### CSP Report-Only (`script-src 'none'`) no console
- Origem: regra no **Cloudflare edge** (Transform Rules ou managed headers), não do app.
- Fix: Cloudflare Dashboard → domínio admin → Rules → Transform Rules → remover regra que injeta `Content-Security-Policy-Report-Only`.

### Controle de versão
- `mainsite-admin`: v03.46.00 → v03.46.01.
- `adminhub`: v01.04.01 → v01.04.02.
- `astrologo-admin`: v02.14.00 → v02.14.01 (CHANGELOG only, sem APP_VERSION no código).

### Qualidade
- `npm run build` ✅ mainsite-admin (934ms)

## 2026-03-26 — Mainsite Admin v03.46.00 — AI Freeform + Editor Bugfixes + Media Fix

### IA: Instrução Livre (Gemini Freeform)
- **[NEW] Botão `Wand2`** no final da segunda fileira da toolbar do editor. Abre popover glassmorphic com textarea para instrução em linguagem natural.
- **Comportamento**: se há texto selecionado → envia seleção. Sem seleção → envia conteúdo inteiro do editor.
- **Worker — ação `freeform`**: `POST /api/ai/transform` aceita `action: 'freeform'` + campo `instruction`. System prompt instrui o Gemini a atuar como Microsoft Word Copilot profissional: retorna apenas texto transformado, preserva HTML, executa instrução com precisão cirúrgica.
- **Keyboard**: `Enter` envia, `Shift+Enter` nova linha, `Escape` fecha.
- **Reutiliza** toda infra existente: token counting, retry, safety settings, structured logging.

### Editor Toolbar Bugfixes (v03.45.01 → v03.45.02)
- **Botões ativos**: `MenuBar` recebeu `editor.on('transaction')` com `setTick()` para forçar re-render e ler `editor.isActive()` corretamente.
- **BubbleMenu/FloatingMenu**: migrados para `position: fixed` com `editor.view.dom.ownerDocument.defaultView` (viewport correta no PopupPortal).
- **FloatingMenu**: scroll listener no popup window para esconder menu durante scroll.
- **toolbarBtn CSS**: removida dependência de `var(--tb-*)` que não resolve no PopupPortal; agora usa cálculos diretos baseados em `isDarkBase`/`activePalette`.

### Imagens 404 no Editor
- **Causa raiz**: `mainsite-admin` não tinha R2 binding nem rota de mídia. Imagens com src `/api/mainsite/media/filename.png` eram proxied para o worker que não serve R2.
- **Fix**: `wrangler.json` recebeu `MEDIA_BUCKET` R2 binding (`mainsite-media`). `[NEW] functions/api/mainsite/media/[filename].js` serve R2 diretamente (idêntico ao frontend). Rota específica tem prioridade sobre catch-all `[[path]].js`.

### TipTap View Error Guard
- **Erro**: `Cannot access view['dom']. The editor may not be mounted yet.` — transação trigger re-render antes do editor montar.
- **Fix**: `editor.view?.dom` guard + try/catch no handler de transação.

### Controle de versão
- `mainsite-admin`: v03.45.02 → v03.46.00.
- `CHANGELOG.md`: entrada v03.46.00 adicionada.
- `.agents/workflows/version-control.md`: tabela atualizada.

### Qualidade
- `npm run build` ✅ mainsite-admin (564ms)

## 2026-03-26 — Admin-App v01.47.00 + Mainsite Worker — updated_at Infrastructure

### Coluna updated_at na mainsite_posts
- **ALTER TABLE**: `updated_at DATETIME DEFAULT NULL` adicionada via D1 dashboard.
- **admin-app/posts.ts**: INSERT seta `updated_at = CURRENT_TIMESTAMP`, UPDATE seta `updated_at = CURRENT_TIMESTAMP`, SELECTs incluem `updated_at`, PostRow type e mapPostRow atualizados.
- **mainsite-worker/index.js**: UPDATE de posts (PUT /api/posts/:id) seta `updated_at = CURRENT_TIMESTAMP`.
- Posts antigos: `updated_at = NULL` (graceful fallback no frontend).

### Controle de versão
- `admin-app`: v01.46.24 → v01.47.00.

## 2026-03-25 — Mainsite Admin v03.44.00 — Editor Dialogs + Text Indent + Popup Editor

### PostEditor em Popup Nativo do SO
- **[NEW]** `src/components/PopupPortal.jsx`: componente genérico `window.open()` + `ReactDOM.createPortal`. Auto-sizing (~92% da tela), cópia de stylesheets do parent, monitoramento de close via polling (300ms).
- **App.jsx**: EditorPanel envolvido em `<PopupPortal>`. Botão "Novo" e "Editar" agora abrem janela nativa do SO.
- **Botões Fechar/Limpar**: "Fechar" (X vermelho) fecha popup, "Limpar" (borracha) reseta título + conteúdo do editor.

### Scroll-to-Top/Bottom
- **App.jsx**: FABs flutuantes (ArrowUp/ArrowDown) com glassmorphism, scroll event listener, exibição condicional (>300px para topo, >200px do final para baixo). Mesmo padrão do `FloatingControls.jsx` do frontend.

### Scroll Independente na Área de Edição
- **PopupPortal.jsx**: body mudou de `overflow-y: auto` para `overflow: hidden`. Todos os containers flex receberam `min-height: 0`.
- **EditorPanel.jsx**: toolbar e statusBar com `flexShrink: 0`, tiptap-wrapper é o único elemento com scroll (`overflowY: auto`).

### PostList — Datas Completas
- **PostList.jsx**: exibição alterada de `toLocaleDateString` para `toLocaleString` com formato completo (dd/mm/aaaa, hh:mm:ss). Mostra "Publicado em {data}" e "| Atualizado em {data}" quando `updated_at` difere de `created_at`.

### ProseMirror CSS
- **index.css**: adicionada regra `.ProseMirror { white-space: pre-wrap }` para suprimir warning de console.

### Diálogos do editor em Portal
- **Diálogos do editor** (imagem URL, link, legenda, YouTube) migrados de renderização inline dentro da toolbar para `ReactDOM.createPortal(document.body)`.
- Corrige clipagem e posicionamento não-centralizado na viewport.

## 2026-03-25 — Mainsite Frontend v02.18.00

### PostReader — Rodapé de Metadados
- **PostReader.jsx**: rodapé elegante e discreto (opacity 0.45, 11px, centralizado) entre o conteúdo e a barra de compartilhamento: "Publicado em dd/mm/aaaa, hh:mm:ss | Atualizado em dd/mm/aaaa, hh:mm:ss".

### ArchiveMenu — Cards Reduzidos + Datas
- **Cards ~30% menores**: padding 24→16px, squares 220→154px, grid min 200→140px, border-radius 24→16px, gap 24→16px.
- **Fonte da data +20%**: 10→12px.
- **Datas completas**: dd/mm/aaaa, hh:mm:ss + linha "Atualizado" quando diferente de criação.

### Terser Removido
- **vite.config.js**: `minify: 'terser'` substituído por esbuild nativo com `drop: ['console', 'debugger']`. Build acelerou de ~3s para ~460ms.
- Pacote `terser` removido do `devDependencies`.

### Controle de versão
- `mainsite-frontend`: v02.17.00 → v02.18.00.

## 2026-03-26 — Mainsite Frontend v02.19.00 — CSP + Media Route + Cache Cleanup

### CSP — Google Fonts
- **`_headers`**: adicionado `https://fonts.googleapis.com` ao `style-src` e `font-src 'self' https://fonts.gstatic.com`.

### Rota de mídia R2
- **[NEW] `functions/api/mainsite/media/[filename].js`**: serve imagens R2 no frontend no path `/api/mainsite/media/`, espelhando a rota do admin-app. Corrige 404 em imagens migradas.

### Cache-Control removido
- **`_headers`**: removidas seções de cache (`/image_0.png`, `/assets/*`).
- **Media handlers**: removido `Cache-Control` dos 3 handlers (frontend `/api/media/`, frontend `/api/mainsite/media/`, admin-app `/api/mainsite/media/`).
- Cache agora é gerenciado nativamente pelo Cloudflare.

### Controle de versão
- `mainsite-frontend`: v02.18.00 → v02.19.00.

### Extensão TextIndent (custom TipTap)
- **text-indent como atributo de parágrafo**: 4 níveis (0 / 1.5rem / 2.5rem / 3.5rem).
- Comandos `increaseIndent` / `decreaseIndent` registrados via `addCommands()`.
- Botões de indent/outdent na toolbar com tooltips nativos.
- Serializa `style="text-indent: ..."` no HTML gerado pelo editor.

### Controle de versão
- `mainsite-admin`: v03.43.00 → v03.44.00.

### Qualidade
- `npm run build` ✅ admin (569ms)

### Configurações Globais expandidas (3 → 11 controles)
- **SettingsPanel.jsx**: seção "Configurações Globais" agora inclui: família da fonte (Inter recomendada), tamanhos corpo/título, peso corpo/títulos (select), altura de linha (range slider), alinhamento (select), recuo de parágrafo (select), espaçamento entre parágrafos (select), largura de leitura (select 680px-100%), cor dos links (color picker).
- **DEFAULT_SETTINGS**: `shared` ampliado com `bodyWeight`, `titleWeight`, `lineHeight`, `textAlign`, `textIndent`, `paragraphSpacing`, `contentMaxWidth`, `linkColor`.
- **PostReader.jsx**: todos os 11 valores são consumidos dinamicamente com fallbacks (`||`). Compatível com dados D1 antigos sem as novas propriedades.

### Separação Editor vs. Settings
- **`.html-content p`** mantém `text-align` e `text-indent` como defaults configuráveis pelo admin (preserva posts legados).
- Quando o TipTap define alinhamento explícito via inline `style`, o CSS de maior especificidade sobrescreve o default.
- **`.html-content p[style*="text-align"]`** recebe `text-indent: 0` automático (evita recuo em parágrafos centralizados/alinhados pelo editor).
- **`.p-content`** (plaintext, posts legados) mantém valores configuráveis do admin.

### Largura de leitura dinâmica
- `App.jsx`: `useEffect` muda `#root.style.width` conforme `settings.shared.contentMaxWidth` — opções de 680px (foco total) a tela cheia.

### Controle de versão
- `mainsite-frontend`: v02.16.00 → v02.17.00.
- `mainsite-admin`: v03.42.00 → v03.43.00.

### Qualidade
- `npm run build` ✅ frontend + admin

### Design System — Tipografia Inter
- **Font**: `'Inter', system-ui, sans-serif` via Google Fonts em ambos `index.html` (frontend + admin).
- **Tokens CSS**: `--sans` e `--heading` atualizados em `index.css`.
- **DEFAULT_SETTINGS**: `fontFamily` atualizado para `'Inter'` como primária.

### Design System — Títulos Editoriais
- **PostReader.jsx**: `.h1-title` migrado de `text-transform: uppercase; letter-spacing: 0.3em; font-weight: 800` para `text-transform: none; letter-spacing: -0.02em; font-weight: 700; line-height: 1.15`.
- **Headings H1-H3**: `letter-spacing` negativo, `line-height` explícito, `font-weight: 700/600`.
- **ArchiveMenu.jsx**: títulos de posts removeram `text-transform: uppercase`, `fontWeight` de 800 para 600.

### Design System — Corpo de Texto
- **Peso**: 700 → 500 para parágrafos e listas (leitura mais confortável).
- **Espaçamento**: `margin-bottom` de `1.8rem` → `2.2rem` (ritmo vertical generoso, como tiptap.dev).
- **Links**: `font-weight` de 800 → 600.

### Design System — Botões e UI
- **Letter-spacing**: botões AI de `1.5px` para `0.8px`; share buttons de `1px` para `0.6px`.
- **Font-weight**: botões de 800 → 700/600.
- **Glassmorphism seletivo**: removido `backdrop-filter` dos botões AI (mantido em toasts/modais/floating).

### Design System — Dark Mode
- **Background**: `#131314` (preto puro) → `#16171d` (azul-charcoal, alinhado com `index.css`).
- **Texto**: `#e3e3e3` → `#d1d5db` (contraste mais suave).

### Decisão
- **Accent azul mantido** (`#1a73e8` light / `#8ab4f8` dark) por preferência do usuário, não migrado para roxo.

### Controle de versão
- `mainsite-frontend`: `APP_VERSION` v02.15.00 → v02.16.00.
- `mainsite-admin`: `APP_VERSION` v03.41.00 → v03.42.00.
- `CHANGELOG.md`: entradas v02.16.00 (frontend), v03.42.00 (admin).
- `.agents/workflows/version-control.md`: tabela atualizada.

### Qualidade e validação
- `npm run build` ✅ mainsite-frontend (3.11s)
- `npm run build` ✅ mainsite-admin (869ms)

## 2026-03-25 — Mainsite Admin v03.41.00 + Frontend v02.15.00 (Antigravity Agent)

### TipTap Upgrade + Extensões
- **TipTap v3.20.1 → v3.20.5** (43 pacotes atualizados).
- **BubbleMenu**: componente React customizado — toolbar contextual ao selecionar texto (negrito, itálico, sublinhado, tachado, marca-texto, sub/sobrescrito, código inline, link). TipTap v3 removeu componentes React; implementado com `editor.on('selectionUpdate')` + `getBoundingClientRect()`.
- **FloatingMenu**: componente React customizado — toolbar de inserção em linhas vazias (H1-H3, listas, tarefas, citação, bloco de código, tabela, HR). Posicionamento via `coordsAtPos()`.
- **Focus**: extensão `@tiptap/extension-focus` com `.has-focus` classe no nó ativo.
- **CSS glassmorphism** para BubbleMenu/FloatingMenu compatível com modo claro/escuro.
- `tiptapWrapper` recebeu `position: relative` para ancoragem correta dos menus.

### Correção crítica — Proxy API do Admin
- **Todas as chamadas `/api/*` do admin retornavam 405**: `mainsite-admin` não tinha Service Binding nem `functions/` directory. Requests caíam no SPA fallback (index.html).
- **[NEW]** `functions/api/[[path]].js` — Catch-all proxy via Service Binding interno (idêntico ao frontend).
- **[NEW]** `wrangler.json` → `services: [{ binding: "WORKER", service: "mainsite-app" }]`.

### Auditoria completa de URLs externas lcv.*.br
- **`.env` do admin**: `VITE_BRAND_ICONS_BASE_URL` corrigido de `https://mainsite-app.lcv.rio.br/...` para `/api/uploads/brands`.
- **`.env` do frontend**: mesmo fix aplicado.
- **`admin-app/mainsite-admin.ts`**: `DEFAULT_MAINSITE_WORKER_URL` neutralizado (dead code, zero chamadores).
- **Usos legítimos catalogados**: SEO/canonical (PostReader, sitemap, index.html), webhook MP (notification_url), CORS config, endereços de e-mail, links de navegação (apphub).

### Controle de versão
- `mainsite-admin`: `APP_VERSION` v03.39.00 → v03.40.00 → v03.41.00.
- `mainsite-frontend`: `APP_VERSION` v02.14.00 → v02.15.00.
- `CHANGELOG.md`: entradas v03.40.00, v03.41.00 (admin), v02.15.00 (frontend).
- `.agents/workflows/version-control.md`: tabela atualizada.

### Qualidade e validação
- `npm run build` ✅ mainsite-admin (546ms)
- `npm run build` ✅ mainsite-frontend (3.23s)
- `npm run build` ✅ admin-app (873ms)

## 2026-03-24 — Admin-App v01.45.00 (Antigravity Agent — Dynamic News + Scroll Buttons + MainSite Cleanup)

### Fontes de Notícias Dinâmicas
- **`newsSettings.ts`**: refatorado para `NewsSource[]` com id/name/url/category. Migração automática de localStorage legado. Helper `slugify()`.
- **`feed.ts` (backend)**: aceita fontes customizadas via param `custom_sources` (JSON-encoded). Qualquer URL RSS funciona.
- **ConfigModule**: UI com checkboxes + lixeira por fonte + formulário "Adicionar nova fonte RSS" (nome, URL, categoria).
- **NewsPanel**: passa fontes completas ao backend. Filtro por palavras-chave movido para barra de busca inline (local, sem re-fetch).

### Astrólogo — Email Dialog Inline
- Modal global `confirm-overlay` substituído por formulário inline glassmorphic dentro da linha do registro.
- `autoComplete="email"` ativo, suporte a Enter key. Backend fix: `RESEND_API_KEY` runtime secret documentado.

### Botões Flutuantes de Rolagem
- **[NEW]** `src/components/FloatingScrollButtons.tsx`: FABs ↑/↓ inteligentes baseados em scroll position do `.content`.
- Glassmorphism, animação fadeIn, MutationObserver para detecção de mudança de conteúdo.
- CSS: `.floating-scroll-btns/.floating-scroll-btn` com responsividade.

### MainsiteModule — Remoção de Overview
- Removidos: formulário "Qtd. posts" + botão "Carregar overview" + seção "Últimos posts" + badge BIGDATA_DB.
- Dead code eliminado: `OverviewPayload`, `initialPayload`, `loadOverview`, `handleSubmit`, `overviewLoading`, `limit`, `payload`, `disabled`, imports `Activity`/`Search`/`useMemo`/`FormEvent`.

### Label Accessibility
- Labels sem campo associado convertidas para `<p className="field-label">` em ConfigModule.
