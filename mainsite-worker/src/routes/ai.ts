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
import { structuredLog } from '../lib/logger.ts';
import { createClient, countTokens, generate, extractText, extractUsage, getConfiguredModel } from '../lib/genai.ts';
import { ChatInputSchema } from '../lib/schemas.ts';

const ai = new Hono<{ Bindings: Env }>();

// ========== LAZY TABLE INIT (runs once per isolate) ==========

let auditTableReady = false;
async function ensureAuditTable(db: D1Database) {
  if (auditTableReady) return;
  await db.prepare(`
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
  `).run();
  auditTableReady = true;
}

// ========== CONFIG ==========

const MAX_INPUT_TOKENS = 120_000;

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
        promptContext = 'Expanda o seguinte texto, adicionando mais profundidade, contexto e detalhes técnicos, mantendo o idioma original:';
        break;
      case 'grammar':
        promptContext = 'Corrija os erros gramaticais e melhore a fluidez e coesão do seguinte texto, sem alterar seu significado central:';
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
    return c.json({ error: (err as Error).message }, 500);
  }
});

// POST /api/ai/public/chat (public, rate-limited upstream)
ai.post('/api/ai/public/chat', async (c) => {
  try {
    const parsed = ChatInputSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Mensagem ausente.' }, 400);
    const { message, currentContext, askForDonation } = parsed.data;

    const { results } = await c.env.DB.prepare(
      'SELECT id, title, content, created_at FROM mainsite_posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC'
    ).all();

    const normalizeForSearch = (value = '') =>
      String(value)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

    const safeMessage = String(message || '').trim();
    const normalizedMessage = normalizeForSearch(safeMessage);
    const terms = [
      ...new Set(
        normalizedMessage
          .split(/[^\p{L}\p{N}]+/u)
          .filter((t) => t.length >= 3)
      ),
    ].slice(0, 24);

    const scoredPosts = results.map((post) => {
      const title = String((post as Record<string, unknown>)?.title || '');
      const content = String((post as Record<string, unknown>)?.content || '');
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

    const relevantPosts = scoredPosts.filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 24);
    const fallbackPosts = scoredPosts.slice(0, 12);
    const contextPosts = relevantPosts.length > 0 ? relevantPosts : fallbackPosts;

    const dbContext = contextPosts
      .map((p) => {
        const content = String((p as Record<string, unknown>).content || '');
        const truncatedContent = content.length > 2000 ? content.substring(0, 2000) + '...[truncado]' : content;
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
      activeContextPrompt = `\nATENÇÃO - CONTEXTO ATIVO: O usuário está atualmente com o seguinte texto aberto na tela:\n[TÍTULO DO TEXTO NA TELA]: ${currentContext.title}\n[CONTEÚDO DO TEXTO NA TELA]: ${currentContext.content}\nSe a pergunta do usuário se referir a "este texto", "o texto", "aqui" ou fizer menções implícitas ao conteúdo visualizado, você DEVE basear sua resposta rigorosa e primariamente no [CONTEXTO ATIVO] acima.\n`;
    }

    let donationPrompt = '';
    if (askForDonation) {
      donationPrompt = `\n\nDIRETIVA DE SUSTENTABILIDADE: O usuário atingiu um nível de engajamento profundo. Ao final da sua resposta, faça um convite muito sutil, elegante e filosófico para que ele apoie financeiramente a infraestrutura e a continuidade deste espaço. Imediatamente após o convite, você DEVE INSERIR a seguinte tag exata e isolada para que o sistema renderize o botão de pagamento: [[PEDIR_DOACAO]]\n`;
    }

    const systemPrompt = `Você é a "Consciência Auxiliar", a inteligência artificial residente do site "Reflexos da Alma".

DIRETRIZ DE IDENTIDADE (SE PERGUNTADO SOBRE SEU NOME OU QUEM VOCÊ É):
Explique de forma educada, objetiva e filosófica que você se chama "Consciência Auxiliar" porque não é um guru, oráculo ou detentora de verdades absolutas. Você é uma inteligência artificial projetada estritamente para servir de apoio (auxílio) à própria consciência do leitor. Seu papel é atuar como um espelho reflexivo, ajudando o usuário a processar, debater, questionar e aprofundar as abstrações e ensaios presentes no site. Você não tem ego, apenas a função de expandir o debate proposto nos textos.

NOVA DIRETRIZ DE ENCAMINHAMENTO DE MENSAGENS PARA O AUTOR:
Se o leitor manifestar o desejo de enviar um comentário, pergunta ou feedback diretamente para o autor (Leonardo), ou se você, durante a análise, perceber que a dúvida seria melhor respondida pelo autor, ofereça-se ativamente para encaminhar a mensagem.
Se o leitor confirmar a intenção de envio e ditar a mensagem, você OBRIGATORIAMENTE deve adicionar o seguinte bloco delimitador no final da sua resposta:

[[ENVIAR_EMAIL]]
[TRANSCREVA AQUI A MENSAGEM EXATA E REAL DO LEITOR]
[[/ENVIAR_EMAIL]]

ATENÇÃO CRÍTICA: Substitua o texto entre colchetes pela mensagem VERDADEIRA do usuário. NÃO invente textos e NÃO use exemplos genéricos. O sistema interceptará esse bloco, removerá a tag inteira antes de exibir a resposta, e fará o envio de forma invisível. NUNCA revele o endereço de e-mail do autor (cal@reflexosdaalma.blog).${donationPrompt}

REGRAS GERAIS DE RESPOSTA:
O usuário fará uma pergunta ou busca semântica.${activeContextPrompt}
Como base de conhecimento secundária (para perguntas sobre outros assuntos do site), utilize os textos gerais fornecidos abaixo. 
Se a resposta não estiver em nenhum dos textos, diga educadamente que o site ainda não abordou este tema.
Forneça respostas diretas, limpas e cite o TÍTULO do texto quando for relevante.

${dbCoverageMeta}

TEXTOS GERAIS DO SITE:
${dbContext}

PERGUNTA DO USUÁRIO: ${message}`;

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

    let replyText = extractText(response);

    // Tratativa da Tag de E-mail Oculto
    const emailRegex = /\[\[ENVIAR_EMAIL\]\](.*?)\[\[\/ENVIAR_EMAIL\]\]/is;
    const emailMatch = replyText.match(emailRegex);

    if (emailMatch) {
      const messageToSend = emailMatch[1].trim();
      const resendToken = c.env.RESEND_API_KEY;

      if (resendToken) {
        const aiHtml = `
          <div style="font-family: sans-serif; color: #333;">
            <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Interação do Leitor via Consciência Auxiliar</h2>
            <p><strong>Contexto Ativo na Tela:</strong> ${contextTitleLog}</p>
            <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin-top: 20px;">
              <p style="margin: 0; white-space: pre-wrap;">${messageToSend}</p>
            </div>
            <p style="font-size: 11px; color: #666; margin-top: 20px;">Este e-mail foi disparado autonomamente pelo modelo Gemini 2.5 Pro a pedido do leitor.</p>
          </div>
        `;

        c.executionCtx.waitUntil(
          fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Consciência Auxiliar <mainsite@lcv.app.br>',
              to: 'cal@reflexosdaalma.blog',
              subject: `Interação do Leitor no Chatbot: ${contextTitleLog}`,
              html: aiHtml,
            }),
          }).catch((e) => console.error('Falha no disparo do e-mail da IA:', e))
        );
      }
      replyText = replyText.replace(emailRegex, '').trim();
    }

    // Registro na Telemetria + Auditoria de Contexto
    const logPromise = c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO mainsite_chat_logs (role, message, context_title) VALUES ('user', ?, ?)").bind(message, contextTitleLog),
      c.env.DB.prepare("INSERT INTO mainsite_chat_logs (role, message, context_title) VALUES ('bot', ?, ?)").bind(replyText, contextTitleLog),
    ]);

    const auditPromise = (async () => {
      await ensureAuditTable(c.env.DB);
      await c.env.DB.prepare(
        'INSERT INTO mainsite_chat_context_audit (question, context_title, total_posts_scanned, context_posts_used, selected_posts_json, terms_json) VALUES (?, ?, ?, ?, ?, ?)'
      )
        .bind(safeMessage, contextTitleLog, scoredPosts.length, contextPosts.length, JSON.stringify(selectedPostAudit), JSON.stringify(terms))
        .run();
    })();

    c.executionCtx.waitUntil(Promise.all([logPromise, auditPromise]));

    return c.json({ success: true, reply: replyText });
  } catch (err) {
    structuredLog('error', 'Chat endpoint error', { endpoint: 'chat', error: (err as Error).message });
    return c.json({ error: (err as Error).message }, 500);
  }
});

// GET /api/chat-context-audit (admin)
ai.get('/api/chat-context-audit', requireAuth, async (c) => {
  try {
    await ensureAuditTable(c.env.DB);

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 100;
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_chat_context_audit ORDER BY created_at DESC LIMIT ?'
    )
      .bind(limit)
      .all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});



// --- Admin Chat/Contact Logs ---
ai.get('/api/chat-logs', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM mainsite_chat_logs ORDER BY created_at DESC LIMIT 200').all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

ai.delete('/api/chat-logs/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_chat_logs WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default ai;
