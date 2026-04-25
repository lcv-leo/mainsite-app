# Changelog — Mainsite Worker (Backend)

## [v02.16.00] - 2026-04-25
### Segurança
- Uploads deixam de aceitar SVG novo; SVGs legados servidos por R2 recebem `Content-Security-Policy: sandbox` e `X-Content-Type-Options: nosniff`.
- Validação de origem CORS agora exige protocolo HTTPS antes de aceitar uma origem allowlisted.
- Comparação de bearer token trocada para implementação constante e portável, sem depender de APIs não padronizadas do runtime Workers.
- Headers próprios de `Cache-Control` removidos das rotas públicas e administrativas do worker, mantendo cache sob controle nativo da Cloudflare.
### Adicionado
- Testes de regressão para HTTPS obrigatório em origens CORS e para bloqueio/sandbox de SVG em uploads.
### Alterado
- Dependências atualizadas durante a auditoria coordenada com `admin-app`; `WRANGLER_VERSION: "latest"` preservado no workflow do repositório por requisito operacional.
### Validação
- `npm run lint`.
- `npm test` — 8 arquivos / 20 testes.
- `npx --no-install wrangler deploy --dry-run`.
- `npm audit --audit-level=moderate` — 0 vulnerabilidades.
- `npm outdated --json` — sem pacotes pendentes.

## [v02.15.00] - 2026-04-24
### Adicionado
- **Endpoint público `GET /api/about`** ([`src/routes/about.ts`](src/routes/about.ts)): lê o singleton `mainsite_about` no D1 e retorna `{ about }`, com `about: null` quando a tabela ou o registro ainda não existem.
- **Testes de contrato** ([`src/routes/about.test.ts`](src/routes/about.test.ts)): cobrem tabela vazia, tabela ausente e normalização do conteúdo institucional.
### Alterado
- O worker agora expõe o conteúdo "Sobre Este Site" fora do fluxo de posts, sem consultar `mainsite_posts` e sem depender da rotação/editorial dos textos públicos.
### Validação
- `npm test` — 6 arquivos / 15 testes passando.
- `npm run lint` — sem problemas.
- `npx tsc --noEmit` — sem erros.
### Motivação
- Disponibilizar o conteúdo institucional persistido em `mainsite_about` para o frontend público com comportamento fail-empty, conforme exigido: link funcional e tela vazia quando ainda não houver conteúdo configurado.

## [v02.14.02] - 2026-04-22
### Corrigido
- **`GET /api/settings/disclaimers` — fecha P3 residual apontado no 2º parecer ChatGPT Codex 2026-04-22**: o filtro endurecido em v02.14.01 descartava `null`, primitivos, arrays e `id` inválido, mas ainda permitia que um item parcialmente corrompido com `id` válido mas **sem** `text`/`title`/`buttonText` atravessasse. Como `DisclaimerModal.tsx:176` chama `disclaimer.text.split(...)` (+ usa `item.title` como heading e `item.buttonText` como label do botão), esse shape parcial crasharia o frontend ao tentar renderizar. Agora o type-predicate exige `typeof item.title === 'string'`, `typeof item.text === 'string'`, `typeof item.buttonText === 'string'` — só itens com shape completamente renderizável saem do worker. Ausência ou tipo errado em qualquer um desses três campos → item descartado silenciosamente (fail-safe coerente com o tratamento da raiz corrompida). `isDonationTrigger` permanece opcional (usado como ternário, `undefined` é safe).
### Alterado
- **Teste existente** `it('descarta itens que não são objetos com id string válido')` atualizado: os itens válidos no cenário agora carregam shape completo (`{ id, title, text, buttonText }`) para refletir os novos requisitos — caso contrário seriam corretamente descartados pelo novo filtro e invalidariam a asserção.
- **Novo teste** `it('descarta itens com shape parcialmente corrompido (sem text/title/buttonText)')` cobre 6 cenários de corrupção parcial: `text` ausente, `title` ausente, `buttonText` ausente, `text` não-string (number), `buttonText` null. Worker subiu de 11 → 12 testes passando.
### Motivação
- Segundo parecer ChatGPT Codex 2026-04-22 detectou corretamente que o hardening de v02.14.01 tinha lacuna real: teste `it('descarta itens que não são objetos com id string válido')` incluía `{ id: 'valid', title: 'ok' }` como caso que passava — mas esse shape quebraria o `DisclaimerModal` em runtime. A correção fecha esse gap antes do Commit & Sync e eleva o filtro ao mesmo padrão de "shape completamente renderizável" que o componente público espera.

## [v02.14.01] - 2026-04-22
### Corrigido
- **`GET /api/settings/disclaimers` — hardening de payload corrompido** (achado P3 do parecer ChatGPT Codex 2026-04-22): v02.14.00 assumia que o `JSON.parse(record.payload)` sempre retornava um objeto. Payloads patológicos gravados no D1 (`null`, array, primitivo) faziam `parsed.enabled` lançar `TypeError` e o handler caía em erro 500. Pior, `items: [null]` atravessava o filtro original (`item?.enabled !== false` é `true` para `null`) e chegava ao frontend, onde `item.id` crasharia o render. Corrigido com dois guards: (1) novo helper `isPlainObject` valida a raiz — se não for objeto não-array não-null, retorna `{ enabled: true, items: [] }` (fail-safe); (2) filtro de `items` agora é type-narrowing: só passa item que é objeto não-nulo com `id` string não-vazio E `enabled !== false`. Resposta a payload malformado vira resposta vazia em vez de 500 ou crash do cliente.
### Adicionado
- **Suíte de testes** [`src/routes/settings.test.ts`](src/routes/settings.test.ts) cobrindo `/api/settings/disclaimers`: (1) filtro de item com `enabled: false`, (2) preservação de `config.enabled === false` como kill switch global, (3) fallback de seed default quando registro não existe, (4) fail-safe para payloads corrompidos (`null`, string, número, array), (5) descarte de items sem `id` válido. 5 novos testes; suíte do worker subiu de 6 → 11 passando.
### Motivação
- Parecer ChatGPT Codex 2026-04-22 apontou corretamente que o hardening de v02.14.00 não era tão completo quanto o relatório sugeria. Correção fecha a brecha antes do Commit & Sync, sem depender do caminho de gravação (que o admin-motor já valida) para garantir sanidade da leitura.

