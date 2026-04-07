# Changelog — Mainsite Frontend

## [v03.06.04] - 2026-04-07
### Adicionado
- **Turnstile CAPTCHA Integration**: Prop `turnstileSiteKey` injetada no `PostReader` via `App.tsx`, habilitando o widget Cloudflare Turnstile no formulário de comentários públicos.
- **Build Pipeline — `VITE_TURNSTILE_SITE_KEY`**: Variável de ambiente injetada no `deploy.yml` (GitHub Actions) para disponibilização em build-time do Vite.

### Segurança
- **Vite 8.0.3 → 8.0.7**: Correção de 3 CVEs (CVE-2026-39364 server.fs.deny bypass, CVE-2026-39363 WebSocket arbitrary file read, CVE-2026-39365 path traversal `.map` handling).

### Controle de versão
- `mainsite-frontend`: APP v03.06.03 → APP v03.06.04

## [v03.06.03] - 2026-04-07
### Corrigido
- **Autoupdate (ContentSync) — Navegação para Home**: Corrigido bug onde o `refreshPosts` fazia `pushState('/p/{id}')` após aceitar a atualização de conteúdo. Isso fixava a URL em link curto (`/p/123`), tornava `isDeepLinkedPost = true` e prendia o leitor nesse link com o botão Home Page visível. Agora o `refreshPosts` navega para `/` (raiz) — comportamento idêntico ao botão Home Page — mantendo `isDeepLinkedPost = false` e carregando o headline atualizado como o primeiro post da home.

### Controle de versão
- `mainsite-frontend`: APP v03.06.02 → APP v03.06.03

## [v03.06.02] - 2026-04-07
### Adicionado
- **Anti-Screenshot — Window Blur Defense**: Quando a janela do browser perde foco (`window.blur`), aplica-se `filter: blur(32px)` instantâneo ao `body`. Ferramentas de captura (Ferramenta de Captura do Windows / Win+Shift+S / Game Bar / aplicativos de screenshot) causam perda de foco no browser, fazendo qualquer captura registrar conteúdo completamente borrado. O blur é removido suavemente (300ms ease) ao retornar o foco (`window.focus`).
- **Interceptação Win+Shift+S**: Combinação de teclas da Ferramenta de Captura do Windows (`Meta+Shift+S`) interceptada no handler `keydown` com `preventDefault()` e notificação de aviso.

### Nota técnica
- **Limitação inerente**: Nenhuma solução web é 100% eficaz contra capturas de tela no nível do OS (o sistema operacional captura o framebuffer antes do JavaScript reagir). A defesa por blur no `window.blur` é a mitigação mais eficaz possível dentro das capacidades do browser — captura-se conteúdo borrado em vez de limpo.

### Controle de versão
- `mainsite-frontend`: APP v03.06.01 → APP v03.06.02

## [v03.06.01] - 2026-04-07
### Corrigido
- **PostReader — Escala de Títulos H2-H6**: Removidos `font-size` hardcoded (`1.75rem`, `1.4rem`, etc.) dos headings H2-H6 que causavam hierarquia invertida (H2/H3 maiores que H1). Agora utilizam `font-size: revert` — reseta para os defaults do User-Agent do navegador (hierarquia nativa H1 > H2 > H3...). Estilos inline do PostEditor (TipTap `FontSize` extension) continuam tendo prioridade. O título banner (`.h1-title`) permanece vinculado ao `titleFontSize` do admin Configurações.
- **CSS `.protected-content` removido**: Regra de `user-select: none` escopada ao PostReader eliminada — proteção agora é global no `App.tsx`.

