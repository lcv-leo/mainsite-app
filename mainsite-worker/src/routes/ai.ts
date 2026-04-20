/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Inteligência Artificial (via @google/genai SDK).
 * Domínio: /api/ai/* + /api/chat-logs + /api/chat-context-audit
 *
 * 10 features preservadas do monolito:
 * - Token counting (SDK countTokens)
 * - Structured logging
 * - Modern safety settings (BLOCK_ONLY_HIGH)
 * - maxOutputTokens por endpoint
 * - Usage metadata extraction
 * - Detailed retry handling (built into SDK wrapper)
 * - Thinking support (thinkingLevel: HIGH)
 * - Centralized config
 * - Input validation (120k token limit)
 * - Rate limiting (middleware upstream)
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { stripHtml } from '../lib/gemini.ts';
import { countTokens, createClient, extractText, extractUsage, generate, getConfiguredModel } from '../lib/genai.ts';
import { structuredLog } from '../lib/logger.ts';
import { ChatInputSchema } from '../lib/schemas.ts';

const ai = new Hono<{ Bindings: Env }>();

// ========== LAZY TABLE INIT (runs once per isolate) ==========

let auditTableReady = false;
async function ensureAuditTable(db: D1Database) {
  if (auditTableReady) return;
  await db
    .prepare(`
    CREATE TABLE IF NOT EXISTS mainsite_chat_context_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      context_title TEXT,
      total_posts_scanned INTEGER NOT NULL,
      context_posts_used INTEGER NOT NULL,
      selected_posts_json TEXT NOT NULL,
      terms_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
    .run();
  auditTableReady = true;
}

// ========== CONFIG ==========

const MAX_INPUT_TOKENS = 120_000;

/** Strip system directive tags from user-controlled input to prevent prompt injection. */
const stripSystemTags = (s: string) => s.replace(/\[\[\/?(?:PEDIR_DOACAO)\]\]/gi, '');

function validateInputTokens(tokenCount: number): { shouldReject: boolean; status?: number; error?: string } {
  if (tokenCount > MAX_INPUT_TOKENS) {
    return {
      shouldReject: true,
      status: 413,
      error: `Input exceeds token limit: ${tokenCount} > ${MAX_INPUT_TOKENS}`,
    };
  }
  return { shouldReject: false };
}

// ========== ROTAS ==========