## [v02.14.00] - 2026-04-22
### Alterado
- **`GET /api/settings/disclaimers`** ([`src/routes/settings.ts`](src/routes/settings.ts)): passou a filtrar no servidor os disclaimers marcados como `enabled === false`, impedindo que cheguem ao frontend público. Política de precedência: disclaimer visível ⇔ `config.enabled !== false` AND `item.enabled !== false`. Campos ausentes ou `undefined` em `config.enabled` / `item.enabled` equivalem a `true` (retrocompat com payloads antigos sem a flag — nenhuma migração de dados necessária). Admin continua vendo todos os itens via `GET /api/mainsite/settings` (`admin-motor`) porque esse handler usa `safeParseObject` que preserva o payload bruto.
- **Seed default de fallback** (disclaimer criado inline quando `mainsite_settings.id='mainsite/disclaimers'` não existe no D1) agora inclui `enabled: true` explicitamente, alinhado à convenção de novos itens.
### Motivação
- **Hardening server-side do soft-disable individual introduzido em admin-app v01.93.00**: implementar o filtro no worker em vez de delegar ao frontend garante que (1) disclaimers desativados nunca saem da borda, mesmo se um bug no cliente falhar no filtro; (2) resposta de `/api/settings/disclaimers` fica enxuta (um admin pode deixar dezenas de avisos arquivados sem impacto em payload/latência); (3) semântica fica consistente com o kill switch de publicação (v02.13.00), onde o worker também é a fronteira autoritativa. O endpoint público não sofre regressão para clients que ainda não conheçam a flag: eles recebem a lista já filtrada e seguem operando normalmente.

## [v02.13.00] - 2026-04-21
### Adicionado
- **Kill switch de publicação com gating coordenado em todas as rotas públicas que leem posts ou conteúdo derivado**: novo helper centralizado [`src/lib/publishing.ts`](src/lib/publishing.ts) expõe `readPublishingMode(db): 'normal'|'hidden'` e `readPublishing(db)` (mode + notice_title + notice_message). Política de precedência uniforme: texto público ⇔ `mode='normal'` AND `is_published=1`.
- **Endpoint `/api/site-status`** ([`src/routes/site-status.ts`](src/routes/site-status.ts)): consumido pelo frontend em cada ciclo de fetch. Retorna `{ mode, notice_title, notice_message }` com `Cache-Control: no-store` para propagação imediata do kill switch sem interferência de CDN. `notice_title`/`notice_message` são strippados novamente de HTML como defesa-em-profundidade (admin-motor já faz o strip na gravação; worker refaz na leitura).
### Alterado
- **`/api/posts` e `/api/posts/:id`** ([`src/routes/posts.ts`](src/routes/posts.ts)): consulta `readPublishingMode` antes de responder. Em modo hidden, lista retorna `[]` e detalhe retorna `404` (fecha deep-link de URLs tipo `/p/42` salvas em bookmarks). Em modo normal, SELECTs agora têm `WHERE is_published = 1` — vazamento de texto oculto via listagem ou link direto é impossível por qualquer caminho.
- **`/api/comments/:postId` (GET lista)**, **`/api/comments/:postId/count`** e **`POST /api/comments`** ([`src/routes/comments.ts`](src/routes/comments.ts)): novo helper `isPostPublicallyVisible(db, postId)` combina mode+is_published. GETs públicos retornam `[]`/`0` para posts ocultos (evita vazamento de existência do post via quantitativo de comentários). POST retorna 404 — não aceita novo comentário em post oculto. Endpoints admin (`requireAuth`) permanecem intactos para moderação.
- **`/api/ratings` (POST)** e **`/api/ratings/:postId` (GET)** ([`src/routes/ratings.ts`](src/routes/ratings.ts)): mesmo padrão de gate via `isPostPublicallyVisible`. GET retorna objeto zerado (`avgRating: 0, totalVotes: 0, ...`) para post oculto; POST retorna 404.
- **`/api/ai/public/chat`** ([`src/routes/ai.ts`](src/routes/ai.ts)): em modo hidden, contexto do chatbot fica vazio (o retrieval pula completamente a consulta a `mainsite_posts`). Em modo normal, consulta já filtra por `is_published = 1` — chatbot nunca cita texto oculto.
- **`/api/share/email`** ([`src/routes/contact.ts`](src/routes/contact.ts)): gate antes de resolver o post, SELECT passa a exigir `is_published = 1`. Compartilhamento por e-mail não pode mais ser usado para propagar link de texto oculto.
- **`lib/content-version.ts`**: `getContentFingerprint` respeita kill switch — `headline_post_id` é `null` em modo hidden e filtrado por `is_published = 1` em modo normal. Frontend que consome `/api/content-fingerprint` nunca vê ID de post oculto.
- **Cron de rotação** ([`src/index.ts` scheduled handler](src/index.ts)): em modo hidden, rotação não roda (early return). Em modo normal, rotaciona apenas `is_published = 1` — posts ocultos ficam fora do ciclo até serem reativados, preservando `display_order` dos visíveis.
### Motivação
- **Kill switch editorial para todos os caminhos de acesso aos textos**: permitir ao admin suspender a exibição de todos os textos (ou de um texto específico) sem afetar outras áreas do site (contato, doação, tema, rodapé institucional). O escopo do gate foi auditado contra todas as 7 rotas que tocam `mainsite_posts` ou `mainsite_post_ai_summaries`, incluindo crawlers potenciais (OG via meta-tags do React continua existindo mas JSON-LD no `PostReader` é omitido em modo hidden — ver mainsite-frontend v03.18.00). `post-summaries.ts` não precisou gate porque todos os endpoints já são `requireAuth` (admin-only).

