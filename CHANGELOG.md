# Changelog — MainSite App

## [Unreleased]

### Alterado

- Corrigido o guia de fork para usar o empacotamento nativo de `wrangler deploy` no Worker,
  removendo a chamada a um script `build` que esse pacote não possui. O build do frontend
  permanece; nenhuma configuração ou implementação foi alterada (GIT-202/GIT-203).

- O frontend passa a publicar os textos de licença das dependências incorporadas usando
  `build.license` nativo do Vite, em `/legal/DEPENDENCY-LICENSES.md`, com referência nos
  bundles e link na página de licenças. O Workbox, gerado separadamente, recebe uma cópia
  integral e inalterada de sua licença MIT em `/legal/WORKBOX-LICENSE.txt`. Sem novo
  verificador, gerador próprio, dependência ou mudança de configuração do GitHub.

- **`npm audit` do `Deploy` distingue vulnerabilidade de requisição de advisories falha.** O
  passo de auditoria de cada pacote continua reprovando o deploy quando o relatório traz
  vulnerabilidade alta ou crítica; quando a requisição de advisories ao registro do npm falha
  (mensagem do próprio npm, "audit endpoint returned an error": serviço fora, inalcançável ou
  respondendo qualquer coisa que não um relatório), registra um aviso e um resumo no job e o
  deploy segue sobre a cobertura nativa (alertas e atualizações de segurança do Dependabot,
  Dependency Review, CodeQL); qualquer erro do npm fora dessa requisição reprova. A espera por
  uma requisição travada cai de cerca de quinze minutos para cerca de dois (`fetch-retries` 1,
  `fetch-timeout` 60 s). Motivo: em 03/09 o serviço ficou horas sem responder e nenhum deploy
  saía, hotfix incluído (MAISITE-20 / #531).

## [v03.25.00 / v02.22.00] - 2026-09-03

Release só do frontend; o worker permanece em v02.22.00, em produção desde o `Deploy` de
27/08. As entradas abaixo consolidam tudo o que ficou em Unreleased desde 21/08, inclusive as
do worker v02.22.00, e descrevem o estado final desta release.

### Alterado

- **Governança nativa da organização.** O repositório passa a usar somente recursos
  nativos do GitHub e integrações oficiais: saem o lockfile de Actions e seus
  cabeçalhos, o workflow avançado do CodeQL (o default setup do CodeQL, aplicado pela
  configuração de segurança da Enterprise, já analisa `actions` e
  `javascript-typescript`), o workflow `Public Format` e os gatilhos de merge queue.
  Entra o workflow `CI`, que roda em todo pull request para `main` os portões de
  produto do `Deploy` (lint, Biome e testes do worker; lint, Biome, testes e build do
  frontend) mais um dry-run estrito do Wrangler no worker; o `npm audit` dos dois
  pacotes sai do caminho de pull request e fica só no `Deploy`, que o mantém junto com
  os dois deploys do Wrangler, agora com `wranglerVersion` 4.125.0, a mesma versão dos
  manifestos (esse input do workflow é atualizado à mão); a release no Linear passa a
  ser registrada só para deploys por `push`, como no starter da organização. Entram também o `dependabot-auto-merge.yml`
  canônico da organização e o `INBOUND.md`. Zizmor (v0.6.3), Scorecard, Pages (gatilho
  de pull request, deploy-pages v5.0.1) e Dependency Review seguem os starters da
  organização.
- **Dependabot semanal e agrupado.** Verificação às segundas, 06:00 America/Sao_Paulo,
  com um grupo `minor-e-patch` por ecossistema, majors em pull requests próprios,
  cooldown de sete dias (sem cooldown para `actions/*` e `github/*` nas Actions),
  `rebase-strategy: auto` e o bloqueio do TypeScript 6.1 preservado nos dois pacotes;
  os dez grupos próprios e a entrada do pacote raiz saem.
- **Inventário legal por nome, licença e fonte.** `THIRDPARTY.md` e a cópia servida em
  `mainsite-frontend/public/legal/` listam cada dependência direta do frontend e do
  worker sem versão, integridade ou tarball: versões e resoluções imutáveis vivem nos
  manifestos e nos lockfiles, onde o Dependabot as atualiza, e o grafo de dependências
  do GitHub é o inventário versionado.
- **`browserslist` 4.28.8 e `fast-uri` 4.1.4 no frontend.** O `browserslist` sobe no
  lockfile (GHSA-c83g-rgw3-j3cx e GHSA-73wf-gq98-2v4g, altas, publicadas em 01/09 depois
  do último deploy e sem alerta do Dependabot); o `override` do `fast-uri` passa de 4.1.2
  a 4.1.4 (GHSA-jqff-g426-hqxp, GHSA-fph4-wmhf-6fwf, GHSA-f65p-4m7j-42xc e
  GHSA-5jgf-p345-68v8, altas, publicadas em 02/09; alertas #53–#56 do Dependabot). Sem os
  dois bumps o `npm audit` do `Deploy` falharia no próximo push a `main`.
- A política local passa a reconhecer como regra que metadados e identificadores exigidos
  por configurações oficiais podem e devem ser versionados quando necessários ao
  funcionamento reproduzível. Para o Cloudflare Secrets Store, isso inclui `store_id` e
  `secret_name` no `wrangler.json`; valores secretos, tokens e credenciais continuam fora
  do Git (MAISITE-16 / #498).
- `GCP_NL_API_KEY` deixa de ser secret nativo e passa a vir do Secrets Store
  (`gcp-nl-api-key`), como `VERTEX_SA_KEY`. A restrição de 1024 caracteres que
  motivara o formato nativo está vencida: o limite atual é 64 KiB por secret.
  O resolvedor de `index.ts` já aceitava os dois formatos, então nenhuma lógica
  de moderação mudou.
- A Service Account da moderação passa a ser uma conta dedicada do projeto
  institucional, com o papel mínimo `roles/serviceusage.serviceUsageConsumer`
  que a documentação da Natural Language API exige. A anterior pertencia a um
  projeto de conta pessoal. O endereço da conta não é versionado (AGENTS.md,
  "Identificadores e credenciais em repositorio publico").
- O writer pós-deploy da #461/MAISITE-9 troca o instalador customizado pela
  `linear/linear-release-action` oficial, fixada pelo SHA assinado (v0.16.0 durante o
  ciclo, v0.17.2 nesta release), preservando o SHA implantado que origina a release. A
  fila usa `queue: max`, e falhas da action tornam o workflow vermelho. O CLI é
  selecionado explicitamente (v0.17.2), e o instalador upstream passa a conferir o
  SHA-256 publicado do CLI antes de executá-lo (`linear/linear-release-action#59`,
  fechada em 26/08).
- Os PRs Dependabot #431 e #432 foram consolidados: o Zizmor passa a usar diretamente
  a Action oficial (v0.6.3 nesta release, sem pin próprio do CLI) e o `upload-sarif`
  do Scorecard usa `codeql-action` v4.37.9; o workflow avançado do CodeQL sai (acima).
- Dependency Review, OpenSSF Scorecard, Zizmor, GitHub Pages e os dois deploys
  Cloudflare agora usam somente Actions oficiais fixadas por SHA e permissões
  mínimas (o CodeQL roda no default setup, sem workflow); wrappers, gates e
  validadores de governança próprios foram aposentados.
- O binding D1 compartilhado passa a usar a configuração Wrangler oficial
  versionada; o segredo de CI `D1_DATABASE_ID` e a injeção `jq` deixam de ser
  necessários.
- O cooldown npm do Dependabot passa a sete dias, sem atrasar security updates
  nem GitHub Actions.
- Wrangler sobe para 4.125.0 (4.123.0 durante o ciclo) e passa a estar fixado nos
  manifests/lockfiles dos dois sub-apps e no `wranglerVersion` do `Deploy`, evitando
  instalação transitória fora do lockfile no deploy.
- `@biomejs/biome` sobe para 2.5.8 e `@cloudflare/workers-types` para
  5.20260813.1 nos dois sub-apps (PRs Dependabot #440 e #442); `globals` sobe
  para 17.11.0 também em ambos (#447 e #448). Todos são dependências de
  desenvolvimento, sem efeito no runtime publicado — por isso as versões
  internas dos sub-apps permanecem inalteradas.
- `@cloudflare/workers-types` passa de caret (`^`) para versão exata nos dois
  sub-apps, aplicando o achado de review do PR #421 (lido na auditoria
  integral de 20/08): pacote de tipos com versionamento datado sob caret gera
  instalação não reprodutível fora do lockfile — o mesmo fundamento já adotado
  para o pin do Wrangler.

### Corrigido

- As duas cópias de `THIRDPARTY.md` passam a inventariar, sem omissões nem
  entradas obsoletas, todas as dependências diretas dos manifestos (issue #496 /
  MAISITE-15); com a saída do pacote raiz restam os dois dos sub-apps. O gate local
  fail-closed que confrontava o inventário com os lockfiles, introduzido nesse ciclo,
  sai nesta mesma release (ver Removido).
- Os 12 erros de typecheck acumulados desde a implantação do Vertex: quatro
  destructurings de JWT e leituras de bytes sem verificação de existência
  (`auth.ts`, `uploads.ts`), cinco campos opcionais recebendo `undefined`
  explícito sob `exactOptionalPropertyTypes` (`auth.ts`, `comments.ts`), dois
  acessos indexados sem guarda (`index.ts`, `uploads.ts`) e um caminho de
  retorno implícito em `requireAuth`. `tsc --noEmit` sai limpo.

### Removido

- **Verificador legal próprio e pacote raiz.** Saem `scripts/verify-thirdparty.mjs`, seu
  teste, `scripts/official-actions-contract.test.mjs` (nunca executado em CI), o
  `package.json` e o `package-lock.json` da raiz, que existiam só para o Prettier do
  `index.html`, para o verificador e para esse teste de contrato, os arquivos
  `.prettierignore`, `.npmignore` e `.npmrc` da raiz, que ficariam sem consumidor, e os
  dois passos do `Deploy` que instalavam e chamavam o pacote raiz.
  Vulnerabilidades conhecidas passam a ser cobertas pelo Dependency Review, pelo
  `npm audit` do `Deploy` e pelas atualizações de segurança do Dependabot; licenças,
  pela regra Enterprise de conformidade de licenças; o CodeQL cobre o código.
- Native Auto-merge, Auto-release e a automação customizada de Projects. Os
  Projects #12 e #17 usam Auto-add nativo, e este web app mantém somente suas
  versões internas sem GitHub Releases ou tags de versão.

### Adicionado

- Governança de trabalho sobre GitHub Projects, Issues e Discussions: quadro dedicado
  do repositório, formulários de issue para Incident, Maintenance e Spike, atalhos para
  Discussions no seletor de issues, Auto-add nativo nos Projects #12 e #17 e o ritual
  de registro G1..G4 versionado em `AGENTS.md` e `CLAUDE.md` para Claude Code e
  ChatGPT-Codex.

## [v03.24.00 / v02.21.00] - 2026-08-21

Release só do frontend; o worker permanece em v02.21.00.

### mainsite-frontend v03.24.00

- **Tightening de `style` por allowlist de valor (issue #411)**: os dois call
  sites DOMPurify passam a reescrever cada `style` mantendo apenas as
  propriedades que o TipTap emite, com valor validado — inline styles do
  conteúdo publicado sobrevivem; `url()`/`expression()`/`position` caem.
  Fecha o diferimento registrado na v03.22.00.

## [v03.23.05 / v02.21.00] - 2026-08-21

Release só do worker; o frontend permanece em v03.23.05.

### mainsite-worker v02.21.00

- **Settings JSON Zod schema (issue #410)**: os quatro PUTs de settings validam o
  payload com schemas Zod antes do upsert em `mainsite_settings` — JSON inválido ou
  shape estruturalmente errado retorna 400 sem tocar o D1. O texto original continua
  sendo o que persiste (extras como `isDonationTrigger` sobrevivem; legado
  root-`enabled` de ratelimit aceito); leitores fail-safe intactos. Fecha o
  diferimento registrado na v02.18.00.

## [v03.23.05 / v02.20.01] - 2026-08-10

Release só do worker; o frontend permanece em v03.23.05.

### Removido

- **Worker:** sai o binding legado `GEMINI_API_KEY`. A v02.20.00 o manteve "até o
  descomissionamento coordenado da frota", e esse momento chegou: saem o binding
  do `wrangler.json`, as duas declarações em `env.ts` (`SecretStoreBinding` e a
  forma resolvida), a entrada em `SECRET_KEYS` do resolver e o campo opcional em
  `EnvSecretsSchema`. Nenhum handler lia a chave desde a migração.

### Corrigido

- **Worker:** `APP_VERSION` estava em `v02.19.05` enquanto o changelog do
  sub-app já registrava a v02.20.00 da migração Vertex; a constante volta a
  acompanhar a versão.

## [v03.23.05 / v02.20.00] - 2026-08-08

Release só do worker; o frontend permanece em v03.23.05.

### Alterado

- **Worker:** migra o transporte de IA do endpoint AI Studio (API key
  `GEMINI_API_KEY`) para o **Vertex AI**, autenticando com service account via
  JWT RS256 (WebCrypto) trocado por access token OAuth2 — o consumo de IA deixa
  o plano pré-pago do AI Studio e passa ao pós-pago do Cloud Billing. A
  superfície pública de `lib/genai.ts` é preservada, então os call sites
  (`routes/ai.ts`, `routes/post-summaries.ts`, `routes/posts.ts`, `lib/gemini.ts`)
  ficam inalterados. Prompts, seletor de modelo por D1, retries, safety settings
  e telemetria intactos.

### Adicionado

- **Worker:** novo `src/lib/vertex.ts` — cliente REST mínimo que espelha a
  superfície usada do SDK (`models.generateContent` / `models.countTokens`), com
  cache de access token por identidade de chave, single-flight para mints
  concorrentes, endpoints global/regional e erros diagnósticos. Binding
  `VERTEX_SA_KEY` (Secret Store, `secret_name: vertex-sa-key`).

### Removido

- **Worker:** dependência `@google/genai` e o override transitivo de
  `protobufjs`, exclusivo da cadeia dela.

### Testes

- **Worker:** novo `src/lib/vertex.test.ts` — 18 testes, incluindo assinatura JWT
  verificada criptograficamente e a regressão do `fetch` global desacoplado do
  `this` (Illegal invocation no workerd de produção). Suíte total: 41/41.

## [v03.23.05 / v02.19.05] - 2026-08-03

### Segurança

- **Worker:** atualiza Hono para `4.12.34`, corrigindo o ReDoS no parsing de
  `Access-Control-Request-Headers` descrito em GHSA-8j4g-w8fx-2239.
- **Frontend e Worker:** atualiza o override transitivo de `brace-expansion` de `5.0.8` para `5.0.9`, corrigindo o bypass do limite de expansões descrito em GHSA-rgw5-rvv9-x895.
- **Frontend:** atualiza `fast-uri` de `4.1.1` para `4.1.2`, corrigindo a confusão de autoridade por barra invertida descrita em GHSA-7p8r-x3mc-p8w7; `npm audit --audit-level=moderate` retorna zero vulnerabilidades nos dois grafos.
- **Worker:** atualiza Wrangler para `4.118.0`, PostCSS para `8.5.25` e o override exclusivo da cadeia `miniflare → undici` para `7.29.0`, corrigindo GHSA-8xcm-r25x-g524 e GHSA-4cwx-7wf7-3272 e preservando a política de acompanhar as versões mais novas da Cloudflare e do toolchain web.
- **Worker:** alinha o schema e o preset recomendado do Biome à CLI 2.5.6,
  eliminando avisos de configuração obsoleta.
- **Deploy do frontend:** deixa de injetar `VITE_BRAND_ICONS_BASE_URL`, variável sem consumidor no código atual, reduzindo configuração pública obsoleta no bundle de build.

### Qualidade

- **Frontend:** simplifica o token Turnstile depois da guarda obrigatória e
  elimina valores não usados nos exemplos de zoom, incluindo a conversão do CSS
  demonstrativo em export intencional.

### Corrigido — automação de release

- O extrator de notas agora reconhece headings combinados de frontend e worker, evitando releases com descrição genérica quando o changelog usa o formato `## [vFrontend / vWorker]`.

## [v03.23.04 / v02.19.04] - 2026-07-21

### Segurança

- **Frontend:** fixa `brace-expansion` em `5.0.7` para consumidores `minimatch` 10.x e em `2.1.2` para o consumidor legado 5.x, corrigindo expansão exponencial de grupos vazios consecutivos sem forçar um major incompatível (GHSA-3jxr-9vmj-r5cp / CVE-2026-13149).
- **Worker:** fixa `brace-expansion` em `5.0.7` e atualiza o override transitivo de `protobufjs` de `7.6.3` para `7.6.5`, corrigindo também o loop infinito em opções `.proto` malformadas na cadeia do `@google/genai` (GHSA-j3f2-48v5-ccww / CVE-2026-59877).

### Corrigido — worker / rate limit

- **`/api/ai/public/chat`** deixou de aplicar o cap global D1 redundante (`chat-public-global` / `mainsite_rate_limit`) que retornava 429 antes da chamada ao Gemini quando a tabela auxiliar inexistia ou falhava.
- **`src/lib/rate-limit.ts`** agora normaliza apenas toggles administrativos (`chatbot`, `email`, `comments`); os limites efetivos permanecem nos bindings nativos `ratelimits` do Cloudflare Worker.

## [v03.23.03 / v02.19.03] - 2026-05-15

**Patch — 4-gate quality directive compliance (eslint + biome + prettier + cross-review).** Workspace directive 2026-05-15: every code change must pass eslint + biome + prettier + cross-review before Commit & Sync / tag / release / deploy / publish.

### Adicionado

- `mainsite-frontend` + `mainsite-worker`: `npm run biome` (biome check .) + `npm run biome:write` (biome check --write .) scripts.
- `deploy.yml` workflow runs `npm run biome` after `npm run lint` (eslint) and before `npm test`/`npm run build` in BOTH sub-apps.

### Configurado

- `mainsite-frontend/biome.json` schema URL `2.4.12` → `2.4.14` (installed CLI version).
- `mainsite-worker/biome.json` schema URL `2.4.11` → `2.4.14` + `files.includes` scoped to `src/**/*.{ts,js}` (excludes `dist/`, `build/`, `.wrangler/`, `node_modules/`, `coverage/`). Sem o scope explícito, biome estava varrendo `dist/index.js` (build artifacts) e produzindo 45+ errors em código gerado.

### Alterado

- `mainsite-frontend`: 10 source files reformatted by `biome check --write .` (cosmetic only; no semantic changes).
- `mainsite-worker`: 1 source file (`src/lib/moderation.ts`) reformatted by `biome check --write .` (cosmetic only).
- APP_VERSION bumped:
  - `mainsite-frontend/src/App.tsx`: `v03.23.02` → `v03.23.03`.
  - `mainsite-worker/src/index.ts`: `v02.19.02` → `v02.19.03`.

## [v03.23.02 / v02.19.02] - 2026-05-09

### Alterado

- **`site/index.html`** — iframe `github.com/sponsors/.../card` (caixa branca cross-origin) substituído por link card dark navy com ❤ pink + meta cyan + seta animada; card movido para DEPOIS dos botões (lcv.dev/sponsor primário, GitHub Sponsors alternativa). Companion ship Phase 3 (12 repos). APP_VERSION bumpada em ambos frontend e worker por consistência multi-repo, mas o reskin afeta apenas a página GitHub Pages.

## [v03.23.01 / v02.19.01] - 2026-05-09

### Alterado

- **`site/index.html`** — `<style>` block reskinneado pra nova identidade visual dark-first navy/cyan da LCV Ideas & Software (paleta `#050b18`/`#38bdf8`/`#34d399`, gradientes radiais, glow shadows, gradient text no h1). Coordinated companion ship Phase 2 com `calculadora-app` v04.01.17, `oraculo-financeiro` v01.10.04, `astrologo-app` v02.17.23, `admin-app` v02.01.01, `maestro-app` v0.5.17, `mtasts-motor` v02.00.10. Companion à Phase 1 (cross-review-v1 1.12.9, cross-review-v2 v02.18.07, deepseek-cli 0.3.1, grok-cli 1.6.2, sponsor-motor APP v01.02.02, `.github-org/site`). APP_VERSION bumpada em ambos `mainsite-frontend/src/App.tsx` (v03.23.00 → v03.23.01) e `mainsite-worker/src/index.ts` (v02.19.00 → v02.19.01) por consistência multi-repo, embora o reskin afete apenas a página GitHub Pages do repo. Sem mudança no Cloudflare Pages frontend ou no Worker runtime.
- Entrada [Unreleased] anterior (sponsor page alignment) consolidada com o novo reskin — a página continua alinhada ao padrão das demais e agora usa a nova identidade dark-first.

## [mainsite-worker v02.19.00 + mainsite-frontend v03.23.00] - 2026-05-06

### BREAKING / Removido — doações, pagamentos, SumUp e PIX

**Worker (`mainsite-worker`)**

- Removidas as rotas `/api/sumup/*` e toda a superfície pública de checkout/pagamento SumUp. Não há consumidores externos documentados; chamadas antigas passam a não ter endpoint operacional neste app.
- Removidos helpers financeiros, schemas de checkout, `askForDonation`, prompt de doação, bindings/secrets de SumUp/PIX e dependência `@sumup/sdk`.

**Frontend (`mainsite-frontend`)**

- Removidos `DonationModal`, `SumUpCardWidget`, testes, botão "Apoiar" do `PostReader`, gatilho de doação do `ChatWidget` e retomada por `checkout_id`.
- `DisclaimerModal` deixou de tratar `isDonationTrigger`; disclaimers públicos mantêm somente o read-gate editorial.
- CSP em `public/_headers` e cache Workbox deixaram de permitir/nominar gateways SumUp/OPPWA/bandeiras/3DS; manteve Turnstile, analytics, YouTube e Cloudflare Insights.
- `site/index.html` deixou de ser landing de pagamento e passou a ser página neutra do projeto.

### Alterado — dependências, workflows e Dependabot

- Dependências atualizadas para as versões correntes verificadas em 2026-05-06, incluindo React 19.2.6, Hono 4.12.18, Wrangler 4.88.0, Workers Types 4.20260506.1, Google GenAI 1.52.0, Zod 4.4.3, vite-plugin-pwa 1.3.0 e lint-staged 17.0.2.
- `deploy.yml` deixou de exportar `VITE_SUMUP_PUBLIC_API_KEY`.
- Dependabot agora cobre `github-actions`, `/`, `/mainsite-frontend` e `/mainsite-worker`; actions SHA-pinned já estavam nos releases mais recentes.

### Validação

- `npm outdated --long` sem pendências em `/`, `mainsite-frontend` e `mainsite-worker`.
- `npm audit --audit-level=high` sem vulnerabilidades.
- Frontend: `npm run lint`; `npm test`; `npm run build`.
- Worker: `npm run lint`; `npm test`; `npx tsc --noEmit`.
- Root/site: `npm run format:public:check`.
- YAML dos workflows/dependabot parseado via `js-yaml`; `git diff --check`.

### Versões

- mainsite-frontend APP v03.22.00 → APP v03.23.00
- mainsite-worker APP v02.18.00 → APP v02.19.00

## [mainsite-worker v02.18.00 + mainsite-frontend v03.22.00] - 2026-05-01

### Adicionado — auditoria de segurança + UX + paridade TipTap (worker + frontend)

**Worker (`mainsite-worker`)**

- Idempotência + ownership em checkouts SumUp via nova tabela `mainsite_sumup_checkouts` (PK `checkout_id`, UNIQUE `idempotency_key`, `caller_hash` 24h ownership window). Caller diferente em `/status` recebe `PENDING`, não `403`.
- Validação magic-byte (JPG/PNG/GIF/WebP/AVIF/PDF) em uploads antes de `BUCKET.put`.
- Sentiment com timeout (2s) via `Promise.race`.
- Honeypot trigger logado com hash IP/UA estruturado.
- `sanitizePlainText` parser-aware substitui regex strip em comentários (preserva `x < y`).
- Cron handler bugfix (`_ctx` → `ctx`) — restaura `bumpContentVersion`.
- Prompt-injection hardening na rota AI: envelope XML `<user_context_title>` / `<user_context_body>` com escape.
- Fees division-by-zero guard.

**Frontend (`mainsite-frontend`)**

- Error Boundary class component em `main.tsx` ao redor de `QueryClientProvider+App`.
- `useEscapeKey` hook em ContactModal/CommentModal/DonationModal/DisclaimerModal (read-gate preservado no DisclaimerModal via `canClose` lifted ao parent).
- `fetchWithTimeout` com `AbortController` composável (default 8s).
- **PostReader ↔ PostEditor (TipTap) paridade**: tema hljs (github-dark/light) embutido em `PostReader.css` para tokens `<span class="hljs-*">` de `CodeBlockLowlight` (sem dependência runtime); iframes responsivos (`aspect-ratio: 16/9`); `<img>` com `max-width: 100%`; `data-width` whitelisted em `DOMPurify.ADD_ATTR`.
- Validação de `localStorage.themePref` contra union `'light' | 'dark' | 'auto'`.

### Diferido (com rationale)

- iframe-3DS no DonationModal — requer testes em sandbox SumUp e fallback robusto.
- Tightening de `style` em DOMPurify — regrediria inline styles do TipTap em conteúdo já publicado.
- Worker settings Zod schema — refactor amplo, baixo risco residual (admin autenticado).

### Validação

- Worker: lint clean; vitest 8 arquivos / 20 testes.
- Frontend: lint clean; vitest 6 arquivos / 27 testes; build 402 KiB precache, 1812 modules, 1.25s.

## [mainsite-worker v02.17.06 + mainsite-frontend v03.21.08] - 2026-04-30

### Alterado — padronização organizacional do README

- `README.md` passou a seguir o novo padrão organizacional de abertura: logo harmonizado, bloco curto de status e tabela `The version history at a glance` no topo.

## [mainsite-frontend v03.21.06] - 2026-04-26

### Corrigido — text-indent ausente em `.html-content p`

- **`src/components/PostReader.css:189-194`** (`.post-reader .html-content p`): adicionado `text-indent: var(--site-text-indent)` para que parágrafos de HTML (vindos do PostEditor) recebam identação automática mesmo quando o HTML salvo não tem `style="text-indent: …rem"` inline. Antes só `.p-content` (legacy plain-text) tinha esse estilo, então AboutPage e qualquer post com `<p>` "nu" renderizava sem identação. Inline styles continuam vencendo (posts antigos com `text-indent: 1.5rem` inline preservam o valor).
- Pareado com `admin-app` v01.99.04 que muda o default da extensão TextIndent do PostEditor de `0` para `1.5` (paragraph) — toda nova gravação sai com inline `text-indent: 1.5rem`. Conteúdo de `mainsite_about` em D1 backfillado para o mesmo valor.

## [mainsite-worker v02.17.05 + mainsite-frontend v03.21.05] - 2026-04-26

### Adicionado

- **GitHub Pages site** (PIX donation landing) com workflow `pages.yml` no padrão moderno (artifact deployment via `configure-pages` + `upload-pages-artifact` + `deploy-pages`, todos SHA-pinned).

### Alterado

- **`.github/workflows/pages.yml`** — `actions/configure-pages@v6.0.0` passou a declarar `with: enablement: true` para idempotência em forks/clones que ainda não tenham GitHub Pages habilitado (corrige `Get Pages site failed... HTTP 404` em primeiro run).
- **`FUNDING.yml`** — corrigida `custom URL` para apontar a este repo (não cross-review-mcp).

### Validação

- Trilateral cross-review session `08bc6b9a-f3f5-434d-8276-2b21f562a843` (caller + Codex + Gemini) **READY**: paridade confirmada nos 9 repos públicos do workspace em security baseline, repo features, workflow perms, branch rulesets, Pages deployment, CodeQL Default Setup, 0 alertas abertos.

## [mainsite-worker v02.17.04 + mainsite-frontend v03.21.04] - 2026-04-26

### Segurança — leak post-public-flip + Code Scanning alerts (CodeQL)

- **CRÍTICO — token Cloudflare User API vazado**: history scrub via `git-filter-repo` removeu o token (`cfut_*`) que estava em `mainsite-worker/test-genai.ts` (commit `79ea8e22` legado, arquivo já deletado de HEAD desde 2026-04-06). Cloudflare auto-revogou o token via partner notification do GitHub Secret Scanning. Alerta GH #3 marcado como `resolved/revoked`.
- **`js/incomplete-sanitization` × 2**: `mainsite-frontend/src/components/PostReader.tsx:74` e `mainsite-frontend/src/components/AboutPage.tsx:30` passaram a usar `escapeRegExp` (`[.*+?^${}()|[\]\\]`) para escapar todos os caracteres especiais ao construir o pattern regex de domínios internos. CodeQL false-positive (regex pattern construction, não output sanitization), mas o escape mais comprehensive elimina o aviso.
- **`js/incomplete-multi-character-sanitization`**: `mainsite-worker/src/routes/comments.ts:300` agora faz loop até estabilizar no strip de tags HTML para resistir a padrões aninhados.

## [mainsite-worker v02.17.03 + mainsite-frontend v03.21.03] - 2026-04-26

### Adicionado — Phase 3 sweep (flip readiness, puramente aditivo)

- **`CONTRIBUTING.md`**: guia para issues + PRs cobrindo gates locais por sub-app (mainsite-frontend + mainsite-worker), wrangler dry-run, action pinning, versioning, regra de `public/_headers` intocável.
- **`CODE_OF_CONDUCT.md`**: Contributor Covenant 3.0 com canal `***@lcv.dev`.
- **`.github/CODEOWNERS`**: `* @example-beneficiary` como owner default.
- **`.npmignore`**: baseline de ignore para tarball npm (segredo/secrets store/.wrangler/AI memory/internal docs como `NEXTJS_MIGRATION_PLAN.md`).
- **`THIRDPARTY.md`**: inventário completo de dependências mainsite-frontend + mainsite-worker com licenças e origens.

### Corrigido — pre-existing lint warnings em `mainsite-worker/src/index.ts`

- Linha 225 `scheduled(event, env, ctx)` parâmetros não usados → `_event`/`_ctx` para silenciar warning.
- Linha 254 `posts.shift()!` non-null assertion → guarded `if (!topPost) return;`.

## [mainsite-worker v02.17.02 + mainsite-frontend v03.21.02] - 2026-04-26

### Phase 1 sweep — audit residuals

- **lcv-rio → example-beneficiary (audit MEDIUM #14)**: 4 arquivos no `mainsite-frontend` (`index.html`, `functions/[[path]].ts`, `public/llms.txt`, `src/components/PostReader.tsx`) atualizados para apontar à org canônica `example-beneficiary` em GitHub e LinkedIn (JSON-LD `sameAs` arrays + llms.txt + meta tags). ComplianceBanner já estava correto.
- **mainsite-worker dead code purge (audit NIT)**: `src/routes/misc.ts` (router Hono vazio mountado sem rotas) deletado; import e mount removidos de `src/index.ts`.
- **mainsite-worker type tightening (audit NIT)**: `src/env.ts` `AI: any` → `AI: Ai` (tipo nativo de `@cloudflare/workers-types`).
- **mainsite-worker GCP_NL_API_KEY type-drift fix (audit MEDIUM #44)**: tipo passa de `SecretStoreBinding` para `string` em `RawEnv` com comentário explicativo de que é native Worker secret (>1024 chars JSON SA não cabe em Secrets Store). Resolver permanece duck-typed via `typeof binding.get === 'function'`.
- **mainsite-worker EnvSecretsSchema (audit MEDIUM #20)**: `TURNSTILE_SECRET_KEY` e `GCP_NL_API_KEY` removidos de `.optional()`; agora exigidos pelo schema para alinhar com o contrato runtime fail-closed dos handlers (`comments.ts`, `contact.ts` retornam 503 quando faltam). PIX permanece opcional (realmente).

## [docs/SECURITY] - 2026-04-25

### Documentação

- **`SECURITY.md`**: nova seção "Architectural Decision — Content Protection: Attribution over Blocking" formaliza a decisão (CHANGELOG entries v03.13.x e arredores) de remover camadas hostis de bloqueio (contextmenu/keydown/PrintScreen/DevTools/`user-select:none`) em favor de atribuição automática no clipboard. Documentação preventiva contra reintrodução acidental e contra falsos positivos de auditoria. Aborda item NIT #7 da auditoria 2026-04-25.

## [mainsite-worker v02.17.01 + mainsite-frontend v03.21.01] - 2026-04-25

### Public-flip prep (Auditoria Fase 0)

- **D1 nil-UUID + GHA secret-injection**: `mainsite-worker/wrangler.json` e `mainsite-frontend/wrangler.json` substituem o `database_id` real por placeholder nil-UUID (`00000000-0000-0000-0000-000000000000`); o ID real é injetado em deploy via `D1_DATABASE_ID` (GitHub Secret) com substituição `jq` em ambos os configs no único job `deploy`. Replica padrão do oraculo-financeiro v01.10.01. Achado BLOCKING #4 da auditoria 2026-04-25.

## [mainsite-worker v02.17.00] - 2026-04-25

### Hardening (Auditoria trilateral cross-review — Fase 0)

- **`src/lib/auth.ts` — `getAdminEmail` cache com TTL e invalidador**: o cache module-scope que retornava o e-mail do admin sem nunca expirar foi substituído por TTL de 60 s; export de `invalidateAdminEmailCache()` permite invalidação explícita pelos chamadores que mutam `mainsite_settings.mainsite/admin_email`. Achado BLOCKING #3 da auditoria 2026-04-25.
- **`src/routes/contact.ts` — guards de `RESEND_API_KEY` ausente**: `/api/contact` e `/api/comment` retornam `503` com log estruturado em vez de emitir `Bearer undefined` ao Resend caso o resolver do Secrets Store falhe transitoriamente. Achado HIGH #5.
- **`src/routes/ai.ts` + `src/lib/rate-limit.ts` — cap absoluto global em `/api/ai/public/chat`**: nova rota `chat-public-global` no `DEFAULT_RATE_LIMIT` com 500 req/h (default-on, configurável via `mainsite_settings/mainsite/ratelimit`). Independente do toggle per-IP — protege contra botnets ciclando IPs. Retorna `429` quando excedido. Achado HIGH #6.

### Validação

- `npm run lint`.
- `npm test`.
- `npm run build`.

## [Auditoria de Segurança Coordenada] - 2026-04-25

### Segurança

- `mainsite-frontend` passou a usar helpers de publicação nas Pages Functions para impedir que sitemap, feed, páginas de autor e deep links exponham posts ocultos, não publicados ou conteúdo em modo `hidden`.
- `mainsite-worker` bloqueia novos uploads SVG e aplica CSP sandbox + `nosniff` em SVGs legados servidos por R2.
- CSP pública teve `connect-src`, `frame-src` e `form-action` restringidos a hosts explícitos; HTML público passa a sair sem headers CORS permissivos.
- CORS do worker agora exige origens HTTPS; `mainsite-worker` e `admin-motor` usam comparação constante portável para bearer tokens.
- `VITE_API_SECRET` saiu do ambiente de deploy do frontend; headers `Cache-Control` próprios foram removidos das rotas dos apps, preservando gerenciamento nativo da Cloudflare.

### Alterado

- Dependências de `mainsite-frontend` e `mainsite-worker` atualizadas; `WRANGLER_VERSION: "latest"` preservado no workflow por requisito operacional.

### Validação

- `mainsite-frontend`: `npm run lint`, `npm test`, `npm run build`.
- `mainsite-worker`: `npm run lint`, `npm test`, `npx --no-install wrangler deploy --dry-run`.
- `npm audit --audit-level=moderate` e `npm outdated --json` limpos nos dois pacotes.
- Cross-review MCP sessão `74c77006-3948-4b53-91cc-efe9f2c084c8`: Claude e Gemini retornaram `READY` para o pacote técnico.

## [Sobre Este Site — reversão e acabamento visual] - 2026-04-24

### Alterado

- `admin-app`: desmarcar "Sobre Este Site" no editor institucional agora restaura o conteúdo como post comum e limpa `mainsite_about`.
- `mainsite-frontend`: link "Sobre Este Site" no `ArchiveMenu` foi promovido de link hiperdiscreto para pill secundária com ícone e estados de hover/focus.

### Validação

- `admin-app`: `npm run test:admin-motor -- about.test.ts`, `npm run lint`, `npm run build`.
- `mainsite-frontend`: `npm test -- AboutPage.test.tsx`, `npm run lint`, `npm run build`.

## [Sobre Este Site] - 2026-04-24

### Adicionado

- Implantação coordenada do conteúdo institucional "Sobre Este Site" em `admin-app`, `mainsite-worker` e `mainsite-frontend`.
- O conteúdo passa a viver em `mainsite_about`, editado pelos mesmos mecanismos do post editor, exposto publicamente por `/api/about` e renderizado em `/sobre-este-site`.

### Validação

- `admin-app`: `npm run test:admin-motor`, `npm run lint`, `npm run build`.
- `mainsite-worker`: `npm test`, `npm run lint`, `npx tsc --noEmit`.
- `mainsite-frontend`: `npm test`, `npm run lint`, `npm run build`.

## [Security Publication Hardening] - 2026-04-23

### Segurança

- Memórias e contexto de agentes passaram a ser locais apenas: `.ai/`, `.aiexclude`, `.copilotignore` e `.github/copilot-instructions.md` foram adicionados ao ignore e removidos do índice Git com `git rm --cached`, preservando os arquivos no disco local.
- Regras de publicação foram endurecidas para impedir envio de `.env*`, `.dev.vars*`, `.wrangler/`, `.tmp/`, logs, bancos locais e artefatos de teste para GitHub/npm.
- `mainsite-worker` passou a declarar `"private": true` no `package.json`.

### Validação

- `git ls-files` confirmou ausência de memórias/artefatos locais rastreados; `npm pack --dry-run --json --ignore-scripts` não incluiu arquivos proibidos.
