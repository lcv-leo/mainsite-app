

## 📋 DIRETIVAS DO PROJETO E REGRAS DE CÓDIGO
# Regras
- Use princípios de Clean Code.
- Comente lógicas complexas.


## 🧠 MEMÓRIA DE CONTEXTO ISOLADO (MAINSITE-APP)
# AI Memory Log - MainSite

## 2026-04-17 — Mainsite Frontend v03.15.02 (Pages observability rollback after GHA failure)
### Escopo
Hotfix de deploy no `mainsite-app` após o GitHub Actions confirmar que `observability` não é suportado em config de Cloudflare Pages.
### Alterado
- `mainsite-frontend/wrangler.json` deixou de declarar `observability` por ser config de Pages.
- `mainsite-worker/wrangler.json` manteve `observability` porque segue sendo config de Worker e já estava validado.
### Motivação
- Restaurar o deploy do `mainsite-frontend` sem perder a telemetria explícita do worker publicado.
### Versão
- mainsite-frontend: APP v03.15.01 → APP v03.15.02

## 2026-04-17 — Mainsite observability baseline (frontend v03.15.01, worker v02.11.01)
### Escopo
Padronização do baseline de observabilidade Cloudflare no `mainsite-app`, cobrindo `mainsite-frontend` e `mainsite-worker`.
### Alterado
- `mainsite-frontend/wrangler.json` agora garante `observability.logs.enabled = true`, `observability.logs.invocation_logs = true` e `observability.traces.enabled = true`.
- `mainsite-worker/wrangler.json` preservou o sampling existente e passou a garantir `observability.traces.enabled = true`, além do baseline explícito de logs.
### Motivação
- Fechar a padronização de telemetria do workspace sem regressão do runtime publicado.
### Versão
- mainsite-frontend: APP v03.15.00 → APP v03.15.01
- mainsite-worker: APP v02.11.00 → APP v02.11.01


## 2026-04-17 — Mainsite Frontend v03.15.00 (SumUp remount + 3DS redirect/resume + CI)
### Escopo
Fechamento corretivo do `mainsite-frontend` após a rodada de auditoria técnica de 2026-04-17, estabilizando o Payment Widget da SumUp, promovendo os testes ao gate de deploy e registrando explicitamente a decisão operacional do 3DS em cartão.
### Alterado
- **`SumUpCardWidget.tsx`**: a montagem do widget passou a depender de uma chave estável da allowlist de métodos, evitando remount espúrio em rerenders semanticamente idênticos.
- **`SumUpCardWidget.test.tsx`**: o teste de regressão passou a afirmar que rerender com a mesma allowlist lógica não provoca `unmount` nem novo `mount`.
- **Decisão 3DS registrada**: o fluxo de cartão permanece com `redirectUrl` + retomada por `checkout_id`, porque a conta/merchant real não expõe `sca_experience_mode_modal`; o visitante retorna ao mesmo contexto do `mainsite-frontend`, com reabertura do modal, restauração do viewport e avanço para confirmação/agradecimento.
- **CI**: `mainsite-app/.github/workflows/deploy.yml` agora executa `npm run lint` e `npm test` antes do deploy do frontend e do worker.
### Motivação
- Responder ao parecer corretivo do Claude Code sem quebrar o fluxo real de doação, tornando o comportamento do widget verificável, testável e auditável.
### Versão
- mainsite-frontend: APP v03.14.00 → APP v03.15.00

## 2026-04-17 — Payment Widget da SumUp + `theme.css` + hardening de perímetro (frontend v03.14.00, worker v02.11.00)
### Escopo
Fechamento do ciclo atual de endurecimento do `mainsite-app`, concentrando o pagamento no widget oficial da SumUp, reduzindo estilos inline nas superfícies mais sensíveis e endurecendo a borda pública do worker sem quebrar aparência, comportamento ou integrações já operantes.
### Alterado — mainsite-frontend (v03.14.00)
- **Payment Widget como executor único**: `DonationModal.tsx` e `SumUpCardWidget.tsx` consolidaram o fluxo de doação no widget oficial da SumUp. Cartão e `PIX/APMs` passam a seguir o mesmo caminho quando a conta do merchant estiver habilitada pela SumUp.
- **Retorno resiliente por `checkout_id`**: `App.tsx` detecta o retorno da SumUp via query string, reabre o modal, restaura contexto mínimo da doação a partir de `sessionStorage` e confirma o estado final no backend.
- **Theme same-origin**: `index.html` passou a carregar `/api/theme.css`, preservando a personalização de aparência vinda do `admin-app`/D1 sem depender de grandes blocos `<style>` inline.
- **CSS externo nas superfícies críticas**: `ArchiveMenu`, `ChatWidget`, `ContentUpdateToast`, `FloatingControls` e `PostReader` migraram para folhas de estilo dedicadas, reduzindo pressão sobre CSP sem perda de layout/UX.
- **Toast/feedback preservados**: o comportamento de feedback visual continuou relativo ao viewport do usuário, incluindo a retomada do fluxo de doação no retorno da SumUp.
### Alterado — mainsite-worker (v02.11.00)
- **`/api/theme.css`**: novo endpoint gerando variáveis CSS a partir de `mainsite/appearance` no D1.
- **Allowed origins centralizados**: `lib/origins.ts` passou a definir as origens operacionais aceitas para CORS/entrega pública.
- **Auth administrativo endurecido**: `lib/auth.ts` ganhou suporte opcional a Cloudflare Access JWT para rotas administrativas do worker.
- **Pagamentos legacy bloqueados**: `/api/sumup/checkout/:id/pay`, `/api/sumup/checkout/:id/pix` e a return page manual ficaram explicitamente descontinuados com `410`, forçando o uso do widget oficial.
- **Uploads menos expostos**: `routes/uploads.ts` deixou de responder com CORS aberto irrestrito.
### Restrições preservadas
- **`_headers`**: `mainsite-frontend/public/_headers` permaneceu intocado por diretiva explícita.
### Versão
- mainsite-frontend: APP v03.13.02 → APP v03.14.00
- mainsite-worker: APP v02.10.02 → APP v02.11.00

