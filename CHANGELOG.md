# Changelog — MainSite App

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
