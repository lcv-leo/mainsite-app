# mainsite-app

[![status: stable](https://img.shields.io/badge/status-stable-brightgreen.svg)](#status)
[![runtime: Cloudflare Pages + Workers](https://img.shields.io/badge/runtime-Cloudflare%20Pages%20%2B%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![framework: React 19 + Vite 8](https://img.shields.io/badge/framework-React%2019%20%2B%20Vite%208-61dafb.svg)](https://react.dev/)
[![backend: Hono on Workers](https://img.shields.io/badge/backend-Hono%20on%20Workers-f97316.svg)](https://hono.dev/)
[![license: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](./LICENSE)

**Reflexos da Alma** — public personal blog + companion services. Two independent Cloudflare deploys served from this monorepo, both reading from a shared Cloudflare D1 database (`bigdata_db`):

- **`mainsite-frontend`** — React 19 + Vite 8 single-page app on Cloudflare Pages, primary domain `reflexosdaalma.blog` (+ secondary aliases). Public-facing site with reading experience, comments, ratings, AI chatbot, share-by-email, donations (SumUp + PIX), and accessibility-first design.
- **`mainsite-worker`** — Hono backend on Cloudflare Workers serving `/api/*` for the frontend. AI surfaces (Gemini), payment surfaces (SumUp), moderation (GCP Natural Language API + Turnstile), email relay (Resend), R2 media.

## What it does

Public-facing artifact + edge-deployed APIs:

1. **Reading experience** — `PostReader` with smart polling (`useContentSync` + `ContentUpdateToast`) for live updates, JSON-LD + OG/Twitter Card SEO metadata, attribution-based clipboard handling (intentionally NOT a hostile copy-blocker — see [SECURITY.md](./SECURITY.md) ADR), reading-progress accessibility hooks.
2. **Comments + ratings** — Turnstile-gated public submission, GCP NL sentiment-aware moderation pipeline, threaded replies, idempotent rating accumulation.
3. **AI public chatbot (`/api/ai/public/chat`)** — Gemini-powered helper with content-aware context grounded on published posts. Hard caps: per-IP rate limit + global hourly budget cap (default-on).
4. **Share-by-email + contact** — Turnstile-gated, Resend-relayed, canonical-link-validated, recipient-window-capped (5/recipient/24h).
5. **Donations / PIX** — SumUp Payment Widget integration (cartão + PIX + APMs unified), legacy `/pay` `/pix` endpoints return `410 Gone` deterministically.
6. **Theme system** — `/api/theme.css` same-origin, generated from D1 settings to keep CSP strict.
7. **R2 media + uploads** — `image/jpeg|png|gif|webp|avif|pdf` allowlisted with magic-byte sniffing, 10 MB cap, SVG explicitly blocked (legacy SVGs served sandboxed with `Content-Security-Policy: sandbox`).
8. **Pages Functions** — server-side rendering for deep links (HTMLRewriter-injected OG/JSON-LD), `/autor/:slug` SSR, sitemap + feed honoring publishing mode.

## Architecture

```
Browser
  ├──→ Cloudflare Pages: mainsite-frontend (React 19 + Vite 8)
  │      └─ public/_headers: SumUp/MP Payment Widget CSP (UNTOUCHABLE)
  │      └─ functions/[[path]].ts: SSR for /, /p/:id, /autor/:slug, /sitemap.xml, /feed.xml
  │      └─ /api/* → Service Binding → mainsite-worker
  │
  └──→ Cloudflare Worker: mainsite-worker (Hono)
        ├─ public surface: posts, comments, ratings, AI chat, contact, share-email,
        │  payments, theme.css, content-fingerprint, uploads
        ├─ admin surface (CF-Access JWT or bearer): post CRUD, settings, moderation,
        │  share-email logs
        └──→ D1 (bigdata_db) + R2 (mainsite-media) + Workers AI + Gemini API
```

Public-flip prep: D1 ID lives in CI as a GitHub Actions secret; both `wrangler.json` files carry a nil-UUID placeholder (`00000000-0000-0000-0000-000000000000`) replaced by `jq` injection at deploy time.

## Deploy your own fork

You will need:
- A Cloudflare account ([free tier](https://www.cloudflare.com/plans/)) with Pages + Workers + D1 + R2 enabled.
- The Cloudflare CLI [`wrangler`](https://developers.cloudflare.com/workers/wrangler/).
- Node.js 24+.
- Google AI Studio API key (Gemini integration).
- SumUp Business account API key (donations).
- Resend API key (transactional email).
- Cloudflare Turnstile site key + secret (form anti-abuse).
- (Optional) GCP Service Account with Cloud Natural Language API access (comment moderation).

### 1. Clone + install

```bash
git clone https://github.com/lcv-leo/mainsite-app.git
cd mainsite-app
cd mainsite-frontend && npm ci && cd ..
cd mainsite-worker && npm ci && cd ..
```

### 2. Create D1 database + R2 bucket

```bash
npx wrangler d1 create bigdata_db
# wrangler outputs:
#   database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
npx wrangler r2 bucket create mainsite-media
```

### 3. Wire `database_id` into both `wrangler.json`

Replace `00000000-0000-0000-0000-000000000000` in:
- `mainsite-frontend/wrangler.json` (Pages app)
- `mainsite-worker/wrangler.json` (Worker)

### 4. Configure Cloudflare Secrets Store secrets

Per `mainsite-worker/wrangler.json`'s `secrets_store_secrets` list, set values for the keys you intend to use (Gemini, Resend, SumUp Private/Merchant, PIX_KEY/NAME/CITY, Turnstile, etc.). `GCP_NL_API_KEY` (Service Account JSON, >1024 chars) cannot live in Secrets Store and must be a native Worker secret:

```bash
npx wrangler secret put GCP_NL_API_KEY --config mainsite-worker/wrangler.json
```

### 5. Deploy

```bash
cd mainsite-worker
npm run build
npx wrangler deploy
cd ..

cd mainsite-frontend
npm run build
npx wrangler pages deploy dist --project-name=mainsite-frontend
cd ..
```

## CI deploy (this repo)

This repo's [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main`:

1. `npm ci` + `npm audit --audit-level=high` for both sub-apps.
2. `lint` + `test` for both.
3. `jq` substitution of D1 ID from secret into both `wrangler.json` files.
4. `npm run build` (frontend).
5. `wrangler deploy` for the worker, `wrangler pages deploy` for the frontend.

## Repository conventions

- **License**: [AGPL-3.0-or-later](./LICENSE). Network-service trigger applies — running a modified fork as a public service obligates you to publish modifications. See AGPL §13 source-offer below.
- **Security disclosure**: see [SECURITY.md](./SECURITY.md). Note the Architectural Decision recorded there: content protection is **attribution-based**, not blocking-based.
- **Contributing**: see [CONTRIBUTING.md](./CONTRIBUTING.md). PRs require GREEN gates locally for both sub-apps + SHA-pinned actions + `public/_headers` is untouchable.
- **Code of Conduct**: see [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Contributor Covenant 2.1.
- **Changelog**: [CHANGELOG.md](./CHANGELOG.md).
- **Sponsorship**: see the repo's `Sponsor` button or [.github/FUNDING.yml](./.github/FUNDING.yml).
- **Code owners**: [.github/CODEOWNERS](./.github/CODEOWNERS).
- **Action pinning**: all GitHub Actions are pinned by full SHA (supply-chain hardening baseline).

## License

Copyright (C) 2026 Leonardo Cardozo Vargas.

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY. See the GNU Affero General Public License for more details. The full license text is at [LICENSE](./LICENSE).

### AGPL §13 source-offer (operators of public deployments)

If you operate a modified copy of this app as a publicly-accessible network service, AGPL-3.0 §13 obligates you to make the corresponding source code available to your remote users. Comply via:

- A "Source" link in the app's footer pointing to your fork's repository URL (`mainsite-frontend/src/components/ComplianceBanner.tsx`).
- A `GET /source` route in `mainsite-worker` returning your fork's URL as `text/plain`.

If you only deploy this app for your own infrastructure (no external users), §13 does not apply.