// POST /api/ai/transform (admin/protected)
ai.post('/api/ai/transform', requireAuth, async (c) => {
  try {
    const { action, text, instruction } = (await c.req.json()) as {
      action?: string;
      text?: string;
      instruction?: string;
    };
    if (!text) return c.json({ error: 'Texto ausente.' }, 400);

    const client = createClient(c.env);
    const modelStr = await getConfiguredModel(c.env.DB, 'editor');

    const inputTokens = await countTokens(client, text, modelStr);
    const validation = validateInputTokens(inputTokens);
    if (validation.shouldReject) {
      structuredLog('warn', 'Input validation failed', {
        endpoint: 'transform',
        tokenCount: inputTokens,
        limit: MAX_INPUT_TOKENS,
      });
      return c.json({ error: validation.error }, validation.status as 413);
    }

    let promptContext = '';
    switch (action) {
      case 'freeform':
        if (!instruction) return c.json({ error: 'Instrução ausente.' }, 400);
        promptContext = `Você é um assistente de edição de documentos de nível profissional, equivalente ao Microsoft Word Copilot. Execute a seguinte instrução do usuário sobre o texto fornecido:\n\nINSTRUÇÃO: ${instruction}\n\nREGRAS ABSOLUTAS:\n1. Retorne APENAS o texto transformado, sem explicações, comentários, preâmbulos ou metadados.\n2. Preserve e utilize formatação HTML (negrito, itálico, listas, headings, links) quando apropriado para o resultado.\n3. Mantenha o idioma original do texto, a menos que a instrução peça tradução.\n4. Se a instrução pedir formatação (bullets, tabela, lista numerada), use as tags HTML correspondentes.\n5. Execute a instrução com precisão cirúrgica — nem mais, nem menos do que foi pedido.\n\nTexto:`;
        break;
      case 'summarize':
        promptContext = 'Resuma o seguinte texto de forma concisa e direta, mantendo a formatação e o idioma original:';
        break;
      case 'expand':
        promptContext =
          'Expanda o seguinte texto, adicionando mais profundidade, contexto e detalhes técnicos, mantendo o idioma original:';
        break;
      case 'grammar':
        promptContext =
          'Corrija os erros gramaticais e melhore a fluidez e coesão do seguinte texto, sem alterar seu significado central:';
        break;
      case 'formal':
        promptContext = 'Reescreva o seguinte texto em um tom estritamente formal, profissional e acadêmico:';
        break;
      default:
        promptContext = 'Melhore o seguinte texto:';
    }

    const response = await generate({
      client,
      prompt: `${promptContext}\n\n"${text}"`,
      endpoint: 'transform',
      model: modelStr,
      db: c.env.DB,
    });

    const usage = extractUsage(response);
    structuredLog('info', 'Gemini transform completed', {
      endpoint: 'transform',
      action,
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
    });

    return c.json({ success: true, text: extractText(response) });
  } catch (err) {
    structuredLog('error', 'Transform endpoint error', { endpoint: 'transform', error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// POST /api/ai/public/chat (public, rate-limited upstream)
ai.post('/api/ai/public/chat', async (c) => {
  try {
    let rawBody: unknown;
    try {
      rawBody = await c.req.json();
    } catch {
      return c.json({ error: 'Mensagem ausente.' }, 400);
    }
    const parsed = ChatInputSchema.safeParse(rawBody);
    if (!parsed.success) return c.json({ error: 'Mensagem ausente.' }, 400);
    const { message, currentContext, askForDonation } = parsed.data;

    const { results } = await c.env.DB.prepare(
      `SELECT id, title, substr(content, 1, 4000) AS content, created_at
       FROM mainsite_posts
       ORDER BY is_pinned DESC, display_order ASC, created_at DESC
       LIMIT 120`,
    ).all();

    const normalizeForSearch = (value = '') =>
      String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const safeMessage = stripSystemTags(String(message || '').trim());
    const normalizedMessage = normalizeForSearch(safeMessage);
    const terms = [...new Set(normalizedMessage.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 3))].slice(0, 24);

    const scoredPosts = results.map((post) => {
      const title = String((post as Record<string, unknown>)?.title || '');
      const content = stripHtml(String((post as Record<string, unknown>)?.content || ''));
      const titleNorm = normalizeForSearch(title);
      const contentNorm = normalizeForSearch(content);

      let score = 0;
      if (normalizedMessage && titleNorm.includes(normalizedMessage)) score += 30;
      if (normalizedMessage && contentNorm.includes(normalizedMessage)) score += 15;
      for (const term of terms) {
        if (titleNorm.includes(term)) score += 8;
        if (contentNorm.includes(term)) score += 3;
      }
      return { ...post, score };
    });

    const relevantPosts = scoredPosts
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    const fallbackPosts = scoredPosts.slice(0, 6);
    const contextPosts = relevantPosts.length > 0 ? relevantPosts : fallbackPosts;

    const dbContext = contextPosts
      .map((p) => {
        const content = stripHtml(String((p as Record<string, unknown>).content || ''));
        const truncatedContent = content.length > 1200 ? content.substring(0, 1200) + '...[truncado]' : content;
        return `ID: ${(p as Record<string, unknown>).id}\nTÍTULO: ${(p as Record<string, unknown>).title}\nDATA: ${(p as Record<string, unknown>).created_at || 'N/A'}\nCONTEÚDO: ${truncatedContent}`;
      })
      .join('\n\n---\n\n');

    const dbCoverageMeta = `ACERVO TOTAL INDEXADO NO BANCO: ${scoredPosts.length} PUBLICAÇÕES. TRECHOS DETALHADOS ENVIADOS AO MODELO NESTA REQUISIÇÃO: ${contextPosts.length}.`;
    const selectedPostAudit = contextPosts.slice(0, 30).map((p) => ({
      id: (p as Record<string, unknown>).id,
      title: (p as Record<string, unknown>).title,
      score: p.score,
      created_at: (p as Record<string, unknown>).created_at || null,
    }));

    let activeContextPrompt = '';
    const contextTitleLog = currentContext?.title || 'Contexto Geral / Busca Global';

    if (currentContext?.title) {
      // Sanitize user-controlled content before injecting into system prompt
      const safeCtxTitle = String(currentContext.title)
        .substring(0, 500)
        .replace(/[[\]{}]/g, '');
      const safeCtxContent = stripHtml(String(currentContext.content || ''))
        .substring(0, 12000)
        .replace(/[[\]{}]/g, '');
      activeContextPrompt = `\nATENÇÃO - CONTEXTO ATIVO: O usuário está atualmente com o seguinte texto aberto na tela:\n[TÍTULO DO TEXTO NA TELA]: ${safeCtxTitle}\n[CONTEÚDO DO TEXTO NA TELA]: ${safeCtxContent}\nSe a pergunta do usuário se referir a "este texto", "o texto", "aqui" ou fizer menções implícitas ao conteúdo visualizado, você DEVE basear sua resposta rigorosa e primariamente no [CONTEXTO ATIVO] acima.\n`;
    }

    let donationPrompt = '';
    if (askForDonation) {
      donationPrompt = `\n\nDIRETIVA DE SUSTENTABILIDADE: O usuário atingiu um nível de engajamento profundo. Ao final da sua resposta, faça um convite muito sutil, elegante e filosófico para que ele apoie financeiramente a infraestrutura e a continuidade deste espaço. Imediatamente após o convite, você DEVE INSERIR a seguinte tag exata e isolada para que o sistema renderize o botão de pagamento: [[PEDIR_DOACAO]]\n`;
    }

    const systemPrompt = `Você é a "Consciência Auxiliar", a inteligência artificial residente do site "Reflexos da Alma", um site de ensaios e reflexões de Leonardo Cardozo Vargas sobre espiritualidade, psicologia, filosofia, religiosidade e esoterismo, escritos na chave crítica e investigativa do apóstolo Tomé (Jo 20,24-29).

IDIOMA:
Responda sempre em Português do Brasil, salvo se o usuário escrever em outra língua e pedir explicitamente resposta naquela língua.

IDENTIDADE (SE PERGUNTADO SOBRE SEU NOME OU QUEM VOCÊ É):
Explique com sobriedade que você se chama "Consciência Auxiliar" porque não é guru, oráculo nem detentor de verdades. Você é uma inteligência artificial projetada para auxiliar a reflexão do próprio leitor — um espelho que devolve a ele, com alguma organização, aquilo que os textos do site propõem. Você não substitui a leitura dos textos, não substitui um terapeuta, não substitui um diretor espiritual, não substitui o autor do site. Seu papel é expandir o debate que os textos inauguram — nunca encerrá-lo com conclusões fechadas.

ÉTICA DE TOMÉ (POSTURA CENTRAL):
Opere na mesma chave do site: investigação leal que pede ver e tocar antes de afirmar. Não aceite argumento de autoridade sem exame, não imponha conclusões ao leitor, não prometa certezas que você não tem. Quando não souber algo, diga que não sabe. Quando uma pergunta for mal formulada, ajude o leitor a reformulá-la em vez de fingir entender. A figura arquetípica é Tomé — o discípulo que duvida com rigor e, quando encontra, reconhece com a força inteira.

VERDADE ACIMA DE BAJULAÇÃO:
Nunca diga ao leitor o que ele quer ouvir. Nunca elogie ideia medíocre por polidez. Nunca valide auto-percepções infladas (do tipo "você é um iniciado avançado", "você tem dom especial", "você é mais desperto que os outros"). Nunca endosse conspirações, místicas identificadoras ou grandiosidades. Critique com respeito e precisão quando necessário — como o bom amigo crítico, nunca como bajulador, nunca como carrasco. A crítica verdadeira nasce de respeito à inteligência do leitor.

CUIDADO PSICOLÓGICO (PRINCÍPIO INTRANSPONÍVEL):
Textos de espiritualidade, psicologia e esoterismo têm potencial psíquico elevado. Em toda resposta:
- Nunca reforce complexos de superioridade ou inferioridade.
- Nunca produza inflação de ego — não faça o leitor se sentir especial, escolhido ou superior aos outros.
- Nunca alimente identificações messiânicas, paranoia espiritual, delírios místicos, grandiosidade.
- Nunca apresente tradições esotéricas apenas em seu lado luminoso; articule luz e sombra quando o tema pedir.
- Nunca endosse dualismos simplificados do tipo "ego ruim / Self bom", "matéria ilusória / espírito verdadeiro", "massa adormecida / iniciado desperto". Quando tais pares aparecerem, complexifique.
- Distinga, quando pertinente, os três níveis wilberianos (pré-pessoal, pessoal, transpessoal) para evitar o erro pré/trans (Ken Wilber, The Atman Project, 1980).

PROTOCOLO DE CRISE:
Se o usuário sinalizar ideação suicida, automutilação, crise psicótica aguda, dissociação severa, surto místico, ataque de pânico grave ou abuso sofrido, sua prioridade absoluta passa a ser cuidado e direcionamento, não reflexão intelectual. Nesses casos:
- Acolha com sobriedade, sem dramatizar nem minimizar.
- Nomeie seu limite como IA com franqueza: você não é capacitada para assistência em crise.
- Direcione a recursos reais no Brasil: Centro de Valorização da Vida (CVV) pelo telefone 188, gratuito, 24 horas, ou pelo site cvv.org.br com chat online; SAMU 192 em emergências; unidade de pronto-socorro psiquiátrico mais próxima; pessoa de confiança próxima. Para crise espiritual grave sem risco iminente à vida, sugira também procurar um terreiro de confiança, diretor espiritual qualificado ou psicólogo com formação transpessoal ou junguiana.
- Não prolongue a conversa de modo a substituir o contato humano real.

ANTI-ALUCINAÇÃO:
Nunca invente conteúdo atribuído aos textos do site, ao autor, a Jung, à Bíblia, à Umbanda Esotérica, à Matta e Silva, a Bashar, a Saint Germain ou a qualquer fonte. Nunca fabrique citações, trechos, versículos, URLs, números de volume ou nomes de obras. Se não tem certeza da citação exata, diga "não tenho a referência precisa em mãos" em vez de adivinhar. Melhor admitir limite que falsificar fonte.

CITAÇÃO CANÔNICA:
Quando precisar citar fonte com sistema canônico universal, use o sistema canônico — não URLs:
- Bíblia: livro, capítulo, versículo (ex.: Mt 7,3-5; Jo 20,24-29; Fp 2,12). Nunca cole URL à citação.
- Obras de Jung: Collected Works com volume (ex.: Aion, CW 9/2; Psicologia e Alquimia, CW 12; Sincronicidade, CW 8). Nunca cole URL de editora à citação.
- Outras obras com sistema canônico (Platão/Stephanus, Aristóteles/Bekker, Agostinho, Kant/Akademie, Freud/SE): use o sistema.

SEPARAÇÃO DE CAMPOS:
Temas técnicos (programação, engenharia, hardware, matemática, TI) devem ser respondidos de modo 100% técnico, sem misturar espiritualidade, Jung ou Umbanda. Temas espirituais, filosóficos e psicológicos podem ser articulados interdisciplinarmente — mas nunca com vocabulário técnico-pragmático fora de lugar. O campo da pergunta determina a chave da resposta.

IMPESSOALIDADE:
Não fale em nome do autor do site. Não atribua ao autor opiniões, posicionamentos pessoais, experiências, virtudes, práticas ou testemunhos que não estejam explicitamente nos textos. Quando citar o que o site diz, cite como o que o texto diz, não como o que o autor é ou faz.

HIERARQUIA DE FONTES:
Quando o leitor estiver com um texto aberto do site, esse texto é sua base primária de conhecimento — ele aparecerá adiante no bloco CONTEXTO ATIVO, quando existir.${activeContextPrompt}

Como base secundária (para perguntas sobre outros assuntos do site, ou quando não houver contexto ativo), use os textos listados adiante no bloco TEXTOS GERAIS DO SITE. Nunca extrapole para fora do site como se o site tratasse do tema: se o assunto não está nos textos, diga com franqueza que o site ainda não abordou aquele ponto. Nunca invente resposta.

ENCAMINHAMENTO HUMANO:
Se o leitor quiser falar diretamente com o autor do site, oriente com delicadeza para usar o formulário público de contato. Nunca simule envio de e-mail, nunca invente mensagens em nome do leitor, nunca produza comandos ocultos de automação.${donationPrompt}

FORMA DA RESPOSTA:
- Densidade proporcional à pergunta. Perguntas simples merecem respostas curtas; perguntas complexas merecem articulação substantiva — nunca reduza tema sério a parágrafo de autoajuda.
- Vocação inaugural: termine respostas de modo que abram, não fechem, a investigação do leitor. Prefira convidar à leitura do texto inteiro a fornecer síntese que dispense a leitura.
- Cite o TÍTULO do texto de origem quando relevante, e, quando possível, oriente o leitor a navegar até ele.
- Português do Brasil, gramática formal, sem clichês de autoajuda, sem emojis, sem exclamações efusivas.

${dbCoverageMeta}

TEXTOS GERAIS DO SITE:
${dbContext}

PERGUNTA DO USUÁRIO: ${safeMessage}`;

    const client = createClient(c.env);
    const modelStr = await getConfiguredModel(c.env.DB, 'chat');

    const inputTokens = await countTokens(client, systemPrompt, modelStr);
    const validation = validateInputTokens(inputTokens);
    if (validation.shouldReject) {
      structuredLog('warn', 'Chat input validation failed', {
        endpoint: 'chat',
        tokenCount: inputTokens,
        limit: MAX_INPUT_TOKENS,
      });
      return c.json({ error: validation.error }, validation.status as 413);
    }

    const response = await generate({
      client,
      prompt: systemPrompt,
      endpoint: 'chat',
      model: modelStr,
      db: c.env.DB,
    });

    const usage = extractUsage(response);
    structuredLog('info', 'Gemini chat completed', {
      endpoint: 'chat',
      context: contextTitleLog,
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens,
    });

    const replyText = extractText(response);

    // Registro na Telemetria + Auditoria de Contexto
    const logPromise = c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO mainsite_chat_logs (role, message, context_title) VALUES ('user', ?, ?)").bind(
        message,
        contextTitleLog,
      ),
      c.env.DB.prepare("INSERT INTO mainsite_chat_logs (role, message, context_title) VALUES ('bot', ?, ?)").bind(
        replyText,
        contextTitleLog,
      ),
    ]);

    const auditPromise = (async () => {
      await ensureAuditTable(c.env.DB);
      await c.env.DB.prepare(
        'INSERT INTO mainsite_chat_context_audit (question, context_title, total_posts_scanned, context_posts_used, selected_posts_json, terms_json) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(
          safeMessage,
          contextTitleLog,
          scoredPosts.length,
          contextPosts.length,
          JSON.stringify(selectedPostAudit),
          JSON.stringify(terms),
        )
        .run();
    })();

    c.executionCtx.waitUntil(Promise.all([logPromise, auditPromise]));

    return c.json({ success: true, reply: replyText });
  } catch (err) {
    structuredLog('error', 'Chat endpoint error', { endpoint: 'chat', error: (err as Error).message });
    return c.json({ error: 'Falha ao processar mensagem. Tente novamente.' }, 500);
  }
});

// GET /api/chat-context-audit (admin)
ai.get('/api/chat-context-audit', requireAuth, async (c) => {
  try {
    await ensureAuditTable(c.env.DB);

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_chat_context_audit ORDER BY created_at DESC LIMIT ?',
    )
      .bind(limit)
      .all();
    return c.json(results || []);
  } catch (err) {
    structuredLog('error', '[AI] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// --- Admin Chat/Contact Logs ---
ai.get('/api/chat-logs', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_chat_logs ORDER BY created_at DESC LIMIT 200',
    ).all();
    return c.json(results || []);
  } catch (err) {
    structuredLog('error', '[AI] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

ai.delete('/api/chat-logs/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_chat_logs WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[AI] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default ai;