## [v02.12.00] - 2026-04-20
### Alterado
- **`systemPrompt` do chatbot "Consciência Auxiliar" reformulado integralmente ([`src/routes/ai.ts:234`](src/routes/ai.ts)) — +60 linhas, ~7.3 KB**: substituição do bloco de diretrizes por uma versão estruturada em 11 seções nomeadas, mantendo intactas as 5 variáveis de template (`${activeContextPrompt}`, `${donationPrompt}`, `${dbCoverageMeta}`, `${dbContext}`, `${safeMessage}`) e o pipeline de retrieval/scoring/auditoria/sanitização existente.
  - **IDIOMA** (novo): Português do Brasil como default, inglês/outra língua só mediante pedido explícito.
  - **IDENTIDADE** (reforçada): descrição explícita de não-substituição (não substitui leitura, terapeuta, diretor espiritual, autor); recusa de posição de guru/oráculo; papel é expandir debate, nunca fechar com conclusões.
  - **ÉTICA DE TOMÉ** (novo): postura investigativa no mesmo eixo do site; recusa de argumento de autoridade; ajuda o leitor a reformular perguntas mal feitas; arquétipo de Tomé (Jo 20,24-29) como discípulo que duvida com rigor.
  - **VERDADE ACIMA DE BAJULAÇÃO** (novo): proibição explícita de validar auto-percepções infladas ("você é iniciado avançado", "você tem dom especial", etc.); crítica respeitosa quando necessário; bajulação nunca.
  - **CUIDADO PSICOLÓGICO — PRINCÍPIO INTRANSPONÍVEL** (novo): proibição de reforçar complexos de superioridade/inferioridade, inflação de ego, identificações messiânicas, paranoia espiritual, delírios místicos; articulação obrigatória de luz/sombra em tradições esotéricas; recusa de dualismos simplificados (ego/Self, matéria/espírito, massa/iniciado); distinção wilberiana pré-pessoal/pessoal/transpessoal para evitar erro pré/trans (Wilber, _The Atman Project_, 1980).
  - **PROTOCOLO DE CRISE** (novo, crítico): se o usuário sinalizar ideação suicida, automutilação, crise psicótica aguda, dissociação severa, surto místico, ataque de pânico grave ou abuso, a prioridade absoluta passa a ser cuidado e direcionamento, não reflexão intelectual. Direcionamento explícito para CVV (188), SAMU 192, pronto-socorro psiquiátrico, pessoa de confiança, terreiro/diretor espiritual/psicólogo transpessoal/junguiano em crise espiritual sem risco iminente. Nomeação do limite da IA ("você não é capacitada para assistência em crise").
  - **ANTI-ALUCINAÇÃO** (novo): proibição explícita de inventar citações/trechos/versículos/URLs/volumes atribuídos a Jung, Bíblia, Umbanda Esotérica, Matta e Silva, Bashar, Saint Germain ou qualquer fonte. Admitir limite ("não tenho a referência precisa em mãos") é preferível a adivinhar.
  - **CITAÇÃO CANÔNICA** (novo): Bíblia via livro/capítulo/versículo (Mt 7,3-5; Jo 20,24-29; Fp 2,12); Jung via Collected Works com volume (Aion CW 9/2; Psicologia e Alquimia CW 12; Sincronicidade CW 8); Platão/Stephanus, Aristóteles/Bekker, Agostinho, Kant/Akademie, Freud/SE. Nunca colar URL na citação.
  - **SEPARAÇÃO DE CAMPOS** (novo): temas técnicos (programação/engenharia/matemática/TI) respondidos 100% tecnicamente, sem misturar Jung/Umbanda/espiritualidade; temas espirituais/filosóficos/psicológicos podem articular interdisciplinarmente mas sem jargão técnico deslocado.
  - **IMPESSOALIDADE** (reforçada): não falar em nome do autor; não atribuir opiniões/experiências/práticas que não estejam explicitamente nos textos.
  - **HIERARQUIA DE FONTES** (reescrita): contexto ativo (texto aberto pelo leitor) como base primária quando houver; textos gerais do site como base secundária; recusa de extrapolação para fora do acervo ("o site ainda não abordou este ponto").
  - **ENCAMINHAMENTO HUMANO** (preservada): orientar uso do formulário público de contato; nunca simular envio de e-mail/mensagens; nunca produzir comandos ocultos de automação. Injeção opcional de `${donationPrompt}` mantida.
  - **FORMA DA RESPOSTA** (nova): densidade proporcional à pergunta; vocação inaugural (abrir investigação, não fechar com síntese que dispensa leitura); citar título do texto de origem; PT-BR formal, sem clichês de autoajuda, sem emojis, sem exclamações efusivas.
### Adicionado
- **`biome.json`**: `files.includes` explícito e scan limpo após auto-fix global (`npx biome check src --write --unsafe`): 39 errors → 0, 6 warnings → 6, 3 infos → 3 no scope do worker. Principal ganho: imports reorganizados em 13 arquivos de `routes/` e `lib/`.
### Operacional
- **Backup pré-substituição** salvo em [`backups/system-prompt-20260420-0636/`](../../backups/system-prompt-20260420-0636/) com cópia integral do `ai.ts` anterior e recortes `prompt-anterior.txt` + `prompt-novo.txt`.
- **Relatório** em [`relatorio-substituicao-system-prompt-20260420-0636.md`](../../relatorio-substituicao-system-prompt-20260420-0636.md).
### Motivação
- **Reformulação editorial do chatbot**: o prompt anterior (v02.11.00, ~20 linhas / 1.5 KB) cobria apenas identidade básica + RAG + gatilho de doação. O novo prompt (v02.12.00, ~65 linhas / 7.3 KB) honra o Protocolo Editorial Leonardo-Tomé v1.4 e introduz salvaguardas psicológicas críticas (cuidado psicológico intransponível, protocolo de crise com CVV 188, anti-bajulação, anti-alucinação, citação canônica, separação técnico/espiritual).
- **Tradeoff aceito**: ~5.8 KB a mais por chamada ao Gemini é preço aceitável pelo ganho em segurança psicológica e editorial. Cada conversa nova encharca o contexto com diretrizes de proteção ao leitor.
- **Validação manual obrigatória antes de publicar**: três cenários de risco precisam ser testados em preview — (a) pergunta normal sobre texto do site (verificar citação do TÍTULO + fundamentação no acervo); (b) pergunta enviesada com auto-percepção inflada (verificar anti-bajulação); (c) pergunta simulando crise psíquica (verificar acionamento de CVV/SAMU no Protocolo de Crise).

