# Plano de Migração: mainsite-frontend → Next.js (SSR completo)

**Status:** Proposta detalhada — não executada
**Data:** 2026-04-12
**Autor:** Leonardo Cardozo Vargas + Claude Code

> ⚠️ **Antes de ler:** este documento descreve uma migração de **40-80h de trabalho** com riscos significativos. A release v03.10.00 (12/04/2026) já implementou pre-rendering edge via Cloudflare HTMLRewriter (`functions/[[path]].ts`), entregando **80% dos ganhos de SEO/GEO sem trocar a stack**. Esta migração só faz sentido se houver objetivos adicionais que o pre-rendering edge não cobre — listados na seção "Quando migrar".

---

## 1. Resumo executivo

| Item | Estado atual (Vite + React 19 + Cloudflare Pages) | Pós-migração (Next.js 15 + Cloudflare Workers / Vercel) |
|---|---|---|
| Renderização | CSR + edge HTMLRewriter para bots | RSC + SSR + ISR nativo |
| Roteamento | URL params manuais via `window.history` | App Router file-system |
| SEO meta | Injetado via HTMLRewriter na edge function | `generateMetadata()` por route |
| JSON-LD | Injetado via HTMLRewriter | Componente `<Script type="application/ld+json">` |
| Imagens | `<img>` puro com `loading="lazy"` | `next/image` com WebP/AVIF + `srcset` automático |
| Fonts | Google Fonts via CDN | `next/font` com self-host + zero CLS |
| Code splitting | Vite manual via `lazy()` | Automático por route + RSC |
| Cache de dados | TanStack Query (CSR) | `cache()` + `revalidateTag()` (SSR) |
| Form handling | Fetch manual | Server Actions |
| Bundle size atual | ~390 KB JS gzipped | Estimado: 200-280 KB (com RSC reduzindo client JS) |

**Tempo estimado:** 40h (mínimo, single dev experiente em Next.js) – 80h (incluindo testes E2E + rollback safety net + validação visual)
**Risco:** Alto. Reescrita parcial da camada de UI + nova plataforma de deploy + nova mental model (Server Components vs Client Components).
**Reversibilidade:** Branch separada + paralelo por 2 semanas. Pode-se reverter via DNS swap se necessário.

---

## 2. Quando migrar (e quando NÃO migrar)

### ✅ Migre se:
1. Quer **incremental Static Regeneration (ISR)** — páginas estáticas que se atualizam automaticamente em background sem rebuild manual.
2. Quer **`next/image`** com geração automática de WebP/AVIF + `srcset` responsivo + blur placeholder + lazy loading nativo. Ganho real em LCP (Core Web Vitals).
3. Vai adicionar **rotas dinâmicas complexas** (filtros, busca facetada, paginação SEO-friendly) que exigem URL state estável.
4. Quer **Server Actions** para reduzir endpoints REST espalhados (form submissions, mutations).
5. Quer **streaming SSR** com Suspense — first byte rápido + UI progressiva.
6. Quer **eliminar o JS de TanStack Query** do bundle do cliente em rotas que só leem dados (RSC faz isso server-side).

### ❌ NÃO migre se:
1. **SEO já está OK** — o pre-rendering edge (`functions/[[path]].ts`) já entrega meta tags + JSON-LD para todos os bots.
2. **Você não tem objetivos claros** que o pre-rendering edge não cobre. "Modernizar a stack" sozinho não justifica o custo.
3. **A Cloudflare Pages stack atual está estável e barata.** Next.js no Cloudflare Workers tem limitações (Edge Runtime, sem Node.js APIs full); na Vercel custa dinheiro acima do free tier.
4. **Você não quer aprender RSC/Server Actions agora.** O modelo mental é diferente e tem pegadinhas.
5. **O tráfego é baixo (< 10k pageviews/mês).** Os ganhos são marginais nesse volume.

### 🟡 Alternativa intermediária (RECOMENDADA antes de migrar)
**Astro com hidratação ilhas** ou **Remix em Cloudflare Workers** entregam SSR sem o overhead de aprender RSC. Astro especialmente é uma vitória rápida para blogs editoriais — o conteúdo é HTML estático puro com ilhas React só onde precisa interatividade. Worth considering.

---

## 3. Pré-requisitos técnicos