## 2026-04-16 — Text zoom do frontend consolidado como local-only (frontend v03.13.02)
### Escopo
Fechamento de auditoria/versionamento no `mainsite-app` para registrar explicitamente que o text zoom do leitor não possui backend nem sincronização remota.
### Diretriz operacional consolidada
- **Persistência exclusivamente local**: `useTextZoom.ts` persiste apenas em `localStorage` usando a chave `mainsite:text-zoom-level`.
- **Sem contrato remoto**: não existe rota runtime para `/api/user/preferences/text-zoom` nem `/api/analytics/text-zoom` no `mainsite-worker` publicado.
- **Sem sync cloud implícito**: qualquer futura retomada de “zoom cloud” exige definição prévia de identidade real do leitor, storage, contrato de privacidade e backend dedicado.
### Restrições preservadas
- **`_headers`**: permanece intocado por diretiva explícita.
### Versão
- mainsite-frontend: APP v03.13.01 → APP v03.13.02

## 2026-04-16 — Turnstile runtime stabilization + allowlist sync (frontend v03.13.01)
### Escopo
Fechamento do hotfix do `mainsite-frontend` após a regressão operacional do Turnstile no runtime publicado, combinando correções de lifecycle na UI com validação/configuração do widget real via Cloudflare API.
### Alterado — mainsite-frontend (v03.13.01)
- **`ShareOverlay.tsx`**: o widget Turnstile deixou de ser recriado quando o token entra no estado do modal; `setModalState` passou a usar atualização funcional, preservando a instância renderizada.
- **`ContactModal.tsx`, `CommentModal.tsx` e `CommentsSection.tsx`**: callbacks de erro/expiração agora limpam tokens vencidos e exibem mensagem explícita ao usuário.
- **`index.html`**: adicionado `mobile-web-app-capable` para remover o warning de deprecação sem perder o meta legado da Apple.
### Configuração de produção validada via API
- **Widget `mainsite-comments`** (`mode: managed`): allowlist alinhada para `mainsite-frontend.pages.dev`, `reflexosdaalma.blog`, `cardozovargas.com`, `cardozovargas.com.br`, `lcv.eng.br`, `lcv.psc.br`, `lcv.rio.br`, `lcvleo.com`, `lcvmail.com` e `lcvmasker.com`.
- **Operação Cloudflare**: o MCP da Cloudflare já consegue ler/atualizar widgets Turnstile; o `wrangler` local segue sem escopo de Turnstile e precisa de `Turnstile Sites Read` e `Turnstile Sites Write` para ter a mesma capacidade.
### Restrições preservadas
- **`_headers`**: permanece intocado por diretiva explícita.
### Versão
- mainsite-frontend: APP v03.13.00 → APP v03.13.01

## 2026-04-16 — Turnstile migrado para Secrets Store (worker v02.10.02)
### Escopo
Migração do `TURNSTILE_SECRET_KEY` do `mainsite-worker` para o `default_secrets_store`, após confirmação explícita de que esse segredo curto pode usar o produto sem violar o limite de tamanho.
### Feito
- **Secrets Store**: criado o secret remoto `turnstile-secret-key` no store `df90c0935ba1460899c3c2c457548a90`.
- **`mainsite-worker/wrangler.json`**: `TURNSTILE_SECRET_KEY` voltou para `secrets_store_secrets`.
### Diretiva operacional consolidada
- **`TURNSTILE_SECRET_KEY` pode e deve usar Secrets Store** quando o secret remoto estiver criado.
- **`GCP_NL_API_KEY` continua proibido em Secrets Store**: é um JSON de Service Account do Google Cloud e excede o limite de `1024` caracteres.
### Versão
- mainsite-worker: APP v02.10.01 → APP v02.10.02