## [v02.11.01] - 2026-04-17
### Alterado
- `wrangler.json` passou a garantir `observability.traces.enabled = true` e reafirmou o baseline explícito de logs e invocation logs, preservando o sampling já existente.
### Motivação
- Fechar a padronização de traces e logs do Cloudflare no `mainsite-worker` sem regredir a configuração já publicada.


## [v02.11.00] - 2026-04-17
### Adicionado
- **`/api/theme.css`**: nova folha de estilo same-origin gerada pelo worker a partir de `mainsite/appearance` no D1. O endpoint materializa variáveis CSS de tema/typography sem depender de `<style>` inline no frontend.
- **`lib/theme.ts` + `lib/theme.test.ts`**: utilitários e testes para serializar o tema do mainsite em CSS válido e seguro.
- **`lib/origins.ts`**: centralização da allowlist de origens públicas/operacionais do projeto para CORS e validações correlatas.
### Alterado
- **`lib/auth.ts`**: superfícies administrativas do `mainsite-worker` agora aceitam validação opcional por Cloudflare Access JWT (`iss`/`aud`/assinatura) quando configurada, reduzindo dependência exclusiva do bearer estático.
- **`routes/settings.ts` e `routes/uploads.ts`**: CORS deixou de ser genérico nessas rotas e passou a refletir apenas origens aprovadas do projeto, reduzindo exposição cross-origin desnecessária.
- **`routes/payments.ts`**: `POST /api/sumup/checkout` passou a criar checkouts com `redirect_url` para suportar corretamente APMs/PIX pelo widget oficial; os endpoints legados de processamento direto (`/pay`, `/pix`, return page manual) foram mantidos apenas como superfície de compatibilidade explícita com resposta `410`.
- **`env.ts`**: bindings opcionais de Cloudflare Access (`CF_ACCESS_TEAM_DOMAIN`, `CF_ACCESS_AUD`, `ENFORCE_JWT_VALIDATION`) formalizados para o endurecimento administrativo do worker.
### Corrigido
- **Fluxo legado de pagamento**: o backend deixou de incentivar caminhos manuais de cartão/PIX/3DS incompatíveis com o novo modelo do widget da SumUp.
- **CORS aberto em assets públicos**: uploads e brand assets não anunciam mais `Access-Control-Allow-Origin: *`; a entrega agora respeita a topologia real do projeto.

## [v02.10.02] - 2026-04-16
### Alterado
- **`TURNSTILE_SECRET_KEY`**: migrado para `Secrets Store` no `default_secrets_store` e reintroduzido em `secrets_store_secrets` no `wrangler.json`.

### Corrigido
- **Estratégia de secrets**: o `mainsite-worker` volta a usar `Secrets Store` apenas para o segredo curto do Turnstile, enquanto `GCP_NL_API_KEY` permanece fora do store por ser um JSON de Service Account grande demais para o limite de `1024` caracteres.

## [v02.10.01] - 2026-04-16
### Corrigido
- **Deploy GitHub Actions**: removidos `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` de `secrets_store_secrets` em `wrangler.json`. Os dois permanecem como Worker secrets nativos já existentes no runtime publicado, eliminando a falha `code: 10182` ao tentar resolver `turnstile-secret-key` em um Secrets Store inexistente para esse fluxo.

### Alterado
- **Bindings operacionais**: `AI` segue declarado explicitamente no `wrangler.json`, enquanto `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` voltam ao modelo operacional já validado em produção para o `mainsite-motor`.

## [v02.10.00] - 2026-04-16
### Adicionado
- **Sanitização parser-based**: `sanitize-html ^2.17.0` substitui o sanitizer regex anterior. `src/lib/sanitize.test.ts` cobre remoção de payloads executáveis e preservação de estruturas editoriais confiáveis.
- **Bindings operacionais explícitos**: `wrangler.json` agora declara `AI`, `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` de forma alinhada ao runtime publicado.
### Alterado
- **`/api/posts`**: a listagem pública passou a retornar apenas excertos, preservando o endpoint detalhado `/api/posts/:id` para leitura completa sob demanda.
- **`/api/contact`, `/api/comment` e `/api/share/email`**: rotas públicas agora exigem Turnstile de forma obrigatória e respondem 503/400/403 quando a proteção antiabuso não está íntegra.
- **`/api/comments`**: a profundidade real do thread agora é calculada no backend, `maxNestingDepth` é respeitado de ponta a ponta e a moderação falha fechada quando `GCP_NL_API_KEY` não está disponível.
- **`/api/ai/public/chat`**: removido o disparo de e-mails acionado por tags ocultas na saída do modelo; o chat agora orienta contato humano pelo formulário público e usa contexto reduzido/tratado ao montar o prompt.
### Corrigido
- **Sanitização de HTML**: substituído o filtro regex por allowlist com parser, reduzindo a superfície de bypass em conteúdo persistido no D1.
- **Relay de e-mail**: `/api/share/email` passou a validar Turnstile, URL canônica do post, existência do post no D1 e limite diário por destinatário.

## [v02.09.02] - 2026-04-16
### Alterado
- **hono**: `^4.12.9` → `^4.12.14`. A versão 4.12.14 corrige vulnerabilidade GHSA em `hono/jsx` (HTML injection em SSR; medium severity). O worker usa apenas REST routes, impacto real zero, mas fecha o alerta Dependabot #23.
- **Lockfile**: `package-lock.json` regenerado (rm -rf + npm install).
### Motivação
- Resolver alerta Dependabot + adotar patches recentes.
- Parte do plano de upgrade v2 (fase M2 worker).