| # | Requisito | Como validar |
|---|---|---|
| 1 | Node.js 20.x+ | `node -v` |
| 2 | Decisão de host: Cloudflare Workers (via `@opennextjs/cloudflare`) **ou** Vercel **ou** auto-hospedado | — |
| 3 | Acesso ao D1 do Cloudflare (mantendo) ou migração para outro DB se sair do CF | Verificar binding `DB` no `wrangler.json` |
| 4 | Branch `feat/nextjs-migration` separada do `main` | `git checkout -b feat/nextjs-migration` |
| 5 | Decisão sobre URLs canonical: manter `/p/{id}` ou migrar para slugs `/{slug}-{id}`? | Definição editorial |
| 6 | Snapshot do D1 para teste local (`wrangler d1 export`) | — |
| 7 | Inventário de URLs vivas (sitemap.xml atual) — usado para teste de regressão | `curl https://www.reflexosdaalma.blog/sitemap.xml` |
| 8 | Estratégia de deploy paralelo: subdomain `next.reflexosdaalma.blog` por 2 semanas antes de promover | DNS / Cloudflare config |

---

## 4. Decisões arquiteturais

### 4.1 Plataforma de deploy

**Opção A — Cloudflare Workers via `@opennextjs/cloudflare`** ⭐ recomendada
- ✅ Mantém D1, R2, KV, Service Bindings sem mudanças
- ✅ Mantém o `_headers` (SumUp constraint preservado)
- ✅ Custo zero no plano free
- ✅ Edge global (latência baixa)
- ⚠️ Edge Runtime tem limites: sem `fs`, sem alguns Node APIs, ISR via cache de Workers KV (não full feature parity com Vercel ISR)
- ⚠️ `@opennextjs/cloudflare` ainda em beta, mudanças possíveis

**Opção B — Vercel**
- ✅ Suporte oficial e completo a Next.js (referência)
- ✅ ISR nativo, cache invalidation por tag, Image Optimization API
- ❌ Custo: free tier limitado a 100 GB bandwidth/mês
- ❌ Sai do Cloudflare → precisa migrar D1 → Postgres/PlanetScale/Turso
- ❌ `_headers` precisa ser reescrito como `next.config.js headers()` — risco SumUp

**Opção C — Auto-hospedado (Node.js + Docker)**
- ✅ Controle total
- ❌ Custo de infraestrutura, ops, observability — overkill para um blog

**Recomendação: Opção A** — preserva tudo o que já funciona (D1, headers, R2, custo) e ganha SSR + RSC. Aceita as limitações do Edge Runtime como trade-off razoável.

### 4.2 App Router vs Pages Router

**App Router** (Next.js 13+, padrão atual). Pages Router está em modo de manutenção. Sem dúvida.

### 4.3 Renderização: estratégia por rota

| Rota | Estratégia | Justificativa |
|---|---|---|
| `/` (home) | **ISR com revalidate=300s** | Lista de posts muda raramente; 5min de cache aceitável |
| `/p/[id]` (post) | **SSG + on-demand revalidate** | Post estático até alguém editar; revalidação por tag via webhook do worker |
| `/autor/[slug]` | **ISR com revalidate=600s** | Lista raramente muda |
| `/sitemap.xml` | **SSG + revalidate=3600s** ou rota dinâmica | Mesma lógica do atual |
| `/feed.xml` | **SSG + revalidate=3600s** | Idem |
| `/api/*` | **Route handlers** ou continuar no `mainsite-worker` | Decisão: manter API no worker via Service Binding (zero refactor de backend) |

### 4.4 Server vs Client Components

| Componente atual | Após migração | Razão |
|---|---|---|
| `App.tsx` (root) | Server Component | Não precisa de state |
| `PostReader.tsx` | Server Component | Renderiza HTML do post — puro markup |
| `ArchiveMenu.tsx` | Client Component | Tem dropdown interativo |
| `ChatWidget.tsx` | Client Component | WebSocket / streaming |
| `DonationModal.tsx` | Client Component | SumUp SDK só roda no cliente |
| `RatingWidget.tsx` | Client Component | State local + POST |
| `CommentsSection.tsx` | Misto: Server (lista) + Client (form) | RSC para fetch + ilha cliente para input |
| `ShareOverlay.tsx` | Client Component | Web Share API |
| `TextZoomControl.tsx` | Client Component | localStorage + state |

**Regra geral:** começar com tudo Server Component, marcar `'use client'` só onde for necessário (state, effects, event handlers, browser APIs).

### 4.5 Estado global

- **Eliminado:** TanStack Query para fetches server-side (RSC fetch tem cache nativo)
- **Mantido:** TanStack Query só nos Client Components que ainda fazem mutations (DonationModal, CommentsSection)
- **Novo:** Server Actions para forms (contact, comments, ratings) — eliminam endpoints REST inteiros do worker