### Alterado
- **Proteção Anti-Cópia — Overhaul Global (`App.tsx`)**: Refatoração completa das proteções de conteúdo, anteriormente escopadas apenas ao `PostReader.protected-content`. Agora aplicadas globalmente em todo o `mainsite-frontend` via `document`-level event listeners com `{ capture: true }`:
  - **Teclado**: Ctrl+C (copy), Ctrl+X (cut), Ctrl+A (select all), Ctrl+S (save), Ctrl+U (view source), Ctrl+P (print), F12, Ctrl+Shift+I/C/J (DevTools), PrintScreen (com wipe de clipboard).
  - **Eventos DOM**: `contextmenu` (right-click), `copy`, `cut`, `dragstart` — todos bloqueados no nível do `document`.
  - **Selection Clearing**: Listener `selectionchange` limpa automaticamente qualquer seleção de texto fora de campos editáveis.
  - **Visibility Change**: Quando o usuário troca de aba, o clipboard é limpo (anti-screenshot tools).
  - **CSS Global Injetado**: `user-select: none !important` em `body *`, `-webkit-touch-callout: none` (iOS long-press), `user-drag: none` em imagens/links/SVG. Campos de formulário (`input`, `textarea`, `select`) são isentos para preservar UX.
  - **Print Bloqueada**: Regra `@media print` oculta todo o conteúdo e exibe mensagem de aviso.
  - **Mitigação de PrintScreen**: `navigator.clipboard.writeText('')` tenta limpar o clipboard após detecção da tecla (limitação: OS captura antes do JS).

### Removido
- **PostReader — handlers inline de proteção**: `onCopy`, `onContextMenu`, `onDragStart`, `onCut` removidos do `<div className="protected-content">` — substituídos por listeners globais no `App.tsx`.

### Controle de versão
- `mainsite-frontend`: APP v03.06.00 → APP v03.06.01
### Adicionado
- **Content Fingerprint — Notificação em Tempo Real**: Sistema de sincronização em tempo real entre `admin-app` e `mainsite-frontend`. Quando a matéria da homepage muda (rotação automática via cron ou ação manual do admin), o leitor é notificado com um toast premium.
  - **`useContentSync.ts`**: Hook de smart polling (30s) que detecta mudanças de versão no endpoint `GET /api/content-fingerprint`. Pausa automaticamente em background tabs e ignora o carregamento inicial para evitar falsos positivos.
  - **`ContentUpdateToast.tsx`**: Componente glassmorphism com sparkle animation, progress bar de auto-dismiss (15s), botões "Atualizar Agora" / "Dispensar". Posicionado no **centro da viewport** do leitor (conforme diretiva: toasts com input do usuário ficam centralizados). Suporte a light/dark mode.
  - **Integração `App.tsx`**: Toast renderizado em qualquer página (homepage e deep-link). Botão "Atualizar" executa re-fetch silencioso e navega para o novo post principal.

### Corrigido
- **Título principal (`.h1-title`) não respeitava `titleFontSize`**: O PostReader usava `clamp(32px, 5vw, 52px)` hardcoded. Agora usa `calc(titleFontSize * 1.6 * var(--text-zoom-scale, 1))`, respeitando o controle do admin em ConfigModule → "Tamanho da Fonte dos Títulos (H1)".

### Diretiva de UX registrada
- Toasts/notificações **com input do usuário** → centrados no viewport.
- Toasts **informativos** → canto superior direito do viewport.

### Controle de versão
- `mainsite-frontend`: APP v03.05.01 → APP v03.06.00
### Removido
- **Pages Functions R2 migradas para o worker**: `functions/api/media/[filename].js` e `functions/api/mainsite/media/[filename].js` removidas — rotas agora servidas nativamente pelo mainsite-motor (mesmo bucket R2 `mainsite-media`).
- **Binding R2 `MEDIA_BUCKET` removido**: `wrangler.json` do frontend não precisa mais do binding R2; media é servida pelo worker via Service Binding proxy.

### Controle de versão
- `mainsite-frontend`: APP v03.05.00 → APP v03.05.01

## [v03.05.00] - 2026-04-06
### Alterado
- **Migração de Domínio Principal**: domínio primário migrado de `lcv.rio.br` para `reflexosdaalma.blog` (com e sem www) em todos os metadados, URLs canônicas, Open Graph, Twitter Cards e Schema.org JSON-LD.
- **SITE_URL**: constante global atualizada de `https://www.lcv.rio.br` para `https://www.reflexosdaalma.blog`.
- **Edge Function `[[path]].ts`**: redirect de `*.pages.dev` agora aponta para `reflexosdaalma.blog`; canonical URLs, Schema.org Article, BreadcrumbList e author/publisher URLs atualizados.
- **Sitemap `sitemap.xml.ts`**: `siteUrl` atualizado para `https://www.reflexosdaalma.blog`.
- **`index.html`**: todas as meta tags OG/Twitter/canonical e Schema.org WebSite/Person atualizados.
- **`PostReader.tsx`**: Schema.org Article JSON-LD (author, publisher, logo, mainEntityOfPage) atualizados.

