# Contributing to mainsite-app

Thanks for your interest. Quick guide for filing issues and opening pull requests.

This repo hosts two independent deploys that share a D1 database (`bigdata_db`):
- **`mainsite-frontend`** — public React 19 + Vite Pages site at `reflexosdaalma.blog` (+ secondary domains).
- **`mainsite-worker`** — Cloudflare Worker backend serving `/api/*`.

---

## Before you start

1. **Read the [README](./README.md)** — public app, dual-deploy architecture, AGPL §13 source-offer for fork operators.
2. **Read [SECURITY.md](./SECURITY.md)** — for security reports, do NOT open a public issue. Note the architectural decision recorded there: content protection is **attribution-based, not bloqueio-based**; do not propose hostile copy/devtools/PrintScreen blockers without empirical evidence they don't break accessibility.
3. **Check existing issues** before opening a new one.

---

## Filing issues

- **Bug reports**: include URL hit, expected vs actual behavior, and (if applicable) browser console / Worker logs / D1 query traces.
- **Feature requests**: explain the use case. Public-facing surface (post rendering, comments, ratings, share-by-email, donation flow, AI chat) needs careful UX consideration.
- **Documentation gaps**: open an issue or a PR directly.

---

## Opening a pull request

### Local gates

For the frontend:

```bash
cd mainsite-frontend
npm ci
npm run lint
npm test
npm run build
```

For the worker:

```bash
cd mainsite-worker
npm ci
npm run lint
npm test
npx wrangler deploy --dry-run
```

All gates must be GREEN. CI re-runs these on push.

### PR description

Include what changed, why, and how you tested. Public surface changes (route shapes, schema, JSON-LD, OG/Twitter cards, payment widget integration) need careful review.

### Action pinning

This repo enforces SHA-pinned GitHub Actions. Don't downgrade to floating tags. Dependabot opens version-bump PRs with new SHAs + tag comments.

### `public/_headers` is untouchable

The `mainsite-frontend/public/_headers` file is required by SumUp / Mercado Pago Payment Widget and MUST NOT be modified without operator authorization. Any code path that mutates it at build/deploy time should be rejected.

### D1 schema changes

D1 is shared between this repo (`mainsite-frontend` Pages Functions + `mainsite-worker`) and `admin-app` (admin-motor handlers write to `mainsite_*` tables). Schema changes need cross-repo coordination.

### Versioning

`APP_VERSION` lives in `mainsite-frontend/src/App.tsx` and `mainsite-worker/src/index.ts`. Bump per workspace policy: patch for fixes, minor for features, major for breaking changes. CHANGELOG.md entry required.

---

## License

By contributing, you agree your contribution is licensed under [AGPL-3.0-or-later](./LICENSE). AGPL §13 applies to network-service operators of forks.

---

## Code of Conduct

By participating, you agree to follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) (Contributor Covenant 2.1). Violations to `alert@lcvmail.com`.

---

## Maintainer

Single maintainer: [@lcv-leo](https://github.com/lcv-leo). Response time best-effort.