## [v02.09.01] - 2026-04-12
### Adicionado
- **`routes/payments.ts`**: Rota pública `GET /api/sumup/fees` que retorna `{ sumupRate, sumupFixed }` lendo **direto do D1** (`mainsite_settings`/`mainsite/fees`) — sem o fallback defensivo de `loadFeeConfig()`. Se a configuração não existir ou o D1 estiver indisponível, retorna 503 para que o `DonationModal` desabilite a opção "Cobrir as taxas" em vez de exibir um preview baseado em valores incorretos. Sem auth (read-only de configuração já considerada pública pelo admin).

## [v02.09.00] - 2026-04-12
### Adicionado
- **`lib/indexnow.ts`**: Cliente IndexNow para notificar buscadores (Bing, Yandex, Seznam, Naver, Yep) quando um post é criado ou editado. Função `pingIndexNow(urlList)` faz POST para `https://api.indexnow.org/IndexNow`. Helper `postUrl(id)` constrói a URL canônica do post.
- **`routes/posts.ts`**: Hook fire-and-forget via `executionCtx.waitUntil(pingIndexNow(...))` no POST e PUT de posts. Zero impacto no response time. Falhas silenciosas.

### Notas de impacto
- Chave de validação IndexNow (`c8f3a7d6b2e9415d8f3c7a6b9e2d4f8c`) precisa estar acessível em `https://www.reflexosdaalma.blog/c8f3a7d6b2e9415d8f3c7a6b9e2d4f8c.txt` — arquivo provisionado em `mainsite-frontend/public/` na release v03.10.00.
- Re-indexação típica: 1-30 minutos no Bing, horas no Yandex.
- Sem ping no DELETE de post — buscadores tratam 404 organicamente no próximo crawl.

## [v02.08.00] - 2026-04-11
### Removido
- **payments-mp.ts**: Deletado. Todas as rotas MP removidas.
- **mercadopago**: Dependência removida do package.json
- **PIX nativo**: Rota /api/pix/generate removida (substituída por PIX via processador)
- **Headers.prototype.raw polyfill**: Removido (era exclusivo do SDK MP)
- **MERCADO_PAGO_WEBHOOK_SECRET**: Removido dos secrets
- **MP fee constants**: Removidos do financial.ts
- **validateMercadoPagoSignatureAsync**: Removida

### Alterado
- **payments-sumup.ts → payments.ts**: Renomeado sem referência a provedor

### Adicionado
- **PIX via processador**: POST /api/sumup/checkout/:id/pix com payment_type pix

## [v02.07.01] — 2026-04-11
### Alterado
- **Log prefix**: Todos os logs (structuredLog, Hono logger, console direto) agora prefixados com `[mainsite-motor]` para observabilidade unificada.

## [v02.07.00] — 2026-04-10
### Adicionado
- **Server-side HTML sanitization**: `sanitizePostHtml()` em `lib/sanitize.ts` — strip de tags perigosas (script, iframe, style), event handlers e javascript: URLs antes de armazenar no D1.
- **Orders API**: Migração de `Payment.create()` → `Order.create()` com `processing_mode: "automatic"`. Somente cartão de crédito, sem parcelamento.
- **Webhook Orders API**: HMAC validation atualizada com `x-request-id` e `data.id` lowercase conforme docs oficiais.
- **MERCADO_PAGO_WEBHOOK_SECRET**: Binding adicionado via Secrets Store.
- **items no order**: `title`, `description`, `category_id`, `quantity`, `unit_price`, `external_code` para compliance de qualidade MP.

### Alterado
- **Zod 3 → 4**: Upgrade de `zod ^3.23.0` para `^4.3.6`. Schemas compatíveis sem breaking changes.
- **Descrição de pagamento**: `Doação de {nome} - Reflexos da Alma` (consistente com SumUp).
- **Webhook age check removido**: Check de 5 minutos rejeitava retries legítimos do MP (a cada 15 min). HMAC validation é suficiente.

## [v02.06.00] — 2026-04-09
### Adicionado
- **Zod env validation**: `EnvSecretsSchema` adicionado a `src/lib/schemas.ts`. Middleware pós-resolução de secrets em `index.ts` valida todas as 12 variáveis e loga warn para as ausentes (não bloqueia deploy).
- **Hono logger**: `import { logger } from 'hono/logger'` + `app.use('*', logger())` — logs de request/response no stdout do Worker.
- **Hono timing**: `import { timing } from 'hono/timing'` + `app.use('*', timing())` — header `Server-Timing` em todas as respostas.
- **Biome linter**: Habilitado em `biome.json` com `recommended: true` (sem regras React; `noConsole` e `noExplicitAny` desligados).
- **Biome organizeImports**: Habilitado em `biome.json`.
- **Vitest UI**: `@vitest/ui ^4.1.2`; script `"test:ui": "vitest --ui"`.

## [v02.05.00] — 2026-04-09
### Adicionado
- **AppType export**: `export type AppType = typeof app` adicionado a `src/index.ts` para habilitar consumidores Hono RPC.
- **Script `npm run types`**: `wrangler types` adicionado ao `package.json` para gerar `worker-configuration.d.ts` a partir de `wrangler.json`.
- **Testes de rota Hono** (`vitest`):
  - `src/routes/ratings.test.ts`: GET `/api/ratings/abc` → 400 `Post ID inválido.`
  - `src/routes/comments.test.ts`: GET `/api/comments/config` com DB indisponível → 200 com defaults seguros
  - `vitest.config.ts`: ambiente `node`, include `src/**/*.test.ts`
  - `tsconfig.json`: `exclude` adicionado para `**/*.test.ts`

## [v02.04.02] — 2026-04-08
### Corrigido
- **NPM Audit Fix**: Atualizadas as versões de subdependências vulneráveis (hono, @hono/node-server) em virtude de alertas Moderate reportados pelo Dependabot para fechar riscos de directory traversal e proxy bypass.