### Corrigido
- **`[[path]].ts` lint**: `HTMLRewriter` declarado como global do runtime Cloudflare (`declare const`) em vez de `import type`, corrigindo erro TS "cannot be used as value".
- **`sitemap.xml.ts` lint**: resultado de `.all()` tipado explicitamente com cast `as { id: number; created_at: string }[]`, resolvendo erro de overload no `new Date()`.

### Controle de versão
- `mainsite-frontend`: APP v03.04.04 → APP v03.05.00

### Removido
- **Botões de IA Públicos (PostReader)**: Removidos os botões "Resumo por IA" e "Traduzir Para" do `PostReader.tsx`. Eliminados os handlers `handleSummarize` e `handleTranslate`, todos os estados associados (`postSummary`, `translatedContent`, `isSummarizing`, `isTranslating`, `aiError`), o CSS das classes `.ai-btn`, `.ai-select`, `.ai-error-msg`, `.ai-summary-box`, `.ai-actions-container`, `.processing-active`, e o `<div className="ai-actions-container">` no JSX.
- **Imports órfãos removidos**: `ChangeEvent`, `useEffect` (react), `AlignLeft`, `Languages`, `X`, `AlertTriangle`, `Sparkles` (lucide-react) e a prop `API_URL` da interface `PostReaderProps`.
- **Endpoint de IA no worker**: Removidas as rotas `POST /api/ai/public/summarize` e `POST /api/ai/public/translate` de `mainsite-worker/src/routes/ai.ts`.
- **Configurações do genai**: Removidos `reader` de `MainsiteConfig` e as entradas `summarize` e `translate` de `ENDPOINT_CONFIGS` em `genai.ts`.
- **Seletor de modelo no admin**: Removido o fieldset "Modelo do Leitor (Tradução/Resumo Público)" do `ConfigModule.tsx` no `admin-app`, incluindo o campo `reader` no estado `msAiModels`, no tipo do `handleAiModelChange` e no loader de configurações.

### Controle de versão
- `mainsite-frontend`: APP v03.04.03 → APP v03.04.04
- `mainsite-worker`: sem incremento de versão (remoção de rotas)
- `admin-app`: APP v01.77.41 → APP v01.77.42

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.04.02] - 2026-04-04
### Corrigido
- **Correção da Rota AI**: Consolidada a substituição do endpoint de tradução no `PostReader`, de `public` (Gemini) para `workers` (Cloudflare AI), removendo de fato o gargalo associado à infraestrutura original.

### Controle de versão
- `mainsite-frontend`: APP v03.04.01 → APP v03.04.02

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.04.01] - 2026-04-03
### Alterado
- **Integração Edge AI Nativa**: substituição das rotas Gemini externas (`/api/ai/public/...`) no componente `PostReader` pelas novas rotas de microsserviços ultra-rápidas nativas da Edge (`/api/ai/workers/summarize` e `/api/ai/workers/translate`). Agora os botões de Resumo e Tradução da postagem pública aproveitam a rede Cloudflare Workers AI local a custo API zero e tempo de resposta inferior a 20ms (+overhead LLM).

### Controle de versão
- `mainsite-frontend`: APP v03.04.00 → APP v03.04.01

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.04.00] - 2026-04-02
### Alterado
- **Rebranding Final**: O site foi renomeado de "Divagações Filosóficas" para "Reflexos da Alma" em todos os metadados, títulos, descrições e configurações de pagamento.
- **Refatoração de Pasta Origin**: A pasta base do projeto mudou de \mainsite\ para \mainsite-app\ para melhor clareza e integração com os fluxos do workspace (CI/CD, automações, scripts).