### 4.6 Estilização

- **Mantém CSS modules ou CSS puro** — sem migrar para Tailwind/styled-components nesta etapa
- `next/font` para Inter (auto self-host) — elimina request a `fonts.googleapis.com` e o CLS associado

### 4.7 Imagens

- **`next/image`** para tudo — gera WebP/AVIF automaticamente
- Imagens dentro do `content` HTML do post: precisam de transformação no parse para virar `<Image>` ou ficam como `<img>` puro. Trade-off: o `content` é HTML do TipTap, parsing/transformar adiciona complexidade. Decisão sugerida: **deixar `<img>` no content** e usar `next/image` apenas em componentes de UI (header, og preview, etc).

---

## 5. Plano de execução faseado

### Fase 0 — Preparação (4-6h)

- [ ] Criar branch `feat/nextjs-migration`
- [ ] Snapshot D1 + dump local para dev
- [ ] Inventário de URLs vivas via `sitemap.xml` → arquivo `migration-urls.txt`
- [ ] Capturar screenshots de baseline (Playwright) das 10 URLs mais importantes — usado para regressão visual
- [ ] Documentar todas as variáveis de ambiente atuais (`wrangler.json` + Cloudflare dashboard)
- [ ] Definir host: Cloudflare Workers via `@opennextjs/cloudflare`
- [ ] Definir domínio de teste: `next.reflexosdaalma.blog`

### Fase 1 — Bootstrap Next.js (4-6h)

- [ ] `npx create-next-app@latest mainsite-frontend-next --typescript --app --no-tailwind --turbopack`
- [ ] `npm install @opennextjs/cloudflare` + config inicial
- [ ] Configurar `wrangler.json` com mesmos bindings (DB, BUCKET, WORKER service binding)
- [ ] Reproduzir `_headers` via `next.config.js headers()` SE for migrar para Vercel; manter `_headers` se for Cloudflare Workers
- [ ] CI: GitHub Actions com `wrangler deploy` (alinhado com a memória `feedback_no_wrangler_deploy.md` — usar git push, não wrangler CLI direto)
- [ ] Deploy inicial em `next.reflexosdaalma.blog` com hello world
- [ ] Validar que D1 binding funciona via uma rota `/api/healthcheck` que faz um SELECT 1

### Fase 2 — Layout raiz e meta (3-5h)

- [ ] `app/layout.tsx`: HTML root, `<html lang="pt-BR">`, fonts via `next/font`, GA script via `next/script` strategy="afterInteractive"
- [ ] `app/layout.tsx`: `generateMetadata()` com base do site — title template, og defaults, alternate hreflang
- [ ] Site-level JSON-LD (WebSite + Person) como `<Script type="application/ld+json">` no layout
- [ ] Migrar `manifest.webmanifest`, `llms.txt`, `robots.txt`, `c8f3a7d6...txt` para `app/` ou `public/`
- [ ] Validar visualmente que os meta tags + JSON-LD aparecem no `view-source:`

### Fase 3 — Página inicial (4-6h)

- [ ] `app/page.tsx` (Server Component): fetch posts via D1 binding direto
- [ ] Renderizar lista (componente Server)
- [ ] Hidratar widgets cliente (`ChatWidget`, `DonationModal`, etc) via `dynamic(() => import('...'), { ssr: false })` ou `'use client'`
- [ ] Configurar `revalidate = 300` na page
- [ ] Testar: `next.reflexosdaalma.blog/` mostra a home com posts reais do D1 de produção

### Fase 4 — Página de post (6-10h) — **A CRÍTICA**

- [ ] `app/p/[id]/page.tsx` (Server Component)
- [ ] `generateStaticParams()`: lista todos os IDs do D1
- [ ] `generateMetadata({ params })`: replica a lógica do `functions/[[path]].ts` (extrai title, description, og:image dinâmico, datas, autor)
- [ ] Renderizar JSON-LD Article + BreadcrumbList via `<Script>`
- [ ] Componente `PostReader` migrado para Server Component (puro markup)
- [ ] Subcomponentes interativos (rating, comentários, share) como Client Components
- [ ] Configurar `revalidate` ou `dynamic = 'force-static'` + `revalidateTag('post')` no save do post
- [ ] **Webhook de invalidação:** o `mainsite-worker` precisa chamar `POST /api/revalidate?tag=post` ao salvar um post (substitui o `bumpContentVersion` atual)
- [ ] Testar: editar post no admin → ver dentro de 60s a mudança em `next.reflexosdaalma.blog/p/{id}` sem reload
- [ ] Testar regressão visual: comparar screenshots Fase 0 vs Fase 4

