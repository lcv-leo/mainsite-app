# Changelog — MainSite App

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