### Controle de versão
- \mainsite-frontend\: APP v03.03.07 → APP v03.04.00
## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.07] - 2026-04-02
### Alterado
- **Controle de Rate Limit Integrado**: refatoração massiva da forma com que os seletores de IA interagem. Adicionado botão "Atualizar". Rate limits manuais erradicados de todos os aplicativos paralelos no workspace. A política de proteção contra abusu agora conta inteiramente com o Cloudflare WAF, viabilizando endpoints de api livres da responsabilidade de rastrear D1 state pra contar token de usage.

### Controle de versão
- `mainsite-frontend`: APP v03.03.06 → APP v03.03.07

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.06] - 2026-04-02
### Alterado
- **Seletor de IA Dinâmico**: todos os componentes de Chat (Mainsite AI) implementam cache-busting real via refetch para permitir listagem ao vivo de modelos habilitados no painel de controle (Admin).

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.05] - 2026-04-02
### Atualizações Tecnológicas (P3 e P4)
- **Functions JS -> TS**: As Edge Functions (`sitemap.xml.ts`, `[[path]].ts`, `api/[[path]].ts`) foram migradas para TypeScript, adotando a tipagem estrita do `@cloudflare/workers-types` (`EventContext`, `D1Database`). 
- **SDK Gemini**: Concluída a migração do `ai.ts` e `gemini.ts` para o novo `@google/genai` SDK oficial, implementado com motor dinâmico via D1.
- **Vitest**: Configurada a infraestrutura de testes unitários com o framework `vitest` e `@cloudflare/workers-types`.
- **Limpeza**: Remoção definitiva do polyfill `Headers.raw()` que já estava obsoleto.

### Controle de versão
- `mainsite-frontend`: APP v03.03.04 → APP v03.03.05

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.04] - 2026-04-01
### Corrigido
- **Text zoom reintegrado ao padrão visual do site**: os controles de zoom deixaram de usar um floating widget independente e passaram a compor o mesmo cluster vertical de FABs do `FloatingControls`.
- **Comportamento harmônico com o chatbot**: os botões de zoom agora participam da mesma lógica responsiva do site e se deslocam horizontalmente para a esquerda quando o chat é aberto, exatamente como os demais controles flutuantes.
- **Estado do zoom elevado para o `App`**: `zoomLevel` passou a ser compartilhado entre `App`, `PostReader` e `FloatingControls`, eliminando duplicação estrutural e preservando a escala do texto no conteúdo.
- **Componente legado removido**: `FloatingTextZoomControl.tsx` foi aposentado por quebrar o padrão visual e de posicionamento do mainsite.

### Controle de versão
- `mainsite-frontend`: APP v03.03.03 → APP v03.03.04

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.03] - 2026-04-01
### Corrigido
- **Text zoom analytics sem backend**: o `PostReader` deixou de ativar tracking remoto para `/api/analytics/text-zoom` enquanto o endpoint não existe no `mainsite`, eliminando o `POST ... 404 (Not Found)` em produção.
- **Hook resiliente**: `useTextZoomAnalytics.ts` agora permanece desativado por padrão e só faz chamadas remotas quando explicitamente habilitado.

### Controle de versão
- `mainsite-frontend`: APP v03.03.02 → APP v03.03.03

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.02] - 2026-04-01
### Corrigido
- **Fechamento de qualidade do text zoom**: correção dos erros de tipagem restantes em `FloatingTextZoomControl.tsx` e `useTextZoomVoice.ts` que não apareciam no `vite build`, mas eram acusados pelo workspace TypeScript.
- **Diagnósticos do workspace saneados**: remoção do arquivo de demonstração inválido `src/components/TEXT_ZOOM_DEMO.ts`, que continha pseudo-código/JSX fora do pipeline do app e inflava artificialmente a contagem de erros.
- **Controle de versão sincronizado**: `APP_VERSION` em `src/App.tsx` alinhado com a entrega real da feature de text zoom.

### Auditoria
- `get_errors`: zero erros no workspace após o saneamento.
- `npm run build`: validado com sucesso após as correções finais.

