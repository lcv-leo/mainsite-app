<p align="center">
  <img src=".github/assets/lcv-ideas-software-logo.svg" alt="LCV Ideas &amp; Software" width="520" />
</p>

# mainsite-app

[![status: stable](https://img.shields.io/badge/status-stable-brightgreen.svg)](#status)
[![Deploy](https://github.com/LCV-Ideas-Software/mainsite-app/actions/workflows/deploy.yml/badge.svg)](https://github.com/LCV-Ideas-Software/mainsite-app/actions/workflows/deploy.yml)
[![Pages](https://github.com/LCV-Ideas-Software/mainsite-app/actions/workflows/pages.yml/badge.svg)](https://github.com/LCV-Ideas-Software/mainsite-app/actions/workflows/pages.yml)
[![runtime: Cloudflare Pages + Workers](https://img.shields.io/badge/runtime-Cloudflare%20Pages%20%2B%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![framework: React 19 + Vite 8](https://img.shields.io/badge/framework-React%2019%20%2B%20Vite%208-61dafb.svg)](https://react.dev/)
[![backend: Hono on Workers](https://img.shields.io/badge/backend-Hono%20on%20Workers-f97316.svg)](https://hono.dev/)
[![license: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)

**Reflexos da Alma** — public personal blog + companion services. Two independent Cloudflare deploys served from this monorepo, both reading from the shared Cloudflare D1 database `bigdata_db`:

- **`mainsite-frontend`** — React 19 + Vite 8 single-page app on Cloudflare Pages, primary domain `example-blog.invalid` (+ secondary aliases). Public-facing site with reading experience, comments, ratings, AI chatbot, share-by-email, and accessibility-first design.
- **`mainsite-worker`** — Hono backend on Cloudflare Workers serving `/api/*` for the frontend. AI surfaces (Gemini models through Vertex AI), moderation (GCP Natural Language API + Turnstile), email relay (Resend), and R2 media.

**Status.** Stable. Current internal versions: **mainsite-frontend v03.25.00** and **mainsite-worker v02.22.00**. See [CHANGELOG.md](./CHANGELOG.md) for the full version history.

The version history at a glance:

| Internal version                                                | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`mainsite-frontend v03.25.00` + `mainsite-worker v02.22.00`** | **Native organization governance (frontend release; the worker stays at v02.22.00, in production since 27/08).** The Actions lockfile, the advanced CodeQL workflow, the `Public Format` workflow and the repository-owned license verifier leave; the `CI` workflow on pull requests to `main`, the canonical Dependabot auto-merge workflow, weekly grouped Dependabot updates and `INBOUND.md` enter; `THIRDPARTY.md` and its served copy list components by name, license and source; `browserslist` moves to 4.28.8 in the frontend lockfile and the `fast-uri` override to 4.1.4 (six high advisories published after the last deploy; Dependabot alerts #53–#56). Internal version only, no tag or GitHub Release. |
| **`mainsite-worker v02.22.00` + `mainsite-frontend v03.24.00`** | **Moderation key moved to the Secrets Store (worker only, issue #488).** `GCP_NL_API_KEY` stops being a native Worker secret and becomes a `secrets_store_secrets` binding, like `VERTEX_SA_KEY` — the 1024-character limit that forced the native format has expired, and the current ceiling is 64 KiB per secret. The resolver was already duck-typed on `.get()`, so no moderation logic changed. The service account was replaced by a dedicated one in the institutional project, holding the minimum `roles/serviceusage.serviceUsageConsumer` role. Also clears the 12 accumulated typecheck errors, so `tsc --noEmit` runs clean. |
| **`mainsite-frontend v03.24.00` + `mainsite-worker v02.21.00`** | **Inline-style value allowlist (frontend only, issue #411).** Both DOMPurify call sites now rewrite each `style` attribute keeping only the CSS properties the TipTap editor emits, with validated values — published TipTap content survives while `url()`/`expression()`/`position` are dropped. Closes the deferral recorded in v03.22.00.                                                                                                                                 |
| **`mainsite-worker v02.21.00` + `mainsite-frontend v03.23.05`** | **Settings JSON Zod schema (worker only, issue #410).** The four settings PUTs now validate payloads with Zod schemas before the `mainsite_settings` upsert — invalid JSON or structurally wrong shapes return 400 without touching D1. The original text is still what persists (item extras like `isDonationTrigger` survive; the legacy root-`enabled` ratelimit shape stays accepted) and every fail-safe reader is untouched. Closes the deferral recorded in v02.18.00. |
| **`mainsite-worker v02.20.01` + `mainsite-frontend v03.23.05`** | **Legacy AI Studio binding retired (worker only).** Drops the `GEMINI_API_KEY` binding, its two type declarations, the resolver `SECRET_KEYS` entry and the optional schema field — nothing had read the key since the Vertex migration. Also realigns `APP_VERSION`, which had stayed at `v02.19.05` while the sub-app changelog already recorded v02.20.00.                                                                                                                 |
| **`mainsite-worker v02.20.00` + `mainsite-frontend v03.23.05`** | **Vertex AI migration (worker only).** AI transport moves from the AI Studio API key to Vertex AI with service-account OAuth (JWT RS256 via WebCrypto → OAuth2 access token), shifting AI spend from AI Studio prepay to Cloud Billing postpay. The public surface of `lib/genai.ts` is preserved, so no call site changed; prompts, D1 model selection, retries, safety settings and telemetry are untouched. Adds `src/lib/vertex.ts` and drops `@google/genai`.            |
| **`mainsite-worker v02.19.05` + `mainsite-frontend v03.23.05`** | **Dependency security patch.** Hono 4.12.34 (GHSA-8j4g-w8fx-2239), `brace-expansion` 5.0.9 (GHSA-rgw5-rvv9-x895), `fast-uri` 4.1.2 (GHSA-7p8r-x3mc-p8w7), Wrangler 4.118.0, PostCSS 8.5.25 and the `miniflare → undici` override at 7.29.0.                                                                                                                                                                                                                                   |
| **`mainsite-worker v02.19.04` + `mainsite-frontend v03.23.04`** | **Dependency security patch.** Resolves GHSA-3jxr-9vmj-r5cp in both sub-apps with major-compatible `brace-expansion` overrides and GHSA-j3f2-48v5-ccww in the worker with `protobufjs` 7.6.5; also ships the already-landed native Cloudflare rate-limit cleanup.                                                                                                                                                                                                             |
| **`mainsite-worker v02.19.03` + `mainsite-frontend v03.23.03`** | **4-gate quality directive compliance.** Added Biome checks to both sub-apps, aligned configs, reformatted code, and bumped APP_VERSION in both packages.                                                                                                                                                                                                                                                                                                                     |
| **`mainsite-worker v02.19.02` + `mainsite-frontend v03.23.02`** | **Site sponsor card iteration.** `site/index.html` GitHub Sponsors iframe (caixa branca cross-origin) substituído por link card dark navy com ❤ pink + meta cyan + seta animada; card movido para DEPOIS dos botões (lcv.dev/sponsor primário, GitHub Sponsors alternativa). Companion ship Phase 3 (12 repos).                                                                                                                                                               |
| **`mainsite-worker v02.19.01` + `mainsite-frontend v03.23.01`** | **Site visual identity refresh + sponsor-page alignment (2026-05-09).** `site/index.html` (GitHub Pages) recebeu a identidade dark-first navy/cyan da LCV Ideas & Software e consolidou a entrada anterior de sponsor-page alignment: o site do projeto encaminha apoio para `https://www.lcv.dev/sponsor?project=mainsite-app`, sem carregar SDKs de pagamento nem coletar dados de cartão.                                                                                               |
| **`mainsite-worker v02.19.00` + `mainsite-frontend v03.23.00`** | **Donation/payment removal + dependency/workflow hygiene.** Removed public donation/payment UI, SumUp widget/routes/secrets/dependencies, PIX/payment CSP/PWA cache allowances, and the payment landing page; updated direct dependencies and expanded Dependabot coverage for the root package.                                                                                                                                                                              |
| **`mainsite-worker v02.18.00` + `mainsite-frontend v03.22.00`** | **Security + UX audit + TipTap parity.** Worker: magic-byte upload validation, sentiment timeout, prompt-injection envelope, cron handler bugfix. Frontend: Error Boundary, ESC handler in all modals (read-gate preserved on disclaimer), fetch timeout, localStorage validation, PostReader↔PostEditor parity (embedded hljs theme, responsive iframes, image max-width, `data-width` whitelist).                                                                           |
| **`mainsite-worker v02.17.06` + `mainsite-frontend v03.21.08`** | **README organizational standardization.** Adopted the shared repository README opening pattern and introduced the top-level version-history table for the monorepo.                                                                                                                                                                                                                                                                                                          |
| **`mainsite-frontend v03.21.06`**                               | **Typography parity fix.** Restored default text indentation for HTML paragraph rendering so saved PostEditor content matches the intended reading layout.                                                                                                                                                                                                                                                                                                                    |
| **`mainsite-worker v02.17.05` + `mainsite-frontend v03.21.05`** | **Pages + Sponsors public surface.** Added the GitHub Pages project site, corrected the Sponsors custom URL, and modernized the Pages workflow.                                                                                                                                                                                                                                                                                                                               |
| **`mainsite-worker v02.17.04` + `mainsite-frontend v03.21.04`** | **Security and history cleanup.** Closed CodeQL issues, removed a leaked legacy Cloudflare token from Git history, and tightened sanitization paths.                                                                                                                                                                                                                                                                                                                          |

## What it does

Public-facing artifact + edge-deployed APIs:

1. **Reading experience** — `PostReader` with smart polling (`useContentSync` + `ContentUpdateToast`) for live updates, JSON-LD + OG/Twitter Card SEO metadata, attribution-based clipboard handling (intentionally NOT a hostile copy-blocker — see [SECURITY.md](./SECURITY.md) ADR), reading-progress accessibility hooks.
2. **Comments + ratings** — Turnstile-gated public submission, GCP NL sentiment-aware moderation pipeline, threaded replies, idempotent rating accumulation.
3. **AI public chatbot (`/api/ai/public/chat`)** — Gemini-powered helper served through Vertex AI, with content-aware context grounded on published posts. Hard caps: per-IP rate limit + global hourly budget cap (default-on).
4. **Share-by-email + contact** — Turnstile-gated, Resend-relayed, canonical-link-validated, recipient-window-capped (5/recipient/24h).
5. **Theme system** — `/api/theme.css` same-origin, generated from D1 settings to keep CSP strict.
6. **R2 media + uploads** — `image/jpeg|png|gif|webp|avif|pdf` allowlisted with magic-byte sniffing, 10 MB cap, SVG explicitly blocked (legacy SVGs served sandboxed with `Content-Security-Policy: sandbox`).
7. **Pages Functions** — server-side rendering for deep links (HTMLRewriter-injected OG/JSON-LD), `/autor/:slug` SSR, sitemap + feed honoring publishing mode.

## Architecture

```
Browser
  ├──→ Cloudflare Pages: mainsite-frontend (React 19 + Vite 8)
  │      └─ public/_headers: CSP for Turnstile, analytics, YouTube and Cloudflare Insights
  │      └─ functions/[[path]].ts: SSR for /, /p/:id, /autor/:slug, /sitemap.xml, /feed.xml
  │      └─ /api/* → Service Binding → mainsite-worker
  │
  └──→ Cloudflare Worker: mainsite-worker (Hono)
        ├─ public surface: posts, comments, ratings, AI chat, contact, share-email,
        │  theme.css, content-fingerprint, uploads
        ├─ admin surface (CF-Access JWT or bearer): post CRUD, settings, moderation,
        │  share-email logs
        └──→ D1 (bigdata_db) + R2 (mainsite-media) + Workers AI + Vertex AI (Gemini models)
```

The shared D1 binding is declared directly in both `wrangler.json` files. Its UUID is an identifier, not a credential. The Worker also versions the `store_id` and `secret_name` metadata required by Cloudflare's official Secrets Store binding; secret values, Cloudflare API tokens and application credentials remain outside the repository.

## Deploy your own fork

You will need:

- A Cloudflare account ([free tier](https://www.cloudflare.com/plans/)) with Pages + Workers + D1 + R2 enabled.
- The Cloudflare CLI [`wrangler`](https://developers.cloudflare.com/workers/wrangler/).
- Node.js 24+.
- A Google Cloud project with Vertex AI enabled and a least-privilege service account whose JSON credential will be stored as `VERTEX_SA_KEY`.
- Resend API key (transactional email).
- Cloudflare Turnstile site key + secret (form anti-abuse).
- (Optional) GCP Service Account with Cloud Natural Language API access (comment moderation).

### 1. Clone + install

```bash
git clone https://github.com/LCV-Ideas-Software/mainsite-app.git
cd mainsite-app
cd mainsite-frontend && npm ci && cd ..
cd mainsite-worker && npm ci && cd ..
```

### 2. Create D1 database + R2 bucket

```bash
npx wrangler d1 create example_db
# wrangler outputs:
#   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
npx wrangler r2 bucket create mainsite-media
```

### 3. Wire the D1 database into both `wrangler.json` files

Set `database_name` to the name created in step 2 (`example_db` in the example) and `database_id` to the UUID returned by Wrangler in both:

- `mainsite-frontend/wrangler.json` (Pages app)
- `mainsite-worker/wrangler.json` (Worker)

### 4. Configure Cloudflare Secrets Store secrets

Create or select your own Cloudflare Secrets Store, replace the repository-specific `store_id` and `secret_name` metadata, and populate the bindings declared in `mainsite-worker/wrangler.json`. Wrangler requires those identifiers in the versioned configuration, but the secret values themselves must never be committed. `CLOUDFLARE_PW` holds the private bearer credential expected by the Worker admin routes; `VERTEX_SA_KEY` must contain the complete service-account JSON used to authenticate Vertex AI; `GCP_NL_API_KEY` must likewise contain a complete service-account JSON, for the separate Natural Language moderation path — grant that account `roles/serviceusage.serviceUsageConsumer` and enable `language.googleapis.com` on its project; `RESEND_API_KEY` and `TURNSTILE_SECRET_KEY` hold their respective service credentials.

Set the non-secret `VERTEX_PROJECT` Wrangler variable to your Google Cloud project ID; set `VERTEX_LOCATION` as well if you are not using the default `global` location. The worker does not infer either value from `VERTEX_SA_KEY`.

### 5. Deploy

The Turnstile site key is public, but Vite still needs it at build time. Replace `your-public-site-key` below with the site key created for your fork.

Wrangler bundles the Worker during `deploy`; the Worker package has no separate `build` script.

```bash
cd mainsite-worker
npx wrangler deploy
cd ..

cd mainsite-frontend
VITE_TURNSTILE_SITE_KEY="your-public-site-key" npm run build
npx wrangler pages deploy dist --project-name=mainsite-frontend
cd ..
```

## CI deploy (this repo)

This repo's [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main`:

1. `npm ci` + `npm audit --audit-level=high` for both sub-apps (a report with a high or critical finding stops the deploy; when the advisory request to the npm registry fails, the step warns and the deploy continues on the native coverage; any other npm error stops the deploy).
2. `lint`, Biome and tests for both, plus the frontend build.
3. The official Cloudflare Wrangler Action deploys the Worker and the Pages frontend with the versioned D1 binding.

This web app uses its internal `APP_VERSION` values. This migration retires publication of GitHub Releases and version tags; legacy objects are removed only after the release workflow is absent from `main`.

## Repository conventions

- **License**: [AGPL-3.0-or-later](./LICENSE). Network-service trigger applies: running a modified fork as a public service obligates you to publish modifications.
- **Notices**: see [NOTICE](./NOTICE) and [THIRDPARTY](./THIRDPARTY.md).
- **Security disclosure**: see [SECURITY.md](./SECURITY.md).
- **Code of conduct**: see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md).
- **Contributing**: see [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Sponsorship**: see the repo's `Sponsor` button or [central sponsor page](https://www.lcv.dev/sponsor).
- **Action pinning**: all GitHub Actions are pinned by full SHA per supply-chain hardening baseline.
- **Code owners**: [.github/CODEOWNERS](.github/CODEOWNERS).

## Links

- Site: [https://mainsite-app.lcv.dev](https://mainsite-app.lcv.dev)
- GitHub: [https://github.com/LCV-Ideas-Software/mainsite-app](https://github.com/LCV-Ideas-Software/mainsite-app)
- Sponsors: [https://github.com/sponsors/LCV-Ideas-Software](https://github.com/sponsors/LCV-Ideas-Software)

## License

AGPL-3.0-or-later. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [THIRDPARTY](./THIRDPARTY.md).

---

<p align="center"><span style="font-size: 1.5em;"><strong>Copyright © 2026 LCV Ideas &amp; Software</strong></span><br><sub>LEONARDO CARDOZO VARGAS TECNOLOGIA DA INFORMACAO LTDA<br>Rua Pais Leme, 215 Conj 1713 - Pinheiros<br>São Paulo - SP - CEP 05424-150<br>CNPJ: 66.584.678/0001-77 - IM: 3039854</sub></p>