## [v02.03.01] — 2026-04-07
### Adicionado
- **GCP NL API — Dual-Mode Auth (`moderation.ts`)**: Detecção automática do formato de credencial. Se `GCP_NL_API_KEY` contém JSON de Service Account, gera JWT via Web Crypto API e troca por access token OAuth2. Se é API Key simples (`AIzaSy...`), usa `?key=` na URL. Compatível com ambos os cenários sem configuração manual.
- **Error Logging — GCP NL API**: Response body agora logado em caso de erro HTTP, permitindo diagnóstico preciso (quota, API desabilitada, credencial inválida).

### Corrigido
- **Turnstile — Validação Estrita Restaurada**: Revertido o afrouxamento temporário da validação Turnstile. Comentários sem token são rejeitados com HTTP 400. Tokens inválidos são rejeitados com HTTP 403.

### Alterado
- **Secrets Store Cleanup (`wrangler.json`)**: Removidos `GCP_NL_API_KEY` e `TURNSTILE_SECRET_KEY` do `secrets_store_secrets` (excedem limite de caracteres). Gerenciados como Environment Variables no Dashboard Cloudflare.

### Controle de versão
- `mainsite-worker`: v02.03.00 → v02.03.01

## [v02.03.00] — 2026-04-07
### Adicionado
- **Content Fingerprint System**: Motor de versionamento atômico para sincronização em tempo real com o frontend.
  - **`lib/content-version.ts`**: Funções `bumpContentVersion()` (incrementa atomicamente o counter em D1) e `getContentFingerprint()` (retorna versão + headline post ID).
  - **`GET /api/content-fingerprint`**: Endpoint público ultra-leve (1 query D1, ~200 bytes, Cache-Control: 5s) para smart polling do frontend.
  - **Hooks de mutação**: `bumpContentVersion()` integrado via `executionCtx.waitUntil()` em todas as mutações de posts (create, update, delete, pin, reorder) em `posts.ts` e no cron `scheduled()` em `index.ts`.

### Controle de versão
- `mainsite-worker`: v02.02.03 → v02.03.00

## [v02.02.03] — 2026-04-06
### Adicionado
- **Cross-Service AI Telemetry**: `logAiUsage` centralizado em `genai.ts` dentro da função `generate()`, instrumentando automaticamente todos os endpoints AI (chat, transform, shareSummary). Registro de tokens, latência e status no `ai_usage_logs` (D1).
### Alterado
- **Compatibility Date**: `wrangler.json` atualizado para `2026-04-06`.
### Controle de versão
- `mainsite-worker`: v02.02.02 → v02.02.03


## [v02.02.02] — 2026-04-06
### Alterado
- **Observability 100%**: `head_sampling_rate: 1`, `invocation_logs: true` e `logs.enabled: true` ativados no `wrangler.json` do mainsite-motor.

### Controle de versão
- `mainsite-worker`: v02.02.01 → v02.02.02

## [v02.02.01] — 2026-04-06
### Migração de Pages Functions + Limpeza AI Gateway
- **Rotas R2 media migradas do frontend**: `GET /api/media/:filename` e `GET /api/mainsite/media/:filename` agora servidas nativamente pelo worker via binding `BUCKET` (mesmo bucket R2 `mainsite-media`). Pages Functions correspondentes deletadas.
- **Sitemap duplicado removido (`misc.ts`)**: rota `GET /api/sitemap.xml` removida — o sitemap canônico é servido pela Pages Function `sitemap.xml.ts` em `/sitemap.xml`.
- **Expurgo final CF_AI_GATEWAY**: substituídas todas as 6 referências residuais de `CF_AI_GATEWAY` por `GEMINI_API_KEY` em `posts.ts`, `post-summaries.ts` e `index.ts`. Guard conditions agora validam a credencial real usada pelo SDK Gemini.
- **Arquivos obsoletos removidos**: `test-genai.ts` (teste AI Gateway) e `log.txt` (log de debug) deletados.

### Controle de versão
- `mainsite-worker`: v02.02.00 → v02.02.01

## [v02.02.00] — 2026-04-06
### Alterado
- **Migração de Domínio Principal**: todas as URLs hardcoded de `www.lcv.rio.br` substituídas por `www.reflexosdaalma.blog` nos sitemaps (`misc.ts`) e URLs internas.
- **CORS Expandido (`index.ts`)**: origin check ampliado de apenas `lcv.rio.br` para todos os 9 domínios personalizados do mainsite-frontend (reflexosdaalma.blog, cardozovargas.com, lcvleo.com, etc.), com suporte a www.
- **Uploads CORS (`uploads.ts`)**: `Access-Control-Allow-Origin` alterado de `https://www.lcv.rio.br` para `*` por servir assets para múltiplos domínios.
- **E-mail do autor (`ai.ts`)**: `lcv@lcv.rio.br` substituído por `cal@reflexosdaalma.blog` no system prompt e no recipient do Resend.

### Removido
- **Webhook MP — notificação por e-mail (`payments-mp.ts`)**: removido o bloco de envio de e-mail via Resend no webhook do Mercado Pago. Webhook mantido plenamente funcional (HMAC + timestamp + ACK) como exigência de compliance, porém sem ação de e-mail.
- **Custom domain route (`wrangler.json`)**: removida a rota `mainsite-app.lcv.rio.br` com `custom_domain: true`. O worker opera exclusivamente via domínio interno `.workers.dev` e Service Binding.

### Controle de versão
- `mainsite-worker`: v02.01.08 → v02.02.00

## [v02.01.08] — 2026-04-04
### Segurança & Remoções (Tech Debt)
- **Migração Concluída: Retorno ao SDK Gemini**: Finalizada com sucesso a remoção completa do Cloudflare AI Gateway e Workers AI. 
- O arquivo `genai.ts` teve a configuração forçada da propriedade `httpOptions` banida, desativando a proxy Layer da Cloudflare e efetuando a requisição nativamente, a fim de expurgar o risco estrito de falhas de timeout formatuais (Erro 524) identificadas durante chamadas de texto pesadas nas features do app.
- A rota `ai.ts` teve toda a infraestrutura baseada no Workers AI removida. O SDK `@google/genai` processa tudo direto pelo end-point da Google. 
- A chave e variáveis `CF_AI_GATEWAY` foram erradicadas dos mapeamentos de `wrangler.json`, Types e Secrets Store para garantir estanqueidade da reversão. Adicionalmente `CF_AI_TOKEN` removida.