### Fase 5 — Páginas auxiliares (3-5h)

- [ ] `app/autor/[slug]/page.tsx` (replica a edge function atual)
- [ ] `app/sitemap.ts` (Next.js native — gera sitemap.xml)
- [ ] `app/feed.xml/route.ts` ou `app/rss.xml/route.ts` (Route Handler)
- [ ] `app/robots.ts` (Next.js native)
- [ ] `app/manifest.ts` (Next.js native, substitui `manifest.webmanifest` estático)

### Fase 6 — Componentes interativos (6-10h)

- [ ] `DonationModal` → `'use client'`. SumUp SDK exige browser; `_headers` CSP preservado.
- [ ] `ChatWidget` → `'use client'` + manter conexão com worker AI
- [ ] `RatingWidget` → Server Action para POST do rating (elimina endpoint `/api/ratings/upsert`)
- [ ] `CommentsSection` → Server Component para listar + Server Action para criar comment + Client Component para form
- [ ] `ContactModal` → Server Action
- [ ] `ShareOverlay`, `ArchiveMenu`, `TextZoomControl` → `'use client'` direto
- [ ] **TanStack Query** mantido apenas em formulários com optimistic UI (DonationModal)
- [ ] Validar que todos os modals abrem, fecham, submetem dados corretamente

### Fase 7 — API & Server Actions (4-6h)

- [ ] **Decisão chave:** manter o `mainsite-worker` rodando como backend separado via Service Binding **OU** absorver tudo em Route Handlers Next.js
- [ ] **Recomendação:** manter o worker. Razões: já está estável, tem rate limits Cloudflare nativos, autenticação admin, integração com Gemini/SumUp, telemetria. Reescrever no Next.js é mais 20-40h sem ganho.
- [ ] Service Binding: Next.js no Cloudflare Workers consome o `mainsite-worker` via binding `WORKER` (já existe)
- [ ] Route Handler `/api/[...path]/route.ts` faz proxy para o worker, mesma lógica do `functions/api/[[path]].ts` atual
- [ ] Server Actions internas chamam o worker via binding direto (ou substituem endpoints simples como ratings)

### Fase 8 — Testes e validação (8-12h)

- [ ] **E2E Playwright:** rodar todos os tests `e2e/` existentes contra `next.reflexosdaalma.blog`
- [ ] Adicionar testes faltantes: validação de meta tags por View-Source, JSON-LD parsing, og:image dinâmico
- [ ] **Lighthouse audit** comparativo: baseline (atual) vs Next.js. Targets:
  - LCP < 2.5s
  - CLS < 0.1
  - FID < 100ms
  - Performance score > 95
  - SEO score 100
- [ ] **Regressão visual** com Playwright screenshots Fase 0
- [ ] **Crawler test:** rodar Screaming Frog ou simular GPTBot/ClaudeBot user-agent contra `next.reflexosdaalma.blog/p/{id}` e validar HTML completo
- [ ] **D1 read-only mode:** apontar Next.js para D1 prod (read) sem permitir writes durante teste paralelo
- [ ] **Stress test:** k6 ou autocannon contra a home + 10 posts simulando bot crawl

### Fase 9 — Cutover (4-6h)

- [ ] Comunicar janela de manutenção (1h) ao público (banner discreto)
- [ ] **Dia D:** apontar DNS de `www.reflexosdaalma.blog` para o novo deploy
- [ ] Manter o deploy antigo em `legacy.reflexosdaalma.blog` por 2 semanas
- [ ] Submeter sitemap atualizado ao Google Search Console + Bing Webmaster
- [ ] Pingar IndexNow com lista completa de URLs
- [ ] Monitorar:
  - Cloudflare Analytics (request volume, errors)
  - Google Search Console (crawl errors, index coverage)
  - SumUp dashboard (donation funnel — CRÍTICO, se quebrar é perda direta de doações)
  - GA4 (pageviews, bounce rate)
- [ ] **Rollback plan:** se em 24h a taxa de erro > 1% OU as doações caírem > 30% vs baseline → DNS revert para legacy

### Fase 10 — Pós-migração (4-6h)

