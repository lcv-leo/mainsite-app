# Changelog — MainSite App

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