## 2026-04-16 — Deploy hotfix do mainsite-worker (worker v02.10.01)
### Escopo
Correção da falha do GitHub Actions `Deploy` do `mainsite-app`, diagnosticada via log do workflow e erro retornado pela API da Cloudflare durante o `wrangler deploy`.
### Diretiva operacional consolidada
- **`GCP_NL_API_KEY` nunca em Secrets Store**: essa credencial é um JSON de Service Account do Google Cloud, grande demais para o limite de `1024` caracteres do Secrets Store. No `mainsite-worker`, ela deve permanecer como variável de ambiente/secret nativo do Worker.
### Causa raiz
- **`wrangler.json` desalinhado do runtime**: `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` tinham voltado ao bloco `secrets_store_secrets`, mas o worker publicado mantinha esses dois valores como secrets nativos do próprio Worker.
- **Erro observado**: o run `24535611860` falhou no step `Install e Deploy Worker` com `code: 10182`, informando que `turnstile-secret-key` não existia no Secrets Store referenciado.
### Corrigido
- **`mainsite-worker/wrangler.json`**: removidos os bindings `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` do `secrets_store_secrets`.
- **Binding `AI`**: mantido explicitamente no `wrangler.json`.
### Versão
- mainsite-worker: APP v02.10.00 → APP v02.10.01

## 2026-04-16 — Security hardening pack (frontend v03.13.00, worker v02.10.00)
### Escopo
Fechamento do pacote de segurança derivado da auditoria profunda em `mainsite-frontend` e `mainsite-worker`, incluindo XSS em JSON-LD, antiabuso fail-closed, relay de e-mail, moderação e carga excessiva do corpus público.
### Alterado — mainsite-frontend (v03.13.00)
- **`functions/_lib/structured-data.ts`** e **`src/lib/structuredData.ts`**: helpers novos para serializar JSON-LD com escaping de `<`, `>`, `&`, `U+2028` e `U+2029`.
- **`functions/[[path]].ts`** e **`PostReader.tsx`**: schema Article/BreadcrumbList agora usa `serializeJsonLd(...)`; meta attributes sensíveis também passaram a escapar conteúdo.
- **`App.tsx`**: removido o bloqueio global de cópia/print/devtools. Entrou um handler de `copy` que adiciona atribuição automática com título e URL canônica do texto. Abertura de posts agora busca o detalhe sob demanda (`/api/posts/:id`) em vez de depender do corpus completo carregado na home.
- **`ShareOverlay.tsx`, `ContactModal.tsx`, `CommentModal.tsx`, `CommentsSection.tsx`**: toda a camada pública sensível passou a falhar fechada sem `VITE_TURNSTILE_SITE_KEY`. Comentários agora respeitam `maxNestingDepth` retornado pelo backend.
- **`_headers`**: permanece intocado por diretiva explícita.
### Alterado — mainsite-worker (v02.10.00)
- **`lib/sanitize.ts`**: regex sanitizer removido; `sanitize-html` com allowlist e restrições de estilos/iframes passou a ser a fronteira server-side para HTML persistido.
- **`routes/posts.ts`**: `/api/posts` entrega excerpt público e preserva o endpoint detalhado para leitura completa.
- **`routes/contact.ts`**: `contact`, `comment` e `share/email` exigem Turnstile obrigatoriamente; `share/email` valida link canônico, existência do post e limite diário por destinatário.
- **`routes/comments.ts`**: nova resolução recursiva de profundidade, falha fechada sem GCP moderation key e serialização correta da árvore de comentários.
- **`routes/ai.ts`**: removido o mecanismo de e-mail disparado por tag oculta da LLM; chat público reduz o corpus e orienta contato humano via formulário.
- **`wrangler.json`**: bindings `AI`, `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` declarados explicitamente.
### Configuração de produção validada via API
- `mainsite-motor`: `TURNSTILE_SECRET_KEY`, `GCP_NL_API_KEY` e binding `AI` presentes.
- `mainsite-frontend` produção: `VITE_TURNSTILE_SITE_KEY` presente (`secret_text`).
### Versão
- mainsite-frontend: APP v03.12.00 → APP v03.13.00
- mainsite-worker: APP v02.09.02 → APP v02.10.00

## 2026-04-12 — Pacote SEO/GEO completo (frontend v03.10.00, worker v02.09.00)
### Escopo
Implementação completa dos itens 1-9 do plano SEO/GEO + bônus de baixo custo. Reforço da indexabilidade por bots de IA (ChatGPT, Claude, Perplexity) e buscadores tradicionais sem migrar a stack para SSR.