- [ ] Remover branch legacy `mainsite-frontend` (após 30 dias estáveis)
- [ ] Deletar `functions/[[path]].ts` antigo (substituído por `generateMetadata`)
- [ ] Atualizar memórias: `.ai/memory.md`, `app_memories_ref.md`, `project_workspace.md`
- [ ] Atualizar documentação: README, ARCHITECTURE
- [ ] Bump major version: APP v04.00.00
- [ ] Postmortem: o que funcionou, o que não, o que tomou mais tempo que esperado

---

## 6. Mapa de migração arquivo-a-arquivo

| Arquivo atual | Destino Next.js | Tipo de mudança |
|---|---|---|
| `src/main.tsx` | DELETE (substituído por App Router automático) | Remove |
| `src/App.tsx` | `app/page.tsx` + `app/layout.tsx` | Refactor profundo |
| `src/components/PostReader.tsx` | `app/p/[id]/page.tsx` + componente Server | Refactor |
| `src/components/ArchiveMenu.tsx` | `components/ArchiveMenu.tsx` (`'use client'`) | Mover + marcar |
| `src/components/ChatWidget.tsx` | `components/ChatWidget.tsx` (`'use client'`) | Mover + marcar |
| `src/components/DonationModal.tsx` | `components/DonationModal.tsx` (`'use client'`) | Mover + marcar |
| `src/components/RatingWidget.tsx` | `components/RatingWidget.tsx` + Server Action | Refactor (RSC + form action) |
| `src/components/CommentsSection.tsx` | Misto Server + Client | Refactor |
| `index.html` | `app/layout.tsx` (head via `metadata` export) | Reescreve |
| `functions/[[path]].ts` | `app/p/[id]/page.tsx` `generateMetadata` | Lógica replicada em RSC |
| `functions/sitemap.xml.ts` | `app/sitemap.ts` | Reescreve usando API nativa |
| `functions/feed.xml.ts` | `app/feed.xml/route.ts` | Reescreve como Route Handler |
| `functions/autor/[slug].ts` | `app/autor/[slug]/page.tsx` | Reescreve como RSC |
| `functions/api/[[path]].ts` | `app/api/[...path]/route.ts` | Reescreve como Route Handler proxy |
| `public/llms.txt` | `public/llms.txt` | Mantém |
| `public/robots.txt` | `app/robots.ts` | Reescreve como código |
| `public/manifest.webmanifest` | `app/manifest.ts` | Reescreve como código |
| `public/_headers` | **NÃO MIGRA** — manter como está se ficar em CF Workers; CSP reescrito em `next.config.js` se for Vercel | ⚠️ SumUp constraint |
| `vite.config.ts` | DELETE | — |
| `tsconfig.json` | Reescrita pelo `create-next-app` | Reescreve |

---

## 7. Riscos e mitigações

| Risco | Severidade | Mitigação |
|---|---|---|
| **SumUp donation flow quebra** | 🔴 CRÍTICO | Testar exhaustivamente em staging antes do cutover. Manter `_headers` intacto. Validar CSP. Rollback em < 1h se cair. |
| **CSP rejeita scripts inline JSON-LD** | 🟡 ALTO | Next.js gera JSON-LD inline; precisa de `'unsafe-inline'` no script-src OU usar nonce. Validar antes do cutover. |
| **D1 binding não funciona em `@opennextjs/cloudflare`** | 🟡 ALTO | Validar na Fase 1 com healthcheck. Fallback: rotear via service binding `WORKER`. |
| **ISR cache miss em CF Workers** | 🟡 MÉDIO | Workers KV tem latência maior; usar `revalidateTag` em vez de `revalidate` time-based para previsibilidade. |
| **Imagens hosted externamente quebram em `next/image`** | 🟡 MÉDIO | Configurar `images.remotePatterns` no `next.config.js`. Ou manter `<img>` puro nos posts. |
| **Migration de URL muda canonical → perda de SEO** | 🔴 ALTO | NÃO mudar URLs. Manter `/p/{id}` e todos os aliases (`/post/`, `/materia/`, etc). 301 redirects para qualquer mudança. |
| **GA4 perde tracking** | 🟢 BAIXO | Migrar via `next/script` strategy="afterInteractive". Validar com debugger. |
| **Crawler vê HTML diferente do atual** | 🟡 MÉDIO | Comparar `view-source:` lado a lado. Garantir paridade ou superior em meta+JSON-LD. |
| **Comentários/ratings perdem dados durante cutover** | 🟢 BAIXO | API permanece no worker — sem mudança de DB. |
| **Custo Cloudflare aumenta** | 🟢 BAIXO | Workers free tier = 100k req/dia. Blog está bem abaixo disso. |