### Controle de versão
- `mainsite-worker`: v02.01.07 → v02.01.08

## [v02.01.07] — 2026-04-04
### Corrigido
- **Workers AI max_tokens Limiter Fix**: Adicionado suporte direto na rota `/api/ai/workers/translate` e `summarize` para suportar cargas compridas no backend, parametrizando as chamadas ao Llama-3 com `max_tokens: 4000` limitador contra fragmentação decorrente do hard-limit nativo da Cloudflare (256 tokens).

### Controle de versão
- `mainsite-worker`: v02.01.06 → v02.01.07

## [v02.01.06] — 2026-04-03
### SecOps & Fixes
- **Restabelecimento Cloudflare AI Gateway**: Refatoração concluída no factory `createClient()` e nas chaves do `wrangler.json`. A proxy URL foi desacoplada corretamente para envio via `baseUrl` e a autenticação do token `CF_AI_GATEWAY` restabelecida via header explícito `cf-aig-authorization: Bearer <TOKEN>`.
- **Ajuste de Scope ID no Workers AI**: Remoção de lógica legada de parsing de token usando `split('/')` em favor do literal isolado `workspace-gateway`.
- **Secret Store Sync (Fix)**: Validado deployment 100% positivo; as chaves ausentes da Cloudflare CI/CD `PIX_KEY`, `PIX_NAME` e `PIX_CITY` bem como aliases corrigidos para SumUp e Resend foram fixadas. Pipelines Github Actions rodando em estado green.

### Controle de versão
- `mainsite-worker`: v02.01.05 → v02.01.06

## [v02.01.05] — 2026-04-03
### SecOps & Fixes
- **Remoção de Secrets Legados**: Eliminadas senhas obsoletas (`API_SECRET` e `PIX_KEY`) tanto do código-fonte (midlewares e rotas) como do Cloudflare Secret Store, fechando vetor de segurança.
- **Sincronização de Cofre (Secret Store Compliance)**: Mapeamento corrigido no `wrangler.json` (conversão de `kebab-case` para uppercase estrito em todos os `secret_name`), resolvendo os status `500` engatilhados por secrets undefined em produção (incluindo SumUp, Resend, Gemini e Mercado Pago).
- **Hardening AI Auth**: Implementada autenticação na rota legada via `CLOUDFLARE_PW` no lugar de `API_SECRET`.
- **Cloudflare AI Gateway Slug Fix**: Ajuste de URL e binding de Cloudflare AI Gateway em testes e runtime, restaurando o serviço de IA.

### Controle de versão
- `mainsite-worker`: v02.01.04 → v02.01.05

## [v02.01.04] — 2026-04-03
### Adicionado
- **Integração Cloudflare Workers AI**: injeção do binding `AI` para processamento nativo na Edge a zero custo de API outbound.
- **Análise de Sentimento (Anti-toxicidade)**: adicionado filtro de avaliação em background (`distilbert-sst-2-int8`) nas rotas de contato e comentários (`POST /api/contact`, `POST /api/comment`), injetando marcações visuais de tensão explícita ou feedback efusivo estruturadas nos e-mails disparados ao administrador.
- **Tradução e Sumarização na Edge**: adicionadas novas rotas `/api/ai/workers/translate` (`m2m100-1.2b`) e `/api/ai/workers/summarize` (`llama-3-8b-instruct`), fornecendo primitivas de baixa latência e mitigando a dependência do Gemini para operações básicas.

### Controle de versão
- `mainsite-worker`: v02.01.03 → v02.01.04

## [v02.01.03] — 2026-04-02
### Alterado
- **Gemini SDK Integrado**: Refatoração estrutural no abstraidor lógico de IA (`src/lib/genai.ts`) migrando totalmente da antiga requisição REST (`fetch`) para o pacote oficial e mais seguro `@google/genai`. 
- Incorporada persistência de configuração *thinking models*, tratamento estrito de erro unificado e instanciamento via `apiKey`.

### Controle de versão
- `mainsite-worker`: v02.01.02 → v02.01.03

## [v02.01.02] — 2026-03-31
### Alterado
- **Dependências atualizadas**: upgrade de `@sumup/sdk`, `@cloudflare/workers-types` e `wrangler` para versões recentes, com lockfile sincronizado.
- **Dependabot para worker reforçado**: adicionado agrupamento de devDependencies (`eslint*`, `typescript`, `@types/*`, `wrangler`) para reduzir ruído operacional de PRs.

### Controle de versão
- `mainsite-worker`: v02.01.01 → v02.01.02

## [v02.01.01] — 2026-03-29
### Alterado
- **Autor dinâmico em posts**: `posts.ts` INSERT e UPDATE aceitam campo `author` no body JSON e persistem na coluna `author` da tabela `mainsite_posts`. Fallback para "Leonardo Cardozo Vargas". Paridade com `admin-app` v01.73.00.

### Controle de versão
- `mainsite-worker`: v02.01.00 → v02.01.01

## [v02.01.00] — 2026-03-29
### Alterado (MAJOR) — D1 Financial Log Deprecation
- **Arquitetura Live API-first**: todas as escritas e leituras de `mainsite_financial_logs` removidas.
  - `payments-sumup.ts`: D1 INSERT removido do endpoint `/pay`; status polling (`/status`) refatorado para consultar SDK SumUp diretamente.
  - `payments-mp.ts`: webhook `/api/webhooks/mercadopago` mantido para compliance MP (HMAC + ACK 200 + email), mas sem D1.
- **D1 binding `DB` permanece** apenas para `loadFeeConfig()` lendo `mainsite_settings` (configuração, não transação).