### Descobertas durante a auditoria
- **`functions/[[path]].ts` já implementa pre-rendering edge via HTMLRewriter** (item #7 já estava feito) — injeta og:*, twitter:*, JSON-LD Article + BreadcrumbList no edge para todos os bots, mesmo sem JS. O audit estático inicial não viu isso porque é runtime-only.
- **Schema dos posts**: `id, title, content, author, is_pinned, display_order, created_at, updated_at`. **Sem campo de category/tag** — item #9 ficou restrito a páginas de autor (não tags/categorias).

### Adicionado — mainsite-frontend (v03.10.00)
- **`public/llms.txt`** (formato llmstxt.org): manifesto para LLMs com bio do autor, recursos, política de uso por IA generativa.
- **`public/manifest.webmanifest`**: PWA manifest dark-mode aware, ícone SVG.
- **`public/c8f3a7d6b2e9415d8f3c7a6b9e2d4f8c.txt`**: arquivo de validação IndexNow.
- **`functions/feed.xml.ts`**: Feed RSS 2.0 dinâmico (30 posts mais recentes, dc:creator, atom:link self).
- **`functions/autor/[slug].ts`**: Página de autor server-rendered no edge — JSON-LD CollectionPage + BreadcrumbList, dark-mode aware, standalone (sem dependência da SPA). Slug derivado por normalização do nome (`Leonardo Cardozo Vargas` → `leonardo-cardozo-vargas`).
- **`index.html`**: theme-color (light/dark), apple-touch-icon, manifest, application-name, alternate RSS link, hreflang pt-BR + x-default.
- **`functions/[[path]].ts`**: og:image **dinâmico** extraído da primeira `<img src>` do conteúdo do post (regex), aplicado a og:image, twitter:image e ao campo `image` do JSON-LD Article. Bypass explícito para `/feed.xml`.
- **`functions/sitemap.xml.ts`**: inclui /feed.xml, páginas de autor (uma por autor único do banco), `xhtml:link rel="alternate" hreflang`.

### Alterado — mainsite-frontend
- **`public/robots.txt`**: Sitemap directive corrigida para `www.reflexosdaalma.blog` (antes apontava para `www.lcv.rio.br`).

### Adicionado — mainsite-worker (v02.09.00)
- **`lib/indexnow.ts`**: Cliente IndexNow. Notifica Bing/Yandex/Seznam/Naver/Yep quando posts são criados/editados.
- **`routes/posts.ts`**: Hooks fire-and-forget (`waitUntil(pingIndexNow(...))`) no POST e PUT.

### Decisões e restrições
- **`_headers` NÃO foi tocado** (restrição SumUp/MP — feedback memorizado).
- **Item #7 não foi reimplementado** — já existia em `functions/[[path]].ts` desde antes desta sessão.
- **Item #9 limitado a páginas de autor** — schema não tem tags/categorias; adicionar exigiria migração D1.
- **Para PWA install em Android antigo**, gerar PNGs físicos (apple-touch-icon-180.png, icon-192.png, icon-512.png) e adicionar ao manifest. Atualmente o manifest aceita SVG (suportado em iOS 16+ e Android moderno).
- **Migração para Next.js / SSR completo** documentada em plano separado, NÃO executada — opção #7 (pre-rendering edge) já entrega 80% do benefício.

### Versão
- mainsite-frontend: APP v03.09.00 → APP v03.10.00
- mainsite-worker: APP v02.08.00 → APP v02.09.00

## 2026-04-09 — Tier 4 Tech Upgrades (frontend v03.08.00, worker v02.06.00)
### Escopo
TanStack Query no frontend público, Biome linter+organizeImports no worker, Hono logger+timing, Zod env validation, Vitest UI, tsconfig strictness.
### Adicionado
- **mainsite-frontend**: TanStack Query v5 (`QueryClientProvider` + `ReactQueryDevtools` em `main.tsx`). `@vitest/ui` + `test:ui`. Biome `organizeImports`. tsconfig: `types: ["vite/client"]`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports`.
- **mainsite-worker**: `EnvSecretsSchema` em `schemas.ts`; middleware de validação pós-secrets em `index.ts`. `hono/logger` + `hono/timing`. Biome linter enabled + `organizeImports`. `@vitest/ui` + `test:ui`.
### Versão
- mainsite-frontend: APP v03.07.00 → APP v03.08.00
- mainsite-worker: v02.05.00 → v02.06.00

## 2026-04-09 — Tier 1-3 Tech Upgrades (frontend v03.07.00, worker v02.05.00)
### Escopo
Biome linter, Husky, AppType export no worker, testes de rota Hono, wrangler types script.
### Adicionado
- **mainsite-frontend**: Biome linter habilitado (`recommended` + overrides). Husky + lint-staged pre-commit.
- **mainsite-worker**: `export type AppType = typeof app` em `src/index.ts`. Script `"types": "wrangler types"`. Testes de rota: `ratings.test.ts` (GET 400 para postId inválido), `comments.test.ts` (GET config fallback defaults). `vitest.config.ts` criado. `tsconfig.json` exclui `**/*.test.ts`.
### Versão
- mainsite-frontend: APP v03.06.06 → APP v03.07.00
- mainsite-worker: v02.04.02 → v02.05.00

## 2026-04-08 — Tech Upgrade: ESLint 10 + marked@18 + Hook Fixes
### Escopo
Migração ESLint 9→10, upgrade marked 15→18, e correção de tipos em hooks de acessibilidade.
### Feito
- **ESLint 10.2.0**: Upgrade sem breaking changes (flat config compatível).
- **marked@18**: Atualização da biblioteca de parsing Markdown.
- **`useTextZoomVoice.ts`**: Interface local `SpeechRecognitionLike` criada para substituir globais DOM ausentes no TS target atual.
- **`TextZoomControl.tsx`**: Prop `onVoiceToggle` não-utilizada removida.
### Versão
- mainsite-frontend: APP v03.06.06 → APP v03.06.07

## 2026-04-08 — GitHub Actions Purge & Dependabot Standardization
### Escopo
Auditoria completa de CI/CD para eliminação de "ghost runs" em toda a rede de repositórios do workspace, juntamente com a universalização da configuração do Dependabot ajustada às necessidades de empacotamento locais para mitigar tráfego e limites no API.

## 2026-04-08 — Security Hotfix: Hono Path Traversal & Proxy Bypass (Dependabot)
### Escopo
Auditoria e resolução guiada de pacotes vulneráveis acionados a partir de alertas de segurança do Dependabot da nuvem (GitHub).
### Resolvido
- **NPM Audit Fix**: Atualizadas e forçadas as versões estáveis para `hono` (v4.12.12) e `@hono/node-server` (v1.19.13). Mitigadas as 2 vulnerabilidades 'Moderate' catalogadas sob bypass de cookies, directory traversal e proxy request bypass referenciados no app `mainsite-app`.

## 2026-04-07 — Mainsite v03.06.06 — Brand Icons Fix + Route Order Hardening
### Scope
Correção de regressão crítica dos ícones de bandeiras de pagamento no formulário de doação SumUp.
### Causa Raiz
`VITE_BRAND_ICONS_BASE_URL` no `deploy.yml` do GitHub Actions apontava para o domínio externo defunto `https://mainsite-app.lcv.rio.br/api/uploads/brands`, causando `ERR_NAME_NOT_RESOLVED` em todas as `<img>` de brand icons. Violava a diretiva Cloudflare Internal Integration.
### Corrigido
- **deploy.yml**: URL absoluta substituída por path relativo `/api/uploads/brands` — resolvido via Service Binding interno.
- **[[path]].ts (Pages Functions)**: Bypass de `/api/*` movido para ANTES da checagem de extensão estática, prevenindo interceptação incorreta de URLs como `/api/uploads/brands/*.svg`.
### Adicionado
- **brands/sumup.svg (R2)**: Logo oficial da SumUp convertido de PNG para SVG com dados raster embarcados via base64, uploadado ao bucket `mainsite-media`.
### Lição Operacional
- **Never use external URLs for intra-Cloudflare communication**: URLs absolutas para domínios que podem ser renomeados ou removidos sempre quebrarão. Preferir paths relativos com Service Binding.
- **Route order matters in catch-all middleware**: Checagens de API devem preceder checagens de extensão de arquivo para evitar colisões com assets servidos por workers.

## 2026-04-07 — Mainsite v03.06.05 + Worker v02.04.01 — Dynamic Config & Cache Removal
### Scope
Ajustes de UX no formulário de comentários com placeholders dinâmicos baseados em configuração do admin, remoção do cache de 60s do motor de moderação e correção de roteamento.
### Corrigido
- **Rota `/api/comments/config`**: Movida antes de `/:postId` no Hono para evitar captura parametrizada incorreta que retornava "Post ID inválido".
- **Cache 60s Removido**: Settings de moderação agora são lidos diretamente do D1 a cada request — propagação instantânea de alterações do admin.
### Adicionado
- **Placeholders Dinâmicos (CommentsSection)**: Fetch de `/api/comments/config` no mount → campos Nome e E-mail exibem "(obrigatório)" ou "(opcional)" conforme `allowAnonymous` / `requireEmail`.
- **Autocomplete Browser**: Atributos `id="name"`, `name="name"`, `autoComplete="name"` no campo Nome e equivalentes no E-mail.
### Alterado
- **Turnstile Widget**: `compact` (150×140) → `normal` (300×65) para formato retangular largo e fino.
- **ModerationPanel (admin-app v01.81.01)**: Toggle "Permitir anônimos" renomeado para "Exigir nome" com lógica invertida (`!allowAnonymous`), paritário com "Exigir email". Mensagem de cache removida.
### Controle de versão
- `mainsite-frontend`: APP v03.06.04 → APP v03.06.05
- `mainsite-worker`: v02.04.00 → v02.04.01
- `admin-app`: APP v01.81.00 → APP v01.81.01
### Diretiva
- **Deploy somente via GitHub Actions** (git push → CI/CD). Nunca via `wrangler deploy` direto.

## 2026-04-07 — Mainsite Worker v02.04.00 — Moderation Engine Full Configurability
### Scope
Expansão do motor de moderação de comentários com 18 parâmetros configuráveis, rotas admin GET/PUT settings, e enforcement backend completo.
### Adicionado
- **ModerationSettings Interface**: Expandida com `rateLimitPerIpPerHour`, `blocklistWords`, `linkPolicy`, `duplicateWindowHours`, `autoCloseAfterDays`, `notifyOnNewComment`, `notifyEmail`, `requireEmail`, `minCommentLength`, `maxCommentLength`, `requireApproval`.
- **Settings Routes**: `GET/PUT /api/comments/admin/settings` com merge forward-compatible e cache 60s com invalidação no PUT.
- **Enforcement**: POST handler agora verifica rate limiting (contagem D1 por IP/hora), blocklist (match case-insensitive), link policy (regex URL detect → pending/block), auto-close (delta dias), comprimento min/max, email obrigatório, detecção de duplicatas.
- **notifyAdminNewComment**: 3º parâmetro `toEmail` dinâmico extraído das settings.
### Controle de versão
- `mainsite-worker`: v02.03.00 → v02.04.00

## 2026-04-07 — Autoupdate: Fix Navegação Presa em Link Curto
### Scope
Correção do `refreshPosts` que fazia `pushState('/p/{id}')` após aceitar autoupdate, prendendo o leitor em link curto com `isDeepLinkedPost = true`.
### Corrigido
- **pushState → '/'**: Alterado de `/p/${target.id}` para `/` (raiz). Agora o leitor vai para a home (headline atualizado como primeiro post), idêntico ao botão Home Page. `isDeepLinkedPost` permanece `false`.
- **newHeadlineId não mais consumido**: O `refreshPosts` não depende mais de `contentSync.newHeadlineId` — sempre carrega o primeiro post (headline) da lista atualizada. O campo permanece no hook para uso futuro.
### Controle de versão
- `mainsite-frontend`: APP v03.06.02 → APP v03.06.03

## 2026-04-07 — Anti-Screenshot: Window Blur Defense
### Scope
Mitigação contra Ferramenta de Captura do Windows (Win+Shift+S), Game Bar e aplicativos de screenshot via `window.blur`/`focus` defense.
### Adicionado
- **Window Blur → CSS Blur**: Quando o browser perde foco (`window.blur`), `filter: blur(32px)` é aplicado instantaneamente ao `body`. Capturas de tela registram conteúdo borrado. Blur removido com transição suave (300ms) no `window.focus`.
- **Win+Shift+S interception**: Combinação de teclas (`e.metaKey && e.shiftKey && key === 's'`) interceptada com `preventDefault()` e notificação.
- **Limitação documentada**: Nenhuma solução web é 100% eficaz contra capturas no nível do SO — o framebuffer é capturado antes do JS reagir. O blur no `blur` event é a mitigação mais eficaz dentro das capacidades do browser.
### Controle de versão
- `mainsite-frontend`: APP v03.06.01 → APP v03.06.02

## 2026-04-07 — PostReader Heading Scaling Fix + Global Content Protection Overhaul
### Scope
Correção de escala de títulos no PostReader (H2-H6 maiores que H1) e refatoração total das proteções anti-cópia de escopo local (PostReader) para escopo global (App.tsx/document-level).
### Corrigido
- **Heading Scaling**: Removidos `font-size` hardcoded de H2-H6 no PostReader CSS. Agora usam `font-size: revert` — reseta para defaults do User-Agent (hierarquia nativa H1 > H2 > H3...). Inline styles do PostEditor/TipTap `FontSize` extension têm prioridade. `.h1-title` (banner) continua vinculado ao `titleFontSize` do admin Configurações.
### Alterado
- **Content Protection — Escopo Global**: Handlers locais do PostReader (`onCopy`, `onContextMenu`, `onDragStart`, `onCut` e CSS `.protected-content`) substituídos por 7 document-level event listeners em `App.tsx` com `{ capture: true }`:
  - **Keyboard**: Ctrl+C/X/A/S/U/P, F12, Ctrl+Shift+I/C/J, PrintScreen (+ clipboard wipe)
  - **DOM Events**: `contextmenu`, `copy`, `cut`, `dragstart`, `selectionchange` (auto-clear), `visibilitychange` (clipboard wipe on tab switch)
  - **CSS Injetado Global**: `user-select: none !important` em `body *`, `-webkit-touch-callout: none` (iOS), `user-drag: none` em img/a/svg/video/canvas. Form fields isentos.
  - **@media print**: Oculta tudo, exibe mensagem de aviso
- **Form Fields UX**: `input`, `textarea`, `select`, `[contenteditable]` mantêm `user-select: text` para preservar digitação
### Controle de versão
- `mainsite-frontend`: APP v03.06.00 → APP v03.06.01

## 2026-04-07 — Content Fingerprint System + Title Font Size Fix
### Scope
Implementação do sistema de sincronização em tempo real entre `admin-app` e `mainsite-frontend` via Content Fingerprint, e correção do controle de tamanho de fonte do título principal.
### Adicionado
- **Content Fingerprint Backend**: `lib/content-version.ts` com `bumpContentVersion()` (incremento atômico no D1) e `getContentFingerprint()` (retorna versão + headline post ID). Endpoint `GET /api/content-fingerprint` (1 query D1, Cache-Control: 5s). Hooks em todas as mutações de posts (create, update, delete, pin, reorder, cron rotation) via `waitUntil`.
- **Frontend Sync**: `useContentSync.ts` — smart polling 30s com pausa em background tab. `ContentUpdateToast.tsx` — glassmorphism centrado no viewport (diretiva: toasts interativos = viewport center), sparkle animation, progress bar 15s, light/dark mode.
- **App.tsx**: Toast renderizado em qualquer rota (homepage + deep-link). Botão "Atualizar" executa re-fetch + navega para novo headline post.
### Corrigido
- **`.h1-title` ignoring `titleFontSize`**: PostReader usava `clamp(32px, 5vw, 52px)` hardcoded. Agora usa `calc(titleFontSize * 1.6 * --text-zoom-scale)`.
### Diretiva de UX Registrada
- Toasts/notificações **com input do usuário** → centrados no viewport.
- Toasts **informativos** → canto superior direito do viewport.
### Controle de versão
- `mainsite-frontend`: APP v03.05.01 → APP v03.06.00
- `mainsite-worker`: v02.02.03 → v02.03.00

## 2026-04-06 — Pages Functions Migration + CF_AI_GATEWAY Expurgo Final
### Scope
Migração das 2 Pages Functions R2 restantes para o worker, remoção do sitemap duplicado, e limpeza final de toda referência residual ao Cloudflare AI Gateway.
### Resolvido
- **Pages Functions R2 migradas**: `functions/api/media/[filename].js` e `functions/api/mainsite/media/[filename].js` removidas — rotas agora servidas nativamente pelo worker (`uploads.ts`) usando o binding `BUCKET` que acessa o mesmo bucket R2 `mainsite-media`.
- **Binding R2 `MEDIA_BUCKET` removido**: `wrangler.json` do frontend não precisa mais do binding R2.
- **Sitemap duplicado removido**: rota `GET /api/sitemap.xml` removida de `misc.ts` — sitemap canônico é servido pela Pages Function `sitemap.xml.ts`.
- **CF_AI_GATEWAY expurgado**: substituídas 6 referências residuais em `posts.ts`, `post-summaries.ts` e `index.ts` por `GEMINI_API_KEY`. Removida da lista `SECRET_KEYS`.
- **Arquivos obsoletos deletados**: `test-genai.ts` e `log.txt`.
### Controle de versão
- `mainsite-frontend`: APP v03.05.00 → APP v03.05.01
- `mainsite-worker`: v02.02.00 → v02.02.01

## 2026-04-06 — Migração de Domínio Principal (lcv.rio.br → reflexosdaalma.blog)
### Scope
Migração do domínio principal do mainsite de `lcv.rio.br` para `reflexosdaalma.blog`. Substituição global de e-mail `lcv@lcv.rio.br` → `cal@reflexosdaalma.blog`.
### Resolvido
- **Frontend**: `index.html` (OG/Twitter/Schema.org), `App.tsx` (SITE_URL), `PostReader.tsx` (Schema.org Article), `[[path]].ts` (redirect + Schema.org), `sitemap.xml.ts` (siteUrl).
- **Worker**: `index.ts` (CORS expandido para 9 domínios), `uploads.ts` (CORS `*`), `ai.ts` (e-mail), `contact.ts` (e-mail), `wrangler.json` (custom domain route removida).
- **Webhook MP**: bloco de e-mail removido de `payments-mp.ts` (webhook "fantasma" mantido funcional por compliance).
- **Lint fixes**: `HTMLRewriter` declarado como global, `sitemap.xml.ts` tipagem D1 corrigida.
### Controle de versão
- `mainsite-frontend`: APP v03.04.04 → APP v03.05.00
- `mainsite-worker`: v02.01.08 → v02.02.00

### Scope
Extensão preventiva na biblioteca genai.ts do mainsite-worker frente às novas regras de Thinking Models.
### Resolved
- **Tokens Maximizados**: Os endopints shareSummary, 	ranslate, summarize e 	ransform não encaram mais tetos rígidos abaixo da linha base suportada. Elevados para 8192 na matriz de configuração.

### Controle de versão
- mainsite-frontend: APP v03.04.03 -> APP v03.04.04


## 2026-04-04 — Gemini Direct API Migration & Gateway Elimination
### Scope
Remoção integral do Cloudflare AI Gateway e do fallback estrito para Cloudflare Workers AI nas operações de geração e processamento de textos do MainSite e backends de edição, prevenindo erros `524 Timeout` em operações pesadas no proxy do Cloudflare.
### Resolved
- **Expurgo Ambiental**: Excluídos do worker (genai.ts e ai.ts), e do secret store os tokens `CF_AI_GATEWAY` e `CF_AI_TOKEN`.
- **Intercepções Rompidas**: Bypasses como `httpOptions` (no genai.ts) ou chamadas de workers isoladas foram extintas. Todo processamento de interface, IA, tradução e sumarização obedece o único source-of-truth oficial do gateway: o `@google/genai` (SDK Oficial da Gemini).
- **Avanço SDK GenAI (mainsite-worker)**: Adaptamos as assinaturas da biblioteca para lidar de frente e contarmos unicamente com o `generativelanguage.googleapis.com`.

## 2026-04-04 — MP BigInt Serialization & SDK Rejection Status Fallback
### Corrigido e Adicionado
- **BigInt Serialization & SDK Error Destructuring (`mainsite-worker`)**: Corrigida a propensão de quebras de serialização (`TypeError: Do not know how to serialize a BigInt`) no processo `JSON.stringify` do endpoint `/api/mp-payment` que higieniza referências. Além disso, reestruturado o manipulador `catch` para destruturar apropriadamente exceções geradas pelo reject da API SDK Oficial V2 do Mercado Pago (que performa `throw await response.json()` quando `!ok`). Falsos positivos 500 na UI (durante rejeições legítimas 400 por regras antifraude) agora retornam corretamente o erro descritivo e o status original (`finalStatus = mpErr.status`).
### Controle de versão
- `mainsite-worker`: patch

## 2026-04-04 — Translation Truncation Fix & Workers AI Integration
### Corrigido e Alterado
- **Migração Efetivada no Frontend**: Corrigida a regressão no `PostReader.tsx` que continuava apontando para a rota pública do Gemini (`/api/ai/public/...`). As chamadas de tradução e resumo agora apontam de fato para as rotas nativas da infraestrutura da Cloudflare (`/api/ai/workers/translate` e `summarize`).
- **Resolução de Truncamento Llama-3**: A engine `env.AI.run` nas rotas do `mainsite-worker` foi parametrizada com limites robustos de resposta (`max_tokens: 4000` para tradução e `500` para resumo). Isso impede o truncamento agressivo provocado pelo limite default extremamente restritivo da plataforma Cloudflare (256 tokens) em geração de textos mais compridos.
### Controle de versão
- `mainsite-worker`: v02.01.06 → v02.01.07
- `mainsite-frontend`: APP v03.04.01 → APP v03.04.02

## 2026-04-04 — Mercado Pago SDK 500 Error Fix & TS Audit
### Corrigido
- **Mercado Pago API Circular JSON**: O endpoint da API `/api/mp-payment` e funções correlatas sofriam falhas e estouros 500 nas respostas devido à dependência do SDK node-fetch/undici contido no `@mercadopago/sdk` (v2), o qual injeta a propriedade cíclica `api_response` gerando exceções catastróficas durante o `c.json(data)` do Hono. Adicionada extração higienizada segura que descarta ponteiros circulares (`request`, `response`, `api_response`), garantindo o envio correto do JSON (HTTP 201) para a camada frontend sem quebrar logo após a transação aprovada na operadora.
- **TypeScript Summary Fallback Model**: O key `"summaryModeloIA"` continha um *drift* para apenas `"summary"` em conformidade com a interface `MainsiteConfig`. A correção assegurou 100% de compliance `npx tsc --noEmit` em `genai.ts`.
### Controle de versão
- `mainsite-worker`: v02.01.04 → v02.01.05

## 2026-04-03 — Cloudflare Paid Scale Integration
### Escopo
Migração arquitetural unificada para aproveitamento da infraestrutura Cloudflare Paid. Implementação de **Smart Placement** transversal para redução de latência via proximidade física com o banco de dados (BIGDATA_DB). Adoção da diretiva `usage_model: unbound` para mitigar o `Error 1102` (CPU limit excess). Embutimento global do proxy **Cloudflare AI Gateway** sobrepondo o SDK nativo (`@google/genai`) e habilitando Caching, Rate limiting Nativo e Observabilidade Unificada, mantendo operação híbrida com os LLMs da rede.

### Diretivas Respeitadas
- Conformidade 100% com `wrangler.json`.
- `tlsrpt-motor` e `cron-taxa-ipca` revalidados em infraestrutura moderna sem timeout.

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




> **DIRETIVA DE SEGURANÇA:** Ao sugerir código ou responder perguntas, leia rigorosamente o contexto e as memórias históricas acima para não divergir das decisões já tomadas pelo outro agente.