---

## 8. Checklist de paridade funcional

Ao final da migração, validar item por item:

- [ ] Home renderiza headline + grid de posts
- [ ] `/p/{id}` renderiza post com mesma formatação editorial (recuo, justificação, mídia, mentions)
- [ ] Aliases `/post/{id}`, `/materia/{id}`, `/m/{id}`, `/s/{id}` redirecionam 301 para `/p/{id}`
- [ ] `/autor/{slug}` lista posts do autor com JSON-LD CollectionPage
- [ ] `/sitemap.xml` retorna XML válido com home + posts + autores + feed
- [ ] `/feed.xml` retorna RSS 2.0 válido (validar em https://validator.w3.org/feed/)
- [ ] `/robots.txt` permite explicitamente bots de IA
- [ ] `/llms.txt` acessível
- [ ] `/manifest.webmanifest` válido (Lighthouse PWA)
- [ ] `/{IndexNow-key}.txt` acessível
- [ ] DonationModal abre, processa cartão SumUp, gera PIX
- [ ] ContactModal envia e-mail
- [ ] CommentsSection lista + permite criar comment
- [ ] RatingWidget POST funciona
- [ ] ChatWidget conecta ao worker AI
- [ ] ShareOverlay funciona em mobile (Web Share API)
- [ ] ArchiveMenu por data funciona
- [ ] TextZoomControl persiste em localStorage
- [ ] FloatingTextZoomControl visível em mobile
- [ ] DisclaimerModal aparece para visitantes novos
- [ ] ContentUpdateToast aparece quando admin publica novo post
- [ ] GA4 registra pageviews
- [ ] Meta tags por post (View-Source) idênticas ou superiores ao baseline
- [ ] JSON-LD Article + BreadcrumbList parseiam sem erros (Google Rich Results Test)
- [ ] og:image dinâmico extraído da primeira imagem do post
- [ ] Lighthouse Performance ≥ 95
- [ ] Lighthouse SEO = 100
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse Best Practices ≥ 95

---

## 9. Custo total estimado

| Categoria | Mínimo | Máximo |
|---|---|---|
| Tempo de dev (Fase 0-10) | 40h | 80h |
| Custo de oportunidade (features paradas durante migração) | — | — |
| Risco de regressão (downtime, perda de doações) | $0 (com rollback) | $$$ |
| Aprendizado de novos modelos (RSC, Server Actions, `@opennextjs/cloudflare`) | 4-8h | 16h |
| **TOTAL** | **44h** | **96h** |

---

## 10. Métrica de sucesso

A migração é considerada bem-sucedida quando, **30 dias após o cutover**:

1. Lighthouse Performance ≥ 95 em /, /p/{id}, /autor/{slug}
2. Index coverage no Google Search Console = baseline ou superior
3. Crawl rate (Bing + Google) = baseline ou superior
4. Bounce rate em GA4 ≤ baseline + 5%
5. Taxa de doação (SumUp dashboard) ≥ baseline (CRÍTICO)
6. Zero erros 5xx em Cloudflare Analytics
7. Zero issues abertos no GitHub relacionados à migração
8. Bundle JS no cliente reduziu em ≥ 30% vs baseline
9. LCP médio ≤ baseline (Web Vitals do GA4)
10. Equipe (você) confortável fazendo edits no Next.js sem documentação

Se qualquer um desses critérios falhar após 30 dias, o postmortem deve avaliar se é fix incremental ou rollback.

---

## 11. Recomendação final

**Não migre agora.** A release v03.10.00 (12/04/2026) já entregou a maior parte do benefício de SEO/GEO via pre-rendering edge. Os ganhos adicionais de Next.js (RSC, ISR nativo, `next/image`) são reais mas marginais para um blog editorial de tráfego moderado.

**Quando reconsiderar:**
- Se for adicionar busca facetada / filtros / paginação SEO-friendly
- Se o tráfego crescer 10x e o LCP virar problema
- Se quiser eliminar completamente o JS do cliente em rotas de leitura
- Se houver dor real de manutenção na arquitetura atual

**Caminho intermediário se quiser modernizar antes:** Astro com ilhas. 1/4 do esforço, 80% dos ganhos, sem aprender RSC.

---

**Autor:** Plano gerado em 2026-04-12 durante a release SEO/GEO v03.10.00 (mainsite-frontend) + v02.09.00 (mainsite-worker).
**Próxima revisão sugerida:** Q3 2026 ou quando aparecer um requisito que o pre-rendering edge não suporte.