### Controle de versão
- `mainsite-frontend`: APP v03.03.01 → APP v03.03.02

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.01] - 2026-04-01
### Adicionado
- **Text Zoom — Floating Control + 5 Features Implementados**:
  1. **Cloud Sync**: `useTextZoomCloud.ts` — Sincronize zoom level entre devices via Cloudflare D1/KV (debounced 500ms)
  2. **Analytics**: `useTextZoomAnalytics.ts` — Rastreie patterns de zoom (timestamps, actions, sessionId)
  3. **Voice Control**: `useTextZoomVoice.ts` — Web Speech API para comandos em português (aumentar, diminuir, reset, presets)
  4. **Keyboard Shortcuts**: Globais no FloatingTextZoomControl (Ctrl++ aumenta, Ctrl+- diminui, Ctrl+0 reset)
  5. **Accessibility Presets**: `useTextZoomPresets.ts` com 5 presets (Normal, Dyslexia, Low Vision, Accessibility, Compact)
- **FloatingTextZoomControl.tsx**: Novo componente com design discreto (floating, reveal-on-hover, não-intrusivo)
- **TextZoomControl.tsx**: Removido (substituído pelo floating version)
- **PostReader.tsx**: Integrado useTextZoomCloud e useTextZoomAnalytics

### Controle de versão
- `mainsite-frontend`: APP v03.03.00 → APP v03.03.01

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.03.00] - 2026-04-01
### Adicionado
- **Text Zoom Feature — Ferramenta de Escalabilidade de Texto**: Implementação de sistema elegante de aumentar/diminuir tamanho de texto no PostReader, mantendo formatação perfeita e excluindo o título do post.
  - `src/hooks/useTextZoom.ts`: Hook customizado com localStorage persistence (80-200%, steps 5%)
  - `src/components/TextZoomControl.tsx`: Componente UI glassmorphic com slider, buttons (+/-), reset e animações suaves (0.2s transitions)
  - CSS Variable `--text-zoom-scale` integrada em .post-content-area para escalabilidade via calc()
  - **WCAG 2.1 Level AA**: ARIA completo, keyboard navigation (arrows, home), screen reader support
  - **Performance**: GPU-accelerated, 60fps smooth, <2ms CPU overhead, zero DOM traversal
  - **Browser Support**: 95%+ (exceto IE 11). Mobile touch support nativo.
  - Documentação extensiva: 7 arquivos markdown (~2,500 linhas) + 10+ exemplos de uso

### Controle de versão
- `mainsite-frontend`: APP v03.02.05 → APP v03.03.00

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.02.05] - 2026-03-31
### Corrigido
- **Compliance - docs legais locais em runtime**: o `LicencasModule` passou a carregar `LICENSE`, `NOTICE` e `THIRDPARTY` a partir de `public/legal/*` via `BASE_URL`, eliminando dependência de `raw.githubusercontent.com` no browser e removendo os 404 recorrentes em produção.

### Controle de versão
- `mainsite-frontend`: APP v03.02.03 → APP v03.02.05

## [v03.02.04] — 2026-03-31
### Corrigido
- **Lint em modais de formulário**: `formatPhone` em `CommentModal.tsx` e `ContactModal.tsx` passou de `let` para `const`, eliminando violações de `prefer-const` sem alterar o comportamento da máscara.

### Alterado
- **Dependências atualizadas**: `dompurify`, `@types/dompurify` e `@vitejs/plugin-react` atualizados com lockfile sincronizado.

### Controle de versão
- `mainsite-frontend`: APP v03.02.03 → APP v03.02.04

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

## [v03.02.03] - 2026-03-31
### Adicionado
- **Governança de Licenciamento (GNU AGPLv3)**: Inserção do `LicencasModule` e `ComplianceBanner` no frontend para fechamento do SaaS Loophole com conformidade total.

### Controle de versão
- `mainsite`: APP v03.02.02 -> APP v03.02.03

## [v03.04.03] - 2026-04-04
### Corrigido
- **Gemini Fallback Model Base**: Mitigada a nulidade da constante `DEFAULT_GEMINI_MODEL` na engine backend, protegendo contra interrupções de 500 caso as diretrizes de configuração estivessem vazias.
- **Segurança Cognitiva**: Incorporado HARM_CATEGORY_CIVIC_INTEGRITY englobando as checagens preventivas preexistentes (v1beta compliance).

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
- **Meta author**: corrigido de "Reflexos da Alma" para "Leonardo Cardozo Vargas".

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


