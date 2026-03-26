# Changelog — Mainsite Admin

## [v03.40.00] — 26/03/2026
### Adicionado
- BubbleMenu customizado: barra de formatação contextual ao selecionar texto (negrito, itálico, sublinhado, tachado, marca-texto, sub/sobrescrito, código inline, link)
- FloatingMenu customizado: barra de inserção rápida em linhas vazias (títulos H1-H3, listas, tarefas, citação, código, tabela, linha horizontal)
- Extensão Focus: destaque visual do nó com foco ativo (`.has-focus`)
- CSS glassmorphism para BubbleMenu e FloatingMenu compatível com modo claro/escuro

### Alterado
- TipTap atualizado de v3.20.1 para v3.20.5 (43 pacotes)
- `tiptapWrapper` recebeu `position: relative` para ancoragem correta dos menus
- BubbleMenu e FloatingMenu implementados como React puro (TipTap v3 removeu componentes React)

## [v03.39.00] — 26/03/2026
### Adicionado
- Conformidade WCAG 2.1 AA + eMAG
- Toast com `role="alert"` e `aria-live="assertive"`
- Modal de exclusão com `role="dialog"`, `aria-modal`, `aria-labelledby`
- Loading state com `role="status"` e sr-only label
- `aria-label` nos botões icon-only do header (tema, sync)
- `aria-label` contextual nos botões de ação do PostList (fixar, editar, excluir)
- `aria-roledescription` em itens arrastáveis
- Classe CSS `.sr-only`, `:focus-visible` estendido, `prefers-reduced-motion`

## [v03.38.00] — 26/03/2026
### Alterado
- Eliminação de todas as URLs externas (`https://mainsite-app.lcv.rio.br`) na comunicação intra-app
- `API_URL` convertido de URL externa para rota relativa `/api`
- Brand icons fallback convertido para `/api/uploads/brands` (interno)

### Infra
- Consolidação do versionamento para `APP v03.38.00`

## [v03.37.00] — 2026-03-24
### Alterado
- Migração de binding D1 para `bigdata_db` no `wrangler.json`, mantendo binding lógico `DB`

### Infra
- Consolidação do versionamento para `APP v03.37.00` + `package.json` 3.37.0

## [v03.36.00] — 2026-03-22
### Alterado
- Padronização do sistema de versão para formato APP v00.00.00
- Cabeçalho de código atualizado (Versão padronizada)

## [v03.36.00] — Anterior
### Histórico
- Monólito consolidado com Painel Financeiro, exclusão mútua de abas, Glassmorphism + Material Design 3