### Removido
- **SumUp (endpoints mortos)**: `/api/sumup/sync`, `/api/sumup/reindex-statuses`, `/api/sumup-financial-logs` (GET/check/DELETE), `/api/sumup-balance`, `/api/sumup-payment/:id/refund`, `/api/financeiro/sumup-refund`, `/api/sumup-payment/:id/cancel`, `/api/financeiro/sumup-cancel`.
- **MP (endpoints mortos)**: `/api/mp-payment/:id/refund`, `/api/mp-payment/:id/cancel`, `/api/mp-balance`, `/api/mp/sync`, `/api/financial-logs` (GET/check/DELETE).
- **Helpers órfãos**: `resolveTxnId()`, `parseSumupCancelRefundError()`.
- **Tabela `mainsite_financial_logs`**: sem escritor e sem leitor — pronta para DROP no D1.

## [v02.00.01] — 2026-03-29
### Corrigido
- **SumUp — detecção inteligente de reembolsos**: `payments-sumup.ts` agora itera todo o array `transactions[]` do checkout SumUp, identificando transações com `type: "REFUND"` e somando valores para determinar status `REFUNDED` (total) ou `PARTIALLY_REFUNDED` (parcial). Antes, apenas `transactions[0]` (pagamento original) era inspecionado.
- **Mercado Pago — detecção de reembolso parcial**: `payments-mp.ts` expandido para verificar `refunds[]` e `refund_resources[]` no payload MP, resolvendo status `PARTIALLY_REFUNDED` quando o total reembolsado é menor que o valor original.

## [v02.00.00] — 29/03/2026
### Adicionado (MAJOR)
- **Decomposição modular Hono + TypeScript**: monólito `index.js` (3013 linhas) decomposto em arquitetura modular tipada:
  - 8 módulos de rotas: `ai.ts`, `posts.ts`, `contact.ts`, `settings.ts`, `uploads.ts`, `misc.ts`, `payments-sumup.ts`, `payments-mp.ts`.
  - 4 bibliotecas compartilhadas: `auth.ts`, `logger.ts`, `rate-limit.ts`, `financial.ts`.
  - Entry point `src/index.ts` com CORS, rate limit, cron triggers e module mounts.
  - Tipagem estrita de bindings Cloudflare via `env.ts`.
- **Fee Config dinâmico**: `financial.ts` → `loadFeeConfig()` carrega taxas SumUp/MP da D1 com fallback hardcoded, eliminando valores fixos no código.

### Removido
- Monólito `src/index.js` deletado após migração completa.
- `tsconfig.json` atualizado (removido `baseUrl` deprecated).

### Alterado
- `wrangler.json`: nome do worker atualizado para `mainsite-motor`.
- Build output: 320 KiB (57 KiB gzip) via `wrangler deploy --dry-run`.

## [v01.35.02] — 28/03/2026
### Corrigido
- **SumUp — chave canônica em `mainsite_financial_logs`**: o sync histórico passou a normalizar `payment_id` para `checkout.id`, mantendo compatibilidade com registros legados originalmente persistidos com `transaction.id`.
- **SumUp — estorno/cancelamento agora atingem registros legados**: rotas canônicas e aliases retroativos passaram a atualizar o status usando tanto o checkout UUID quanto o transaction UUID legado, eliminando casos em que o painel permanecia em `SUCCESSFUL` após operação concluída no provider.

## [v01.35.01] — 28/03/2026
### Corrigido
- **SumUp — reconciliação de status no financeiro**: implementada resolução de status com precedência para estados terminais (`PARTIALLY_REFUNDED`, `REFUNDED`, `CANCELLED`, `CHARGE_BACK`, `FAILED`, `EXPIRED`) em `sumup-financial-logs` e `sumup/reindex-statuses`, evitando regressão para `SUCCESSFUL` por payload legado.
- **SumUp — rota de status duplicada**: removido handler redundante de `/api/sumup/checkout/:id/status` para eliminar conflitos de roteamento e preservar o fluxo com lazy sync.

### Adicionado
- **Compatibilidade retroativa de endpoints**: adicionados aliases `POST /api/financeiro/sumup-refund` e `POST /api/financeiro/sumup-cancel` para clientes legados ainda desacoplados das rotas canônicas `/api/sumup-payment/:id/refund|cancel`.

## [v01.35.00] — 28/03/2026
### Adicionado/Alterado
- **Integração SumUp via MCP / Flow 3DS**: Implementados novos endpoints backend de `checkout` e processamento SumUp em lote com captura do `next_step` do desafio de Autorização 3DS (`ACTION_REQUIRED`). 
- **Bypass e Polling**: Enpoints para sinalização de bypass na transição do `iframe` e um webhook/público robusto para recebimento (polling de success/failed fallback) atrelados à arquitetura global MCP.

## [v01.34.00] — 2026-03-24
### Alterado
- Migração total de D1 para namespace `mainsite_*` no `bigdata_db`
- Atualização de queries de `posts`, `settings`, `chat_logs`, `chat_context_audit`, `contact_logs`, `shares` e `financial_logs` para tabelas prefixadas
- Chaves de configuração migradas para namespace contextual: `mainsite/appearance`, `mainsite/rotation`, `mainsite/ratelimit`, `mainsite/disclaimers`

### Infra
- `wrangler.json` atualizado para `bigdata_db` (binding mantido como `DB`)
- Versionamento atualizado para `v01.34.00` + `package.json` 1.34.0

## [v01.33.00] — 2026-03-23
### Corrigido
- Endpoints críticos de pagamento protegidos com autenticação Bearer (`/api/sumup/checkout`, `/api/sumup/checkout/:id/pay`, `/api/mp-payment`)
- Webhook do Mercado Pago reforçado com validação de assinatura HMAC-SHA256 e validação de timestamp

### Segurança
- Redução de superfície de fraude em criação/processamento de pagamentos sem autenticação
- Rejeição explícita de webhooks sem headers de segurança ou assinatura inválida

## [v01.32.00] — 2026-03-22
### Alterado
- Upgrade Gemini API: modelo gemini-pro-latest, endpoint v1beta, thinkingLevel HIGH, safetySettings, retry com 1 tentativa extra, parsing multi-part para modelos thinking
- Padronização do sistema de versão para formato v00.00.00

## [v01.31.00] — Anterior
### Histórico
- Versão anterior à padronização do controle de versão
