# Changelog — Mainsite Admin

## [v03.46.00] — 26/03/2026
### Adicionado
- **IA: Instrução Livre (Gemini Freeform)**: novo botão ✨ (Wand2) no final da toolbar. Abre popover glassmorphic com textarea para instrução em linguagem natural. Gemini recebe o texto selecionado (ou todo o conteúdo se não houver seleção) e executa a instrução como um copilot Word-class com preservação HTML. Enter envia, Escape fecha.
- **Worker — ação `freeform`**: `POST /api/ai/transform` agora aceita `action: 'freeform'` + `instruction`, reutilizando toda a infra existente (token counting, retry, safety, logging). System prompt instrui o modelo a retornar apenas texto transformado sem explicações.


### Corrigido
- **Toolbar — botões não reagiam ao clique**: `MenuBar` não re-renderizava quando o estado do editor mudava (ex.: toggling Bold). Adicionado `editor.on('transaction')` com forceUpdate para que `getActiveStyle(editor.isActive(...))` leia valores atualizados a cada transação
- **BubbleMenu — `window` errado no PopupPortal**: `window.innerWidth` e `document.createRange()` referenciavam a janela principal, não o popup. Substituídos por `editor.view.dom.ownerDocument.defaultView` e `ownerDocument.createRange()`
- **FloatingMenu — posição viciada durante scroll**: adicionado listener de scroll no tiptap-wrapper que esconde o menu durante rolagem, evitando posição estática residual
### Corrigido
- **Toolbar — botões sem mudança de estado no PopupPortal**: `toolbarBtn.background` e `getActiveStyle` usavam CSS custom properties (`var(--tb-*)`) que não resolviam na janela popup (domínio separado). Substituídos por valores diretos computados a partir de `isDarkBase`/`activePalette`
- **BubbleMenu cortado sob a toolbar**: posicionamento mudou de `position: absolute` (relativo ao tiptap-wrapper com `overflow-y: auto` que clipava) para `position: fixed` com coordenadas de viewport + clamping + flip-below automático quando não há espaço acima
- **FloatingMenu deslocado**: mesma migração para `position: fixed` com coordenadas de viewport
- **Botão SALVAR**: texto alterado de "CONSOLIDAR FRAGMENTO"/"ATUALIZAR FRAGMENTO" para "SALVAR"

## [v03.45.00] — 26/03/2026
### Alterado
- **Toolbar Word-like 3D**: botões da toolbar principal, BubbleMenu e FloatingMenu ganham aparência 3D com sombra outward (raised) no estado padrão e sombra inset (depressed) + cor accent no estado ativo/toggled. Feedback visual claro de `:active` e `:hover`. CSS custom properties `--tb-idle-bg`, `--tb-active-bg`, `--tb-active-fg` controlam o tema
- **Highlighter unificado**: botão Marca-texto migrado para o mesmo sistema `getActiveStyle`, com accent amarelo quando ativo

## [v03.44.00] — 26/03/2026
### Adicionado
- **Editor em popup nativo do SO**: `PopupPortal.jsx` abre editor em janela separada via `window.open()` + `ReactDOM.createPortal`. Auto-sizing ~92% da tela, cópia de stylesheets, monitoramento de close via polling
- **Botões Fechar/Limpar no popup**: "Fechar" (X vermelho) fecha a janela, "Limpar" (borracha) reseta título e conteúdo do editor
- **Recuo de primeira linha (text-indent)**: extensão customizada TipTap com 4 níveis (0 / 1.5rem / 2.5rem / 3.5rem). Botões de indent/outdent na toolbar com tooltips
- **Diálogos do editor em portal**: `promptModal` (imagem URL, link, legenda, YouTube) agora renderiza via `ReactDOM.createPortal(document.body)` para centralização perfeita na viewport
- **Botões scroll-to-top/bottom**: FABs flutuantes com glassmorphism no canto inferior direito, com exibição condicional baseada na posição de scroll (mesmo padrão do frontend)
- **Scroll independente na área de edição**: toolbar e controles ficam fixos no topo do popup enquanto apenas o conteúdo do editor rola, via cadeia flex com `overflow:hidden` + `min-height:0`
- **Datas completas no PostList**: formato "Publicado em dd/mm/aaaa, hh:mm:ss | Atualizado em dd/mm/aaaa, hh:mm:ss" com exibição condicional

### Corrigido
- **ProseMirror CSS white-space**: adicionada regra `.ProseMirror { white-space: pre-wrap }` no `index.css` para suprimir warning de console

## [v03.43.00] — 26/03/2026
### Adicionado
- **Seção "Configurações Globais" expandida** de 3 para 11 controles: família da fonte (com Inter recomendada), tamanhos de fonte, peso corpo/títulos, altura de linha (range slider com labels), alinhamento do texto, recuo de parágrafo, espaçamento, largura de leitura, cor dos links

## [v03.42.00] — 26/03/2026
### Adicionado
- **Tipografia Inter** (Google Fonts) como fonte primária, alinhamento visual com tiptap.dev

## [v03.41.00] — 26/03/2026
### Corrigido
- **Todas as chamadas `/api/*` falhavam com 405**: Admin não tinha Service Binding nem proxy para o Worker. Criado `functions/api/[[path]].js` + binding `WORKER` → `mainsite-app`
- **Brand icons usavam URL externa**: `.env` apontava para `https://mainsite-app.lcv.rio.br/...`. Corrigido para rota relativa `/api/uploads/brands`

### Adicionado
- **[NEW]** `functions/api/[[path]].js` — Catch-all proxy via Service Binding interno
- Service Binding `WORKER` → `mainsite-app` no `wrangler.json`

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
