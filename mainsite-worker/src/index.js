// Módulo: mainsite-worker/src/index.js
// Versão: v02.00.00
// Descrição: Modernização Gemini v1beta com 10 features: token counting, structured logging, improved safety settings, maxOutputTokens, usage metadata, JSDoc types, detailed retry handling, thinking support, centralized config, input validation. Código INTEGRAL do backend Hono preservado.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MercadoPagoConfig, Payment, PaymentMethod, PaymentRefund } from 'mercadopago';
import SumUp from '@sumup/sdk';

// Polyfill para Headers.raw() exigido por algumas dependências
if (typeof Headers !== 'undefined' && !Headers.prototype.raw) {
  Headers.prototype.raw = function () {
    const raw = {};
    this.forEach((value, key) => { raw[key] = [value]; });
    return raw;
  };
}

const app = new Hono();

// ========== CONFIGURAÇÃO CENTRALIZADA DO GEMINI V1BETA ==========

/**
 * @typedef {Object} GeminiConfig
 * @property {string} model - Modelo Gemini (ex: 'gemini-pro-latest')
 * @property {string} version - Versão da API (ex: 'v1beta')
 * @property {number} maxTokensInput - Limite máximo de tokens na entrada (120000)
 * @property {number} maxRetries - Número de tentativas (2)
 * @property {number} retryDelayMs - Delay entre tentativas (800ms)
 * @property {Object} defaultThinkingConfig - Configuração de thinking
 */

const GEMINI_CONFIG = {
  model: 'gemini-pro-latest',
  version: 'v1beta',
  maxTokensInput: 120000,
  maxRetries: 2,
  retryDelayMs: 800,
  defaultThinkingConfig: { thinkingLevel: 'HIGH' },
  endpoints: {
    transform: { maxOutputTokens: 6000, temperature: 0.5 },
    chat: { maxOutputTokens: 8192, temperature: 0.3 },
    summarize: { maxOutputTokens: 4096, temperature: 0.4 },
    translate: { maxOutputTokens: 5000, temperature: 0.2 }
  }
};

// ========== UTILITÁRIOS DE LOGGING ESTRUTURADO ==========

/**
 * Estrutura log em formato JSON com ISO timestamp
 * @param {string} level - 'info' | 'warn' | 'error' | 'debug'
 * @param {string} message - Mensagem principal
 * @param {Object} context - Dados contextuais adicionais
 */
function structuredLog(level, message, context = {}) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...context
  };
  console.log(JSON.stringify(logEntry));
}

// ========== UTILITÁRIOS DE TOKEN COUNTING ==========

/**
 * Estima contagem de tokens via countTokens API (pré-validação)
 * @param {string} text - Texto para análise
 * @param {string} apiKey - Chave de API Gemini
 * @returns {Promise<number>} Número aproximado de tokens
 */
async function estimateTokenCount(text, apiKey) {
  if (!text || !apiKey) return 0;
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${GEMINI_CONFIG.version}/models/${GEMINI_CONFIG.model}:countTokens?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }]
        })
      }
    );
    if (!response.ok) return 0;
    const data = await response.json();
    return data.totalTokens || 0;
  } catch (err) {
    structuredLog('warn', 'Failed to count tokens', { error: err.message });
    return 0;
  }
}

/**
 * Validação de entrada: rejeita se tokens > 120k
 * @param {number} tokenCount - Contagem de tokens
 * @throws {Object} Status 413 com mensagem se exceder limite
 */
function validateInputTokens(tokenCount) {
  if (tokenCount > GEMINI_CONFIG.maxTokensInput) {
    return {
      shouldReject: true,
      status: 413,
      error: `Input exceeds token limit: ${tokenCount} > ${GEMINI_CONFIG.maxTokensInput}`
    };
  }
  return { shouldReject: false };
}

// ========== UTILITÁRIOS DE GERAÇÃO SEGURA ==========

/**
 * Cria configuração de safety settings modernizada (BLOCK_ONLY_HIGH para conteúdo perigoso)
 * @returns {Object[]} Array de categorias com thresholds
 */
function getModernSafetySettings() {
  return [
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  ];
}

/**
 * Retorna generationConfig com maxOutputTokens para o endpoint
 * @param {string} endpoint - 'transform' | 'chat' | 'summarize' | 'translate'
 * @returns {Object} Configuração com temperature, maxOutputTokens, thinkingConfig
 */
function getGenerationConfig(endpoint) {
  const config = GEMINI_CONFIG.endpoints[endpoint] || GEMINI_CONFIG.endpoints.chat;
  return {
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    thinkingConfig: GEMINI_CONFIG.defaultThinkingConfig
  };
}

// ========== UTILITÁRIOS DE RETRY COM LOGGING ==========

/**
 * Executa fetch com retry automático e logging detalhado
 * @param {string} url - URL do endpoint Gemini
 * @param {Object} options - Opções de fetch
 * @param {string} endpoint - Nome do endpoint (para logging)
 * @returns {Promise<Response>} Response do Gemini
 */
async function fetchWithRetry(url, options, endpoint = 'unknown') {
  let lastError;
  for (let attempt = 1; attempt <= GEMINI_CONFIG.maxRetries; attempt++) {
    try {
      structuredLog('info', `Gemini API request attempt ${attempt}`, {
        endpoint,
        attempt,
        url: url.split('?')[0]
      });

      const response = await fetch(url, options);

      // Se sucesso, retorna imediatamente
      if (response.ok) {
        structuredLog('info', 'Gemini API request succeeded', {
          endpoint,
          attempt,
          status: response.status
        });
        return response;
      }

      // Se erro, tenta próxima iteração
      lastError = {
        status: response.status,
        statusText: response.statusText
      };

      structuredLog('warn', 'Gemini API request failed', {
        endpoint,
        attempt,
        status: response.status,
        message: response.statusText
      });

      // Aguarda backoff antes de retry (exceto na última tentativa)
      if (attempt < GEMINI_CONFIG.maxRetries) {
        await new Promise(r => setTimeout(r, GEMINI_CONFIG.retryDelayMs));
      }
    } catch (err) {
      lastError = { message: err.message };

      structuredLog('error', 'Gemini API request error', {
        endpoint,
        attempt,
        error: err.message
      });

      if (attempt < GEMINI_CONFIG.maxRetries) {
        await new Promise(r => setTimeout(r, GEMINI_CONFIG.retryDelayMs));
      }
    }
  }

  // Falhou em todas as tentativas
  structuredLog('error', 'Gemini API request exhausted retries', {
    endpoint,
    totalAttempts: GEMINI_CONFIG.maxRetries,
    lastError
  });

  throw new Error(`API request failed after ${GEMINI_CONFIG.maxRetries} attempts: ${JSON.stringify(lastError)}`);
}

/**
 * Extrai usage metadata da resposta Gemini
 * @param {Object} responseData - Dados da resposta do Gemini
 * @returns {Object} { promptTokens, outputTokens, cachedTokens }
 */
function extractUsageMetadata(responseData) {
  const usage = responseData?.usageMetadata || {};
  return {
    promptTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
    cachedTokens: usage.cachedContentTokenCount || 0
  };
}

// ========== UTILITÁRIO PARA PARSING DE RESPOSTAS MULTI-PART ==========

/**
 * Filtra e concatena partes de texto de resposta thinking (sem thoughts)
 * @param {Object[]} parts - Array de partes da resposta
 * @returns {string} Texto concatenado
 */
function extractTextFromParts(parts) {
  return (parts || [])
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('');
}

// Configuração estrita de CORS
app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return null;
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      if (hostname === 'lcv.rio.br' || hostname.endsWith('.lcv.rio.br')) {
        return origin;
      }
      return null;
    } catch {
      return null;
    }
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

// Middleware de Rate Limiting (Escudo contra abusos da IA)
const ipCache = new Map();
let cachedRlConfig = null;
let rlConfigLastFetched = 0;

const DEFAULT_RATE_LIMIT = {
  chatbot: { enabled: false, maxRequests: 5, windowMinutes: 1 },
  email: { enabled: false, maxRequests: 3, windowMinutes: 15 }
};

const normalizeRateLimitConfig = (raw) => {
  if (!raw || typeof raw !== 'object') return DEFAULT_RATE_LIMIT;

  // Retrocompatibilidade com configuração legada { enabled, maxRequests, windowMinutes }
  if ('enabled' in raw || 'maxRequests' in raw || 'windowMinutes' in raw) {
    return {
      chatbot: {
        enabled: Boolean(raw.enabled),
        maxRequests: Math.max(1, Number(raw.maxRequests) || DEFAULT_RATE_LIMIT.chatbot.maxRequests),
        windowMinutes: Math.max(1, Number(raw.windowMinutes) || DEFAULT_RATE_LIMIT.chatbot.windowMinutes)
      },
      email: { ...DEFAULT_RATE_LIMIT.email }
    };
  }

  const normalizeBucket = (bucket, fallback) => ({
    enabled: Boolean(bucket?.enabled),
    maxRequests: Math.max(1, Number(bucket?.maxRequests) || fallback.maxRequests),
    windowMinutes: Math.max(1, Number(bucket?.windowMinutes) || fallback.windowMinutes)
  });

  return {
    chatbot: normalizeBucket(raw.chatbot, DEFAULT_RATE_LIMIT.chatbot),
    email: normalizeBucket(raw.email, DEFAULT_RATE_LIMIT.email)
  };
};

const getRateLimitConfig = async (c) => {
  const now = Date.now();
  if (!cachedRlConfig || now - rlConfigLastFetched > 60000) {
    try {
      const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'ratelimit'").first();
      const parsed = record ? JSON.parse(record.payload) : DEFAULT_RATE_LIMIT;
      cachedRlConfig = normalizeRateLimitConfig(parsed);
      rlConfigLastFetched = now;
    } catch {
      cachedRlConfig = DEFAULT_RATE_LIMIT;
    }
  }
  return cachedRlConfig;
};

const createRateLimiterMiddleware = (bucketName) => async (c, next) => {
  const now = Date.now();
  const config = await getRateLimitConfig(c);
  const bucket = config[bucketName] || DEFAULT_RATE_LIMIT[bucketName];
  if (!bucket?.enabled) return next();

  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const key = `${bucketName}:${ip}`;
  const windowMs = (bucket.windowMinutes || 1) * 60000;
  const maxReq = bucket.maxRequests || 5;

  if (!ipCache.has(key)) {
    ipCache.set(key, { count: 1, firstRequest: now });
  } else {
    const data = ipCache.get(key);
    if (now - data.firstRequest > windowMs) {
      ipCache.set(key, { count: 1, firstRequest: now });
    } else {
      data.count++;
      if (data.count > maxReq) {
        const errMsg = bucketName === 'email'
          ? 'Limite de envios de e-mail excedido. Aguarde alguns instantes.'
          : 'Limite de requisições de IA excedido. Aguarde alguns instantes.';
        return c.json({ error: errMsg }, 429);
      }
    }
  }

  // Limpeza probabilística do cache de IPs
  if (Math.random() < 0.05) {
    for (const [cacheKey, value] of ipCache.entries()) {
      if (!cacheKey.startsWith(`${bucketName}:`)) continue;
      if (now - value.firstRequest > windowMs) ipCache.delete(cacheKey);
    }
  }
  await next();
};

app.use('/api/ai/public/*', createRateLimiterMiddleware('chatbot'));
app.use('/api/share/email', createRateLimiterMiddleware('email'));
app.use('/api/contact', createRateLimiterMiddleware('email'));
app.use('/api/comment', createRateLimiterMiddleware('email'));

// --- ROTAS DA INTELIGÊNCIA ARTIFICIAL (GEMINI) ---

app.post('/api/ai/transform', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { action, text } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: "GEMINI_API_KEY não configurada no Worker." }, 503);
    if (!text) return c.json({ error: "Texto ausente." }, 400);

    // 1. CONTAGEM DE TOKENS PRÉ-VALIDAÇÃO
    const inputTokens = await estimateTokenCount(text, apiKey);
    const validation = validateInputTokens(inputTokens);
    if (validation.shouldReject) {
      structuredLog('warn', 'Input validation failed', {
        endpoint: 'transform',
        tokenCount: inputTokens,
        limit: GEMINI_CONFIG.maxTokensInput
      });
      return c.json({ error: validation.error }, validation.status);
    }

    let promptContext = "";
    switch (action) {
      case 'summarize': promptContext = "Resuma o seguinte texto de forma concisa e direta, mantendo a formatação e o idioma original:"; break;
      case 'expand': promptContext = "Expanda o seguinte texto, adicionando mais profundidade, contexto e detalhes técnicos, mantendo o idioma original:"; break;
      case 'grammar': promptContext = "Corrija os erros gramaticais e melhore a fluidez e coesão do seguinte texto, sem alterar seu significado central:"; break;
      case 'formal': promptContext = "Reescreva o seguinte texto em um tom estritamente formal, profissional e acadêmico:"; break;
      default: promptContext = "Melhore o seguinte texto:";
    }

    const url = `https://generativelanguage.googleapis.com/${GEMINI_CONFIG.version}/models/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;
    const generationConfig = getGenerationConfig('transform');
    const safetySettings = getModernSafetySettings();

    const requestBody = {
      contents: [{ parts: [{ text: `${promptContext}\n\n"${text}"` }] }],
      generationConfig,
      safetySettings
    };

    // 2. FETCH COM RETRY E LOGGING DETALHADO
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 'transform');

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Falha na API Gemini.");

    // 3. LOGGING DE USAGE METADATA
    const usage = extractUsageMetadata(data);
    structuredLog('info', 'Gemini transform completed', {
      endpoint: 'transform',
      action,
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens
    });

    // 4. EXTRAÇÃO DE TEXTO (MULTI-PART SUPPORT)
    const textContent = data.candidates?.[0]?.content?.parts || [];
    const textParts = extractTextFromParts(textContent);
    const finalText = textParts || textContent[0]?.text || '';

    return c.json({ success: true, text: finalText });
  } catch (err) {
    structuredLog('error', 'Transform endpoint error', {
      endpoint: 'transform',
      error: err.message
    });
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/ai/public/chat', async (c) => {
  try {
    const { message, currentContext, askForDonation } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: "GEMINI_API_KEY não configurada no Worker." }, 503);
    if (!message) return c.json({ error: "Mensagem ausente." }, 400);

    const { results } = await c.env.DB.prepare("SELECT id, title, content, created_at FROM posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC").all();

    const normalizeForSearch = (value = '') => String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const safeMessage = String(message || '').trim();
    const normalizedMessage = normalizeForSearch(safeMessage);
    const terms = [...new Set(
      normalizedMessage
        .split(/[^\p{L}\p{N}]+/u)
        .filter((t) => t.length >= 3)
    )].slice(0, 24);

    const scoredPosts = (Array.isArray(results) ? results : []).map((post) => {
      const title = String(post?.title || '');
      const content = String(post?.content || '');
      const titleNorm = normalizeForSearch(title);
      const contentNorm = normalizeForSearch(content);

      let score = 0;
      if (normalizedMessage && titleNorm.includes(normalizedMessage)) score += 30;
      if (normalizedMessage && contentNorm.includes(normalizedMessage)) score += 15;

      for (const term of terms) {
        if (titleNorm.includes(term)) score += 8;
        if (contentNorm.includes(term)) score += 3;
      }

      return {
        ...post,
        score,
      };
    });

    const relevantPosts = scoredPosts
      .filter((post) => post.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 24);

    const fallbackPosts = scoredPosts.slice(0, 12);
    const contextPosts = relevantPosts.length > 0 ? relevantPosts : fallbackPosts;

    const dbContext = contextPosts
      .map((p) => `ID: ${p.id}\nTÍTULO: ${p.title}\nDATA: ${p.created_at || 'N/A'}\nCONTEÚDO: ${p.content}`)
      .join('\n\n---\n\n');

    const dbCoverageMeta = `ACERVO TOTAL INDEXADO NO BANCO: ${scoredPosts.length} PUBLICAÇÕES. TRECHOS DETALHADOS ENVIADOS AO MODELO NESTA REQUISIÇÃO: ${contextPosts.length}.`;
    const selectedPostAudit = contextPosts.slice(0, 30).map((p) => ({ id: p.id, title: p.title, score: p.score, created_at: p.created_at || null }));

    let activeContextPrompt = "";
    const contextTitleLog = currentContext && currentContext.title ? currentContext.title : "Contexto Geral / Busca Global";

    if (currentContext && currentContext.title) {
      activeContextPrompt = `\nATENÇÃO - CONTEXTO ATIVO: O usuário está atualmente com o seguinte texto aberto na tela:\n[TÍTULO DO TEXTO NA TELA]: ${currentContext.title}\n[CONTEÚDO DO TEXTO NA TELA]: ${currentContext.content}\nSe a pergunta do usuário se referir a "este texto", "o texto", "aqui" ou fizer menções implícitas ao conteúdo visualizado, você DEVE basear sua resposta rigorosa e primariamente no [CONTEXTO ATIVO] acima.\n`;
    }

    let donationPrompt = "";
    if (askForDonation) {
      donationPrompt = `\n\nDIRETIVA DE SUSTENTABILIDADE: O usuário atingiu um nível de engajamento profundo. Ao final da sua resposta, faça um convite muito sutil, elegante e filosófico para que ele apoie financeiramente a infraestrutura e a continuidade deste espaço. Imediatamente após o convite, você DEVE INSERIR a seguinte tag exata e isolada para que o sistema renderize o botão de pagamento: [[PEDIR_DOACAO]]\n`;
    }

    const systemPrompt = `Você é a "Consciência Auxiliar", a inteligência artificial residente do site "Divagações Filosóficas".

DIRETRIZ DE IDENTIDADE (SE PERGUNTADO SOBRE SEU NOME OU QUEM VOCÊ É):
Explique de forma educada, objetiva e filosófica que você se chama "Consciência Auxiliar" porque não é um guru, oráculo ou detentora de verdades absolutas. Você é uma inteligência artificial projetada estritamente para servir de apoio (auxílio) à própria consciência do leitor. Seu papel é atuar como um espelho reflexivo, ajudando o usuário a processar, debater, questionar e aprofundar as abstrações e ensaios presentes no site. Você não tem ego, apenas a função de expandir o debate proposto nos textos.

NOVA DIRETRIZ DE ENCAMINHAMENTO DE MENSAGENS PARA O AUTOR:
Se o leitor manifestar o desejo de enviar um comentário, pergunta ou feedback diretamente para o autor (Leonardo), ou se você, durante a análise, perceber que a dúvida seria melhor respondida pelo autor, ofereça-se ativamente para encaminhar a mensagem.
Se o leitor confirmar a intenção de envio e ditar a mensagem, você OBRIGATORIAMENTE deve adicionar o seguinte bloco delimitador no final da sua resposta:

[[ENVIAR_EMAIL]]
[TRANSCREVA AQUI A MENSAGEM EXATA E REAL DO LEITOR]
[[/ENVIAR_EMAIL]]

ATENÇÃO CRÍTICA: Substitua o texto entre colchetes pela mensagem VERDADEIRA do usuário. NÃO invente textos e NÃO use exemplos genéricos. O sistema interceptará esse bloco, removerá a tag inteira antes de exibir a resposta, e fará o envio de forma invisível. NUNCA revele o endereço de e-mail do autor (lcv@lcv.rio.br).${donationPrompt}

REGRAS GERAIS DE RESPOSTA:
O usuário fará uma pergunta ou busca semântica.${activeContextPrompt}
Como base de conhecimento secundária (para perguntas sobre outros assuntos do site), utilize os textos gerais fornecidos abaixo. 
Se a resposta não estiver em nenhum dos textos, diga educadamente que o site ainda não abordou este tema.
Forneça respostas diretas, limpas e cite o TÍTULO do texto quando for relevante.

${dbCoverageMeta}

TEXTOS GERAIS DO SITE:
${dbContext}

PERGUNTA DO USUÁRIO: ${message}`;

    // 1. CONTAGEM DE TOKENS PRÉ-VALIDAÇÃO
    const inputTokens = await estimateTokenCount(systemPrompt, apiKey);
    const validation = validateInputTokens(inputTokens);
    if (validation.shouldReject) {
      structuredLog('warn', 'Chat input validation failed', {
        endpoint: 'chat',
        tokenCount: inputTokens,
        limit: GEMINI_CONFIG.maxTokensInput
      });
      return c.json({ error: validation.error }, validation.status);
    }

    const url = `https://generativelanguage.googleapis.com/${GEMINI_CONFIG.version}/models/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;
    const generationConfig = getGenerationConfig('chat');
    const safetySettings = getModernSafetySettings();

    const requestBody = {
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig,
      safetySettings
    };

    // 2. FETCH COM RETRY E LOGGING DETALHADO
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 'chat');

    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");

    // 3. LOGGING DE USAGE METADATA
    const usage = extractUsageMetadata(data);
    structuredLog('info', 'Gemini chat completed', {
      endpoint: 'chat',
      context: contextTitleLog,
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens
    });

    // 4. EXTRAÇÃO DE TEXTO (MULTI-PART SUPPORT)
    const textContent = data.candidates?.[0]?.content?.parts || [];
    let replyText = extractTextFromParts(textContent) || textContent[0]?.text || '';

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

        c.executionCtx.waitUntil((async () => {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Consciência Auxiliar <mainsite@lcv.app.br>',
                to: 'lcv@lcv.rio.br',
                subject: `Interação do Leitor no Chatbot: ${contextTitleLog}`,
                html: aiHtml
              })
            });
          } catch (e) { console.error("Falha no disparo do e-mail da IA:", e); }
        })());
      }
      replyText = replyText.replace(emailRegex, '').trim();
    }

    // Registro na Telemetria + Auditoria de Contexto
    const logPromise = c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO chat_logs (role, message, context_title) VALUES ('user', ?, ?)").bind(message, contextTitleLog),
      c.env.DB.prepare("INSERT INTO chat_logs (role, message, context_title) VALUES ('bot', ?, ?)").bind(replyText, contextTitleLog)
    ]);

    const auditPromise = (async () => {
      await c.env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS chat_context_audit (
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

      await c.env.DB.prepare(
        "INSERT INTO chat_context_audit (question, context_title, total_posts_scanned, context_posts_used, selected_posts_json, terms_json) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(
        safeMessage,
        contextTitleLog,
        Number(scoredPosts.length || 0),
        Number(contextPosts.length || 0),
        JSON.stringify(selectedPostAudit),
        JSON.stringify(terms)
      ).run();
    })();

    c.executionCtx.waitUntil(Promise.all([logPromise, auditPromise]));

    return c.json({ success: true, reply: replyText });
  } catch (err) {
    structuredLog('error', 'Chat endpoint error', {
      endpoint: 'chat',
      error: err.message
    });
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/chat-context-audit', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS chat_context_audit (
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

    const { results } = await c.env.DB.prepare("SELECT * FROM chat_context_audit ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/chat-context-audit/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    await c.env.DB.prepare("DELETE FROM chat_context_audit WHERE id = ?").bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/ai/public/summarize', async (c) => {
  try {
    const { text } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: "GEMINI_API_KEY não configurada no Worker." }, 503);
    if (!text) return c.json({ error: "Texto ausente." }, 400);

    // 1. CONTAGEM DE TOKENS PRÉ-VALIDAÇÃO
    const prompt = `Crie um resumo conciso (TL;DR) em um único parágrafo objetivo para o seguinte texto:\n\n${text}`;
    const inputTokens = await estimateTokenCount(prompt, apiKey);
    const validation = validateInputTokens(inputTokens);
    if (validation.shouldReject) {
      structuredLog('warn', 'Summarize input validation failed', {
        endpoint: 'summarize',
        tokenCount: inputTokens,
        limit: GEMINI_CONFIG.maxTokensInput
      });
      return c.json({ error: validation.error }, validation.status);
    }

    const url = `https://generativelanguage.googleapis.com/${GEMINI_CONFIG.version}/models/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;
    const generationConfig = getGenerationConfig('summarize');
    const safetySettings = getModernSafetySettings();

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings
    };

    // 2. FETCH COM RETRY E LOGGING DETALHADO
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 'summarize');

    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");

    // 3. LOGGING DE USAGE METADATA
    const usage = extractUsageMetadata(data);
    structuredLog('info', 'Gemini summarize completed', {
      endpoint: 'summarize',
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens
    });

    // 4. EXTRAÇÃO DE TEXTO (MULTI-PART SUPPORT)
    const textContent = data.candidates?.[0]?.content?.parts || [];
    const textParts = extractTextFromParts(textContent);
    const finalText = textParts || textContent[0]?.text || '';

    return c.json({ success: true, summary: finalText });
  } catch (err) {
    structuredLog('error', 'Summarize endpoint error', {
      endpoint: 'summarize',
      error: err.message
    });
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/ai/public/translate', async (c) => {
  try {
    const { text, lang } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) return c.json({ error: "GEMINI_API_KEY não configurada no Worker." }, 503);
    if (!text || !lang) return c.json({ error: "Parâmetros inválidos." }, 400);

    // 1. CONTAGEM DE TOKENS PRÉ-VALIDAÇÃO
    const prompt = `Traduza rigorosamente o texto abaixo para o idioma: ${lang}. Mantenha qualquer tag HTML ou formatação intacta. Texto:\n\n${text}`;
    const inputTokens = await estimateTokenCount(prompt, apiKey);
    const validation = validateInputTokens(inputTokens);
    if (validation.shouldReject) {
      structuredLog('warn', 'Translate input validation failed', {
        endpoint: 'translate',
        tokenCount: inputTokens,
        limit: GEMINI_CONFIG.maxTokensInput,
        targetLanguage: lang
      });
      return c.json({ error: validation.error }, validation.status);
    }

    const url = `https://generativelanguage.googleapis.com/${GEMINI_CONFIG.version}/models/${GEMINI_CONFIG.model}:generateContent?key=${apiKey}`;
    const generationConfig = getGenerationConfig('translate');
    const safetySettings = getModernSafetySettings();

    const requestBody = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings
    };

    // 2. FETCH COM RETRY E LOGGING DETALHADO
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    }, 'translate');

    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");

    // 3. LOGGING DE USAGE METADATA
    const usage = extractUsageMetadata(data);
    structuredLog('info', 'Gemini translate completed', {
      endpoint: 'translate',
      targetLanguage: lang,
      promptTokens: usage.promptTokens,
      outputTokens: usage.outputTokens,
      cachedTokens: usage.cachedTokens
    });

    // 4. EXTRAÇÃO DE TEXTO (MULTI-PART SUPPORT)
    const textContent = data.candidates?.[0]?.content?.parts || [];
    const textParts = extractTextFromParts(textContent);
    const finalText = textParts || textContent[0]?.text || '';

    return c.json({ success: true, translation: finalText });
  } catch (err) {
    structuredLog('error', 'Translate endpoint error', {
      endpoint: 'translate',
      error: err.message
    });
    return c.json({ error: err.message }, 500);
  }
});

// --- ROTAS DE TELEMETRIA E AUDITORIA (GET / DELETE) ---

app.get('/api/chat-logs', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/chat-logs/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    await c.env.DB.prepare("DELETE FROM chat_logs WHERE id = ?").bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/contact-logs', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM contact_logs ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/contact-logs/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    await c.env.DB.prepare("DELETE FROM contact_logs WHERE id = ?").bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/shares', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM shares ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/shares/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    await c.env.DB.prepare("DELETE FROM shares WHERE id = ?").bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/shares', async (c) => {
  try {
    const { post_id, post_title, platform, target } = await c.req.json();
    await c.env.DB.prepare("INSERT INTO shares (post_id, post_title, platform, target) VALUES (?, ?, ?, ?)").bind(post_id, post_title, platform, target || null).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/share/email', async (c) => {
  try {
    const { post_id, post_title, link, target_email } = await c.req.json();
    if (!c.env.RESEND_API_KEY) throw new Error("Chave do Resend não configurada.");

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Divagações Filosóficas <mainsite@lcv.app.br>',
        to: [target_email],
        subject: `Compartilhamento: ${post_title}`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>Alguém compartilhou uma leitura com você</h2>
                <p><strong>${post_title}</strong></p>
                <a href="${link}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">Ler Texto Completo</a>
               </div>`
      })
    });

    if (!emailRes.ok) throw new Error("Erro no envio pelo Resend.");
    c.executionCtx.waitUntil(c.env.DB.prepare("INSERT INTO shares (post_id, post_title, platform, target) VALUES (?, ?, 'email', ?)").bind(post_id, post_title, target_email).run());
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- ROTAS DE CONTATO E COMENTÁRIOS ---

app.post('/api/contact', async (c) => {
  try {
    const { name, phone, email, message } = await c.req.json();
    if (!name || !email || !message) return c.json({ error: "Dados incompletos" }, 400);

    const resendToken = c.env.RESEND_API_KEY;
    const adminHtml = `
      <div style="font-family: sans-serif; color: #333;">
        <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Novo Contato pelo Site</h2>
        <p><strong>Nome:</strong> ${name}</p>
        <p><strong>Telefone:</strong> ${phone || 'Não informado'}</p>
        <p><strong>E-mail:</strong> ${email}</p>
        <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #000; margin-top: 20px;">
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
      </div>
    `;
    const userHtml = `
      <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #0ea5e9;">Olá, ${name}</h2>
        <p>Recebemos sua mensagem com sucesso através do nosso site. Abaixo está uma cópia do que você nos enviou:</p>
        <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
          <p style="margin: 0; white-space: pre-wrap; font-style: italic;">"${message}"</p>
        </div>
        <p>Em breve entraremos em contato.</p>
        <p>Atenciosamente,<br/><strong>Divagações Filosóficas</strong></p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Authorization': `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Divagações Filosóficas <mainsite@lcv.app.br>', to: 'lcv@lcv.rio.br', subject: `Novo Contato de ${name}`, html: adminHtml })
    });

    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Authorization': `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Divagações Filosóficas <mainsite@lcv.app.br>', to: email, subject: 'Recebemos sua mensagem', html: userHtml })
    });

    c.executionCtx.waitUntil(c.env.DB.prepare("INSERT INTO contact_logs (name, phone, email, message) VALUES (?, ?, ?, ?)").bind(name, phone || '', email, message).run());
    return c.json({ success: true });
  } catch (err) { return c.json({ error: "Falha ao processar contato." }, 500); }
});

app.post('/api/comment', async (c) => {
  try {
    const { name, phone, email, message, post_title } = await c.req.json();
    if (!message) return c.json({ error: "Comentário obrigatório" }, 400);

    const adminHtml = `
      <div style="font-family: sans-serif; color: #333;">
        <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Novo Comentário no Site</h2>
        <p><strong>Texto/Contexto:</strong> ${post_title || 'N/A'}</p>
        <p><strong>Nome:</strong> ${name || 'Não informado'}</p>
        <p><strong>Telefone:</strong> ${phone || 'Não informado'}</p>
        <p><strong>E-mail:</strong> ${email || 'Não informado'}</p>
        <div style="background: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; margin-top: 20px;">
          <p style="margin: 0; white-space: pre-wrap;">${message}</p>
        </div>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Divagações Filosóficas <mainsite@lcv.app.br>', to: 'lcv@lcv.rio.br', subject: `Novo Comentário: ${post_title || 'Geral'}`, html: adminHtml })
    });

    return c.json({ success: true });
  } catch (err) { return c.json({ error: "Falha ao processar comentário." }, 500); }
});

// --- ROTAS FINANCEIRAS / MERCADO PAGO (ZERO TRUST) ---

const normalizeSumupStatus = (status) => {
  const s = String(status || '').trim().toUpperCase();
  if (!s) return 'UNKNOWN';

  const map = {
    PAID: 'SUCCESSFUL',
    APPROVED: 'SUCCESSFUL',
    SUCCESSFUL: 'SUCCESSFUL',
    PENDING: 'PENDING',
    IN_PROCESS: 'PENDING',
    PROCESSING: 'PENDING',
    FAILED: 'FAILED',
    FAILURE: 'FAILED',
    EXPIRED: 'EXPIRED',
    REFUNDED: 'REFUNDED',
    PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    CANCELED: 'CANCELLED',
    CANCEL: 'CANCELLED',
    CANCELLED: 'CANCELLED',
    CHARGEBACK: 'CHARGE_BACK',
    CHARGE_BACK: 'CHARGE_BACK',
  };

  return map[s] || s;
};

const FINANCIAL_CUTOFF_BRT = '2026-03-01T00:00:00-03:00';
const FINANCIAL_CUTOFF_DATE = '2026-03-01';
const FINANCIAL_CUTOFF_UTC = new Date(FINANCIAL_CUTOFF_BRT);
const FINANCIAL_CUTOFF_ISO = FINANCIAL_CUTOFF_UTC.toISOString();
const FINANCIAL_CUTOFF_DB_UTC = FINANCIAL_CUTOFF_ISO.slice(0, 19).replace('T', ' ');

const getStartIsoWithCutoff = (rawDate) => {
  if (!rawDate) return FINANCIAL_CUTOFF_ISO;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return FINANCIAL_CUTOFF_ISO;
  return parsed.getTime() < FINANCIAL_CUTOFF_UTC.getTime() ? FINANCIAL_CUTOFF_ISO : parsed.toISOString();
};

const toDbDateTime = (isoString) => isoString.slice(0, 19).replace('T', ' ');
const getStartDbWithCutoff = (rawDate) => toDbDateTime(getStartIsoWithCutoff(rawDate));

const isOnOrAfterCutoff = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() >= FINANCIAL_CUTOFF_UTC.getTime();
};

app.post('/api/sumup/checkout', async (c) => {
  try {
    const { amount, firstName, lastName, email } = await c.req.json();
    if (!amount || Number(amount) <= 0) return c.json({ error: 'Valor inválido para checkout SumUp.' }, 400);

    const sumupToken = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!sumupToken || !merchantCode) {
      return c.json({ error: 'SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE não configurados.' }, 503);
    }

    const client = new SumUp({ apiKey: sumupToken });
    
    const checkoutReference = `SUMUP-DON-${crypto.randomUUID()}`;
    const fullName = `${(firstName || '').trim()} ${(lastName || '').trim()}`.trim() || 'Doador';

    const checkout = await client.checkouts.create({
      checkout_reference: checkoutReference,
      amount: Number(amount),
      currency: 'BRL',
      merchant_code: merchantCode,
      description: `Doação de ${fullName} - Divagações Filosóficas`,
    });

    return c.json({
      checkoutId: checkout.id,
      checkoutReference,
    }, 201);
  } catch (err) {
    console.error('Erro ao criar checkout SumUp:', err);
    return c.json({ error: err.message || 'Falha ao iniciar checkout SumUp.' }, 500);
  }
});

app.post('/api/sumup/checkout/:id/pay', async (c) => {
  try {
    const checkoutId = c.req.param('id');
    const { amount, card, firstName, lastName, email, document } = await c.req.json();

    if (!checkoutId) return c.json({ error: 'Checkout inválido.' }, 400);
    if (!amount || Number(amount) <= 0) return c.json({ error: 'Valor inválido para pagamento SumUp.' }, 400);
    if (!card?.name || !card?.number || !card?.expiryMonth || !card?.expiryYear || !card?.cvv) {
      return c.json({ error: 'Dados de cartão incompletos.' }, 400);
    }

    const sumupToken = c.env.SUMUP_API_KEY_PRIVATE;
    if (!sumupToken) return c.json({ error: 'SUMUP_API_KEY_PRIVATE não configurada.' }, 503);

    const client = new SumUp({ apiKey: sumupToken });

    const cardData = {
      number: card.number.replace(/\s/g, ''),
      expiry_month: String(card.expiryMonth).padStart(2, '0'),
      expiry_year: `20${card.expiryYear}`,
      cvv: card.cvv,
      name: card.name.trim(),
    };

    const payload = {
      payment_type: 'card',
      card: cardData,
      personal_details: {
        first_name: (firstName || '').trim() || undefined,
        last_name: (lastName || '').trim() || undefined,
        email: (email || '').trim() || undefined,
        tax_id: (document || '').trim() || undefined,
      },
    };

    // Processa o checkout com os dados de cartão
    let result;
    try {
      result = await client.checkouts.process(checkoutId, payload);
    } catch (updateErr) {
      // Se falhar na atualização, registra tentativa fracassada
      const failedEmail = (email || '').trim() || 'N/A';
      c.executionCtx.waitUntil(
        c.env.DB.prepare(
          "INSERT INTO financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(checkoutId, 'FAILED', Number(amount), 'sumup_card', failedEmail, JSON.stringify({ error: updateErr.message })).run()
      );
      // Extrai mensagem do SumUp SDK: formato "STATUS_CODE: {json}"
      const rawMsg = updateErr.message || '';
      const sdkMatch = rawMsg.match(/^(\d{3}):\s*(.+)$/s);
      let userMessage = rawMsg;
      let httpStatus = 500;
      if (sdkMatch) {
        const sdkStatus = parseInt(sdkMatch[1], 10);
        httpStatus = sdkStatus >= 400 && sdkStatus < 500 ? 422 : 500;
        try {
          const parsed = JSON.parse(sdkMatch[2]);
          userMessage = parsed.message || rawMsg;
        } catch { userMessage = sdkMatch[2] || rawMsg; }
      }
      return c.json({ error: userMessage }, httpStatus);
    }

    // Extrai o transaction ID se disponível
    const transactionId = result.transactions?.[0]?.id;
    const storedId = transactionId || result.id || checkoutId;

    const payerEmail = (email || '').trim() || 'N/A';
    const storedStatus = normalizeSumupStatus(result.status || 'SUCCESSFUL');
    c.executionCtx.waitUntil(
      c.env.DB.prepare(
        "INSERT INTO financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(storedId, storedStatus, Number(amount), 'sumup_card', payerEmail, JSON.stringify(result)).run()
    );

    return c.json({ success: true, id: storedId, status: storedStatus });
  } catch (err) {
    console.error('Erro ao processar pagamento SumUp:', err);
    return c.json({ error: err.message || 'Falha no pagamento SumUp.' }, 500);
  }
});

app.get('/api/sumup/payment-methods', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const amountRaw = Number(c.req.query('amount'));
    const amount = Number.isFinite(amountRaw) && amountRaw > 0 ? amountRaw : 10;
    const currency = (c.req.query('currency') || 'BRL').toUpperCase();

    const client = new SumUp({ apiKey: token });
    const data = await client.checkouts.listAvailablePaymentMethods(merchantCode, { amount, currency });
    const methods = Array.isArray(data?.available_payment_methods)
      ? data.available_payment_methods.map(m => m.id).filter(Boolean)
      : [];

    return c.json({ success: true, amount, currency, methods });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao listar métodos de pagamento SumUp.' }, 500);
  }
});

app.get('/api/sumup/transactions-summary', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

    const changesSince = getStartIsoWithCutoff(c.req.query('changes_since') || c.req.query('start_date'));

    const client = new SumUp({ apiKey: token });
    const txData = await client.transactions.list(merchantCode, {
      order: 'descending',
      limit,
      changes_since: changesSince,
    });
    const rawItems = Array.isArray(txData?.items) ? txData.items : [];
    const items = rawItems.filter((tx) => isOnOrAfterCutoff(tx?.timestamp));

    const byStatus = {};
    const byType = {};
    let totalAmount = 0;
    for (const tx of items) {
      const status = (tx?.status || 'UNKNOWN').toUpperCase();
      const type = (tx?.type || 'UNKNOWN').toUpperCase();
      const amount = Number(tx?.amount || 0);

      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      totalAmount += amount;
    }

    return c.json({
      success: true,
      scanned: items.length,
      limit,
      totalAmount,
      byStatus,
      byType,
      hasMore: Array.isArray(txData?.links) && txData.links.length > 0,
    });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao resumir transações SumUp.' }, 500);
  }
});

app.get('/api/sumup/transactions-advanced', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const parseList = (value) => String(value || '')
      .split(',')
      .map(v => v.trim())
      .filter(Boolean);

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const order = c.req.query('order') === 'ascending' ? 'ascending' : 'descending';

    const statusMap = {
      successful: 'SUCCESSFUL',
      cancelled: 'CANCELLED',
      failed: 'FAILED',
      refunded: 'REFUNDED',
      charge_back: 'CHARGE_BACK',
      chargeback: 'CHARGE_BACK',
    };
    const typeMap = {
      payment: 'PAYMENT',
      refund: 'REFUND',
      charge_back: 'CHARGE_BACK',
      chargeback: 'CHARGE_BACK',
    };

    const allowedStatuses = new Set(['SUCCESSFUL', 'CANCELLED', 'FAILED', 'REFUNDED', 'CHARGE_BACK']);
    const statuses = parseList(c.req.query('statuses'))
      .map(s => statusMap[s.toLowerCase()] || s.toUpperCase())
      .filter(s => allowedStatuses.has(s));
    const types = parseList(c.req.query('types'))
      .map(t => typeMap[t.toLowerCase()] || t.toUpperCase())
      .filter(Boolean);
    const paymentTypes = parseList(c.req.query('payment_types'))
      .map(v => v.toUpperCase());
    const users = parseList(c.req.query('users'));

    const query = { order, limit };
    if (statuses.length) query['statuses[]'] = statuses;
    if (types.length) query.types = types;
    if (paymentTypes.length) query.payment_types = paymentTypes;
    if (users.length) query.users = users;

    const changesSince = getStartIsoWithCutoff(c.req.query('changes_since') || c.req.query('start_date'));
    query.changes_since = changesSince;

    const newestTime = c.req.query('newest_time');
    const newestRef = c.req.query('newest_ref');
    const oldestTime = c.req.query('oldest_time');
    const oldestRef = c.req.query('oldest_ref');
    if (newestTime) query.newest_time = newestTime;
    if (newestRef) query.newest_ref = newestRef;
    if (oldestTime) query.oldest_time = oldestTime;
    if (oldestRef) query.oldest_ref = oldestRef;

    const client = new SumUp({ apiKey: token });
    const txData = await client.transactions.list(merchantCode, query);
    const items = Array.isArray(txData?.items) ? txData.items : [];

    const normalized = items.map(tx => ({
      id: tx?.id || tx?.transaction_id || null,
      transactionCode: tx?.transaction_code || null,
      amount: Number(tx?.amount || 0),
      currency: tx?.currency || 'BRL',
      status: tx?.status || 'UNKNOWN',
      type: tx?.type || 'UNKNOWN',
      paymentType: tx?.payment_type || 'UNKNOWN',
      cardType: tx?.card_type || null,
      timestamp: tx?.timestamp || null,
      user: tx?.user || null,
      refundedAmount: Number(tx?.refunded_amount || 0),
    }));
    const filteredByDate = normalized.filter((tx) => isOnOrAfterCutoff(tx?.timestamp));

    const pickCursor = (href) => {
      try {
        const url = new URL(href);
        const params = url.searchParams;
        const cursor = {};
        const nt = params.get('newest_time');
        const nr = params.get('newest_ref');
        const ot = params.get('oldest_time');
        const orf = params.get('oldest_ref');
        if (nt) cursor.newest_time = nt;
        if (nr) cursor.newest_ref = nr;
        if (ot) cursor.oldest_time = ot;
        if (orf) cursor.oldest_ref = orf;
        return Object.keys(cursor).length ? cursor : null;
      } catch {
        return null;
      }
    };

    const links = Array.isArray(txData?.links) ? txData.links : [];
    let nextCursor = null;
    let prevCursor = null;
    for (const link of links) {
      const rel = String(link?.rel || '').toLowerCase();
      const href = link?.href;
      if (!href) continue;
      if (!nextCursor && rel.includes('next')) nextCursor = pickCursor(href);
      if (!prevCursor && (rel.includes('prev') || rel.includes('previous'))) prevCursor = pickCursor(href);
    }

    return c.json({
      success: true,
      query: {
        order,
        limit,
        statuses,
        types,
        paymentTypes,
        users,
        changesSince: changesSince || null,
        newestTime: newestTime || null,
        newestRef: newestRef || null,
        oldestTime: oldestTime || null,
        oldestRef: oldestRef || null,
      },
      total: filteredByDate.length,
      hasMore: Array.isArray(txData?.links) && txData.links.length > 0,
      cursors: {
        next: nextCursor,
        prev: prevCursor,
      },
      items: filteredByDate,
    });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao listar transações avançadas SumUp.' }, 500);
  }
});

app.get('/api/sumup/payouts-summary', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    const merchantCode = c.env.SUMUP_MERCHANT_CODE;
    if (!token || !merchantCode) throw new Error('SUMUP_API_KEY_PRIVATE ou SUMUP_MERCHANT_CODE ausentes.');

    const now = new Date();
    const requestedStartDate = c.req.query('start_date') || FINANCIAL_CUTOFF_DATE;
    const startDate = requestedStartDate < FINANCIAL_CUTOFF_DATE ? FINANCIAL_CUTOFF_DATE : requestedStartDate;
    const endDate = c.req.query('end_date') || now.toISOString().slice(0, 10);

    const client = new SumUp({ apiKey: token });
    const payouts = await client.payouts.list(merchantCode, {
      start_date: startDate,
      end_date: endDate,
      order: 'desc',
      limit: 100,
    });

    const list = Array.isArray(payouts) ? payouts : [];
    let totalAmount = 0;
    let totalFee = 0;
    const byStatus = {};

    for (const p of list) {
      totalAmount += Number(p?.amount || 0);
      totalFee += Number(p?.fee || 0);
      const status = (p?.status || 'UNKNOWN').toUpperCase();
      byStatus[status] = (byStatus[status] || 0) + 1;
    }

    return c.json({
      success: true,
      startDate,
      endDate,
      count: list.length,
      totalAmount,
      totalFee,
      byStatus,
    });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao resumir payouts SumUp.' }, 500);
  }
});

app.get('/api/mp/payment-methods', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentMethodApi = new PaymentMethod(client);
    const methodsRaw = await paymentMethodApi.get();
    const methodsList = Array.isArray(methodsRaw) ? methodsRaw : [];

    const methods = [...new Set(methodsList.map((m) => m?.id).filter(Boolean))];
    const types = [...new Set(methodsList.map((m) => m?.payment_type_id).filter(Boolean))];
    const methodAssets = methodsList.reduce((acc, m) => {
      const id = String(m?.id || '').trim();
      if (!id) return acc;
      acc[id] = {
        label: m?.name || id.toUpperCase(),
        image: m?.secure_thumbnail || m?.thumbnail || null,
      };
      return acc;
    }, {});

    return c.json({
      success: true,
      scanned: methodsList.length,
      methods,
      types,
      methodAssets,
    });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao listar métodos Mercado Pago.' }, 500);
  }
});

app.get('/api/mp/transactions-summary', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;

    const now = new Date();
    const begin_date = getStartIsoWithCutoff(c.req.query('begin_date') || c.req.query('start_date'));
    const end_date = c.req.query('end_date') ? new Date(c.req.query('end_date')).toISOString() : now.toISOString();

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);
    const payload = await paymentApi.search({
      options: {
        sort: 'date_created',
        criteria: 'desc',
        range: 'date_created',
        begin_date,
        end_date,
        limit,
        offset: 0,
      },
    });

    const items = Array.isArray(payload?.results) ? payload.results : [];
    const byStatus = {};
    const byType = {};
    let totalAmount = 0;
    let totalNetAmount = 0;

    for (const tx of items) {
      const status = String(tx?.status || 'unknown').toUpperCase();
      const type = String(tx?.payment_type_id || 'unknown').toUpperCase();
      const amount = Number(tx?.transaction_amount || 0);
      const net = Number(tx?.transaction_details?.net_received_amount || 0);

      byStatus[status] = (byStatus[status] || 0) + 1;
      byType[type] = (byType[type] || 0) + 1;
      totalAmount += amount;
      totalNetAmount += net;
    }

    return c.json({
      success: true,
      scanned: items.length,
      limit,
      totalAmount,
      totalNetAmount,
      byStatus,
      byType,
      paging: payload?.paging || { total: 0, limit, offset: 0 },
    });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao resumir transações Mercado Pago.' }, 500);
  }
});

app.get('/api/mp/transactions-advanced', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const parseList = (value) => String(value || '')
      .split(',')
      .map(v => v.trim().toLowerCase())
      .filter(Boolean);

    const limitRaw = Number(c.req.query('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const offsetRaw = Number(c.req.query('offset'));
    const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
    const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

    const statuses = parseList(c.req.query('statuses'));
    const types = parseList(c.req.query('types'));

    const now = new Date();
    const begin_date = getStartIsoWithCutoff(c.req.query('begin_date') || c.req.query('start_date'));
    const end_date = c.req.query('end_date') ? new Date(c.req.query('end_date')).toISOString() : now.toISOString();

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);
    const payload = await paymentApi.search({
      options: {
        sort: 'date_created',
        criteria: order,
        range: 'date_created',
        begin_date,
        end_date,
        limit,
        offset,
      },
    });

    const items = Array.isArray(payload?.results) ? payload.results : [];
    const normalized = items.map((tx) => ({
      id: tx?.id || null,
      transactionCode: tx?.authorization_code || null,
      amount: Number(tx?.transaction_amount || 0),
      currency: tx?.currency_id || 'BRL',
      status: tx?.status || 'unknown',
      type: tx?.payment_type_id || 'unknown',
      paymentType: tx?.payment_method_id || 'unknown',
      cardType: tx?.card?.last_four_digits ? `**** ${tx.card.last_four_digits}` : null,
      timestamp: tx?.date_created || null,
      user: tx?.payer?.email || tx?.payer?.id || null,
      refundedAmount: Number(tx?.transaction_amount_refunded || 0),
    }));

    const filtered = normalized.filter((tx) => {
      const statusOk = !statuses.length || statuses.includes(String(tx.status || '').toLowerCase());
      const typeOk = !types.length || types.includes(String(tx.type || '').toLowerCase());
      return statusOk && typeOk;
    });

    const paging = payload?.paging || { total: 0, limit, offset };
    const totalRaw = Number(paging?.total || 0);
    const hasPrev = offset > 0;
    const hasNext = (offset + limit) < totalRaw;

    return c.json({
      success: true,
      query: {
        order,
        limit,
        offset,
        statuses,
        types,
      },
      paging: {
        total: totalRaw,
        limit,
        offset,
        hasPrev,
        hasNext,
        prevOffset: hasPrev ? Math.max(0, offset - limit) : null,
        nextOffset: hasNext ? offset + limit : null,
      },
      scanned: normalized.length,
      totalFiltered: filtered.length,
      items: filtered,
    });
  } catch (err) {
    return c.json({ error: err.message || 'Falha ao listar transações avançadas Mercado Pago.' }, 500);
  }
});

app.post('/api/mp-payment', async (c) => {
  try {
    const body = await c.req.json();
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("MP_ACCESS_TOKEN ausente.");

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);

    const extRef = `DON-${crypto.randomUUID()}`;
    const realFirstName = body.payer?.first_name;
    const realLastName = body.payer?.last_name;

    if (!realFirstName || !realLastName) {
      return c.json({ error: "Nome e sobrenome reais são obrigatórios para validação antifraude." }, 400);
    }

    const donorFullName = `${realFirstName} ${realLastName}`.trim();
    const donationDescriptor = `Doação de ${donorFullName} - Divagações Filosóficas`;

    const enhancedPayload = {
      ...body,
      description: donationDescriptor,
      external_reference: extRef,
      statement_descriptor: "DIVAGAC FILOSOF",
      notification_url: "https://mainsite-app.lcv.rio.br/api/webhooks/mercadopago",
      payer: {
        ...(body.payer || {}),
        first_name: realFirstName,
        last_name: realLastName
      },
      additional_info: {
        items: [
          {
            id: "DONATION-01",
            title: donationDescriptor,
            description: donationDescriptor,
            category_id: "donations",
            quantity: 1,
            unit_price: Number(body.transaction_amount)
          }
        ],
        payer: {
          first_name: realFirstName,
          last_name: realLastName,
          phone: { area_code: "21", number: "999999999" },
          address: { street_name: "Av. Principal", street_number: 1, zip_code: "00000000" }
        }
      }
    };

    const data = await paymentApi.create({
      body: enhancedPayload,
      requestOptions: { idempotencyKey: crypto.randomUUID() }
    });

    return c.json(data, 201);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/mp-balance', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const available = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) AND lower(status) = 'approved'"
    ).bind(startDb).first();
    const unavailable = await c.env.DB.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) AND lower(status) IN ('pending', 'in_process')"
    ).bind(startDb).first();
    return c.json({
      available_balance: Number(available?.total || 0),
      unavailable_balance: Number(unavailable?.total || 0),
    });
  } catch (err) {
    return c.json({ available_balance: 0, unavailable_balance: 0 });
  }
});

app.post('/api/mp-payment/:id/refund', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("MP_ACCESS_TOKEN ausente.");

    const client = new MercadoPagoConfig({ accessToken: token });
    const refundApi = new PaymentRefund(client);

    let refundBody = { payment_id: id };

    try {
      const body = await c.req.json();
      if (body.amount) refundBody.body = { amount: Number(body.amount) };
    } catch (e) { }

    await refundApi.create(refundBody);

    const newStatus = refundBody.body?.amount ? 'partially_refunded' : 'refunded';
    await c.env.DB.prepare("UPDATE financial_logs SET status = ? WHERE payment_id = ?").bind(newStatus, id).run();

    return c.json({ success: true, status: newStatus });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/mp-payment/:id/cancel', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("MP_ACCESS_TOKEN ausente.");

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);

    await paymentApi.cancel({ id: id });

    await c.env.DB.prepare("UPDATE financial_logs SET status = 'cancelled' WHERE payment_id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/webhooks/mercadopago', async (c) => {
  try {
    const url = new URL(c.req.url);
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    const id = url.searchParams.get('id') || url.searchParams.get('data.id');

    if (!id || (topic !== 'payment' && topic !== 'payment.created' && topic !== 'payment.updated')) {
      return c.text('OK', 200);
    }

    const mpToken = c.env.MP_ACCESS_TOKEN;
    let paymentData = {};

    if (mpToken) {
      const client = new MercadoPagoConfig({ accessToken: mpToken });
      const paymentApi = new Payment(client);
      paymentData = await paymentApi.get({ id: id });
    }

    const status = paymentData.status || 'Desconhecido';
    const amount = paymentData.transaction_amount || 0;
    const email = paymentData.payer?.email || 'N/A';
    const method = paymentData.payment_method_id || 'N/A';
    const extRef = paymentData.external_reference || 'N/A';

    const existing = await c.env.DB.prepare("SELECT id, status FROM financial_logs WHERE payment_id = ?").bind(id).first();
    let shouldSendEmail = false;

    if (!existing) {
      shouldSendEmail = true;
      c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, status, amount, method, email, JSON.stringify(paymentData)).run()
      );
    } else {
      if (existing.status !== status) shouldSendEmail = true;
      c.executionCtx.waitUntil(
        c.env.DB.prepare("UPDATE financial_logs SET status = ?, amount = ?, method = ?, payer_email = ?, raw_payload = ? WHERE payment_id = ?")
          .bind(status, amount, method, email, JSON.stringify(paymentData), id).run()
      );
    }

    if (shouldSendEmail && c.env.RESEND_API_KEY) {
      const htmlMsg = `
        <div style="font-family: sans-serif; color: #333;">
          <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Notificação de Pagamento (Mercado Pago)</h2>
          <p><strong>ID da Transação:</strong> ${id}</p>
          <p><strong>Referência Interna:</strong> ${extRef}</p>
          <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;"><strong>Status: <span style="color: ${status === 'approved' ? '#10b981' : (status === 'refunded' ? '#ef4444' : '#f59e0b')}">${status.toUpperCase()}</span></strong></p>
            <p style="margin: 10px 0 0 0;">Valor: R$ ${amount.toFixed(2)}</p>
          </div>
          <p><strong>Método Utilizado:</strong> ${method.toUpperCase()}</p>
          <p><strong>E-mail do Apoiador:</strong> ${email}</p>
        </div>
      `;

      c.executionCtx.waitUntil(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Financeiro do Site <mainsite@lcv.app.br>', to: 'lcv@lcv.rio.br', subject: `[MP Webhook] Pagamento ${status.toUpperCase()} - R$${amount}`, html: htmlMsg })
        })
      );
    }

    return c.text('OK', 200);
  } catch (e) { return c.text('Erro interno no Webhook', 500); }
});

app.get('/api/financial-logs', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const { results } = await c.env.DB.prepare("SELECT * FROM financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) ORDER BY created_at DESC LIMIT 100").bind(startDb).all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/financial-logs/check', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const result = await c.env.DB.prepare("SELECT COUNT(*) as total FROM financial_logs WHERE (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?)").bind(startDb).first();
    return c.json({ count: result.total });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/financial-logs/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare("DELETE FROM financial_logs WHERE id = ? AND (method IS NULL OR method != 'sumup_card')").bind(id).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// Sincroniza pagamentos recentes do Mercado Pago com o banco local.
// Útil para recuperar transações que não passaram pelo webhook ou atualizar status pendentes.
app.post('/api/mp/sync', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error('MP_ACCESS_TOKEN ausente.');

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);

    // 1) Atualiza primeiro tudo o que já existe no banco local.
    const { results: localLogs = [] } = await c.env.DB.prepare(
      "SELECT payment_id FROM financial_logs WHERE payment_id IS NOT NULL AND (method IS NULL OR method != 'sumup_card') AND datetime(created_at) >= datetime(?) ORDER BY created_at DESC LIMIT 100"
    ).bind(FINANCIAL_CUTOFF_DB_UTC).all();

    let inserted = 0;
    let updated = 0;
    let tracked = 0;

    for (const log of localLogs) {
      const paymentId = String(log.payment_id || '').trim();
      if (!paymentId) continue;

      try {
        const paymentData = await paymentApi.get({ id: paymentId });
        const status = (paymentData.status || 'unknown').toLowerCase();
        const amount = Number(paymentData.transaction_amount || 0);
        const email = paymentData.payer?.email || 'N/A';
        const method = paymentData.payment_method_id || 'N/A';
        const raw = JSON.stringify(paymentData);

        await c.env.DB.prepare(
          "UPDATE financial_logs SET status = ?, amount = ?, method = ?, payer_email = ?, raw_payload = ? WHERE payment_id = ? AND (method IS NULL OR method != 'sumup_card')"
        ).bind(status, amount, method, email, raw, paymentId).run();

        tracked++;
        updated++;
      } catch {
        // Segue sincronização dos demais registros mesmo se um pagamento falhar.
      }
    }

    // 2) Busca ampla no MP é opcional: se der erro, não bloqueia o painel.
    let scanned = localLogs.length;
    try {
      const payload = await paymentApi.search({
        options: {
          sort: 'date_created',
          criteria: 'desc',
          range: 'date_created',
          begin_date: FINANCIAL_CUTOFF_ISO,
          end_date: new Date().toISOString(),
          limit: 100,
        },
      });

      const payments = Array.isArray(payload?.results) ? payload.results : [];
      scanned = payments.length;

      for (const paymentData of payments) {
        const paymentId = String(paymentData.id || '').trim();
        if (!paymentId) continue;

        const externalRef = String(paymentData.external_reference || '').trim();
        const description = String(paymentData.description || '').toLowerCase();
        const looksLikeSiteDonation = externalRef.startsWith('DON-') || description.includes('divagações filosóficas') || description.includes('divagacoes filosoficas');
        if (!looksLikeSiteDonation) continue;

        const existing = await c.env.DB.prepare(
          "SELECT id FROM financial_logs WHERE payment_id = ? AND (method IS NULL OR method != 'sumup_card') LIMIT 1"
        ).bind(paymentId).first();

        if (existing) continue;

        const status = (paymentData.status || 'unknown').toLowerCase();
        const amount = Number(paymentData.transaction_amount || 0);
        const email = paymentData.payer?.email || 'N/A';
        const method = paymentData.payment_method_id || 'N/A';
        const raw = JSON.stringify(paymentData);

        await c.env.DB.prepare(
          "INSERT INTO financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(paymentId, status, amount, method, email, raw).run();

        inserted++;
      }
    } catch {
      // Busca ampla é melhor esforço; a sincronização local já atende o painel.
    }

    return c.json({ success: true, inserted, updated, total: tracked + inserted, scanned });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// --- ROTAS ADMINISTRATIVAS SUMUP (PAINEL FINANCEIRO) ---

// Sincroniza checkouts históricos da SumUp com o banco local.
// Útil para recuperar transações que não foram gravadas (ex: falhas anteriores ao fix).
app.post('/api/sumup/sync', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    if (!token) throw new Error('SUMUP_API_KEY_PRIVATE ausente.');

    const client = new SumUp({ apiKey: token });

    const checkouts = await client.checkouts.list();
    if (!Array.isArray(checkouts)) throw new Error('Resposta inesperada da SumUp.');

    let inserted = 0, updated = 0;
    for (const checkout of checkouts) {
      const tx = checkout.transactions?.[0];
      const sourceTimestamp = tx?.timestamp || checkout?.timestamp || checkout?.date || checkout?.created_at || null;
      if (sourceTimestamp && !isOnOrAfterCutoff(sourceTimestamp)) continue;
      // Usa transaction UUID quando disponível (pagamentos concluídos),
      // senão usa o checkout UUID (tentativas sem transação confirmada).
      const paymentId = tx?.id || checkout.id;
      const status = normalizeSumupStatus(tx?.status || checkout.status || 'UNKNOWN');
      const amount = Number(checkout.amount || 0);
      const raw = JSON.stringify(tx ? checkout : checkout);

      const existing = await c.env.DB.prepare(
        "SELECT id FROM financial_logs WHERE payment_id = ? AND method = 'sumup_card' LIMIT 1"
      ).bind(paymentId).first();

      if (existing) {
        await c.env.DB.prepare(
          "UPDATE financial_logs SET status = ?, raw_payload = ? WHERE payment_id = ? AND method = 'sumup_card'"
        ).bind(status, raw, paymentId).run();
        updated++;
      } else {
        await c.env.DB.prepare(
          "INSERT INTO financial_logs (payment_id, status, amount, method, payer_email, raw_payload) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(paymentId, status, amount, 'sumup_card', 'N/A', raw).run();
        inserted++;
      }
    }

    return c.json({ success: true, inserted, updated, total: checkouts.length });
  } catch (err) {
    console.error('Erro ao sincronizar checkouts SumUp:', err);
    return c.json({ error: err.message }, 500);
  }
});

// Reindexa TODOS os registros SumUp do DB1 para status canônico do SDK.
// Útil para corrigir dados legados (paid/approved/pending/refunded em formatos mistos).
app.post('/api/sumup/reindex-statuses', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: '401' }, 401);
  try {
    let scanned = 0;
    let updated = 0;
    let offset = 0;
    const pageSize = 500;

    while (true) {
      const { results } = await c.env.DB.prepare(
        "SELECT id, status, raw_payload FROM financial_logs WHERE method = 'sumup_card' ORDER BY id ASC LIMIT ? OFFSET ?"
      ).bind(pageSize, offset).all();

      const rows = Array.isArray(results) ? results : [];
      if (!rows.length) break;

      for (const row of rows) {
        scanned++;

        let payloadStatus = null;
        try {
          const payload = row?.raw_payload ? JSON.parse(row.raw_payload) : null;
          payloadStatus = payload?.transactions?.[0]?.status || payload?.transaction?.status || payload?.status || null;
        } catch {
          payloadStatus = null;
        }

        const nextStatus = normalizeSumupStatus(payloadStatus || row?.status || 'UNKNOWN');
        if (nextStatus !== row?.status) {
          await c.env.DB.prepare(
            "UPDATE financial_logs SET status = ? WHERE id = ? AND method = 'sumup_card'"
          ).bind(nextStatus, row.id).run();
          updated++;
        }
      }

      if (rows.length < pageSize) break;
      offset += pageSize;
    }

    return c.json({ success: true, scanned, updated });
  } catch (err) {
    console.error('Erro ao reindexar status SumUp:', err);
    return c.json({ error: err.message || 'Falha ao reindexar status SumUp.' }, 500);
  }
});

app.get('/api/sumup-financial-logs', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const { results } = await c.env.DB.prepare("SELECT * FROM financial_logs WHERE method = 'sumup_card' AND datetime(created_at) >= datetime(?) ORDER BY created_at DESC LIMIT 100").bind(startDb).all();
    const rows = Array.isArray(results) ? results : [];
    const normalizedRows = rows.map((row) => {
      let payloadStatus = null;
      try {
        const payload = row?.raw_payload ? JSON.parse(row.raw_payload) : null;
        payloadStatus = payload?.transactions?.[0]?.status || payload?.transaction?.status || payload?.status || null;
      } catch {
        payloadStatus = null;
      }

      const normalizedStatus = normalizeSumupStatus(payloadStatus || row?.status || 'UNKNOWN');
      if (row?.id && normalizedStatus !== row?.status) {
        c.executionCtx.waitUntil(
          c.env.DB.prepare("UPDATE financial_logs SET status = ? WHERE id = ? AND method = 'sumup_card'")
            .bind(normalizedStatus, row.id)
            .run()
        );
      }

      return {
        ...row,
        status: normalizedStatus,
      };
    });

    return c.json(normalizedRows);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/sumup-financial-logs/check', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const result = await c.env.DB.prepare("SELECT COUNT(*) as total FROM financial_logs WHERE method = 'sumup_card' AND datetime(created_at) >= datetime(?)").bind(startDb).first();
    return c.json({ count: result.total });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/sumup-financial-logs/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare("DELETE FROM financial_logs WHERE id = ? AND method = 'sumup_card'").bind(id).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/sumup-balance', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const startDb = getStartDbWithCutoff(c.req.query('start_date'));
    const available = await c.env.DB.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_logs WHERE method = 'sumup_card' AND datetime(created_at) >= datetime(?) AND UPPER(status) = 'SUCCESSFUL'").bind(startDb).first();
    const unavailable = await c.env.DB.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM financial_logs WHERE method = 'sumup_card' AND datetime(created_at) >= datetime(?) AND UPPER(status) = 'PENDING'").bind(startDb).first();
    return c.json({
      available_balance: Number(available?.total || 0),
      unavailable_balance: Number(unavailable?.total || 0),
    });
  } catch (err) {
    return c.json({ available_balance: 0, unavailable_balance: 0 });
  }
});

app.post('/api/sumup-payment/:id/refund', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    if (!token) throw new Error("SUMUP_API_KEY_PRIVATE ausente.");

    let amount = null;
    try {
      const body = await c.req.json();
      if (body?.amount) amount = Number(body.amount);
    } catch { }

    const client = new SumUp({ apiKey: token });

    // Tenta resolver o transaction UUID correto (em cascata):
    // 1. Extrai do raw_payload salvo no banco
    // 2. Busca o checkout na API
    // 3. Usa o ID direto como fallback
    let txnId = id;

    try {
      const record = await c.env.DB.prepare(
        "SELECT raw_payload FROM financial_logs WHERE payment_id = ? AND method = 'sumup_card' LIMIT 1"
      ).bind(id).first();
      if (record?.raw_payload) {
        const payload = JSON.parse(record.raw_payload);
        const extracted = payload.transactions?.[0]?.id || payload.transaction_id;
        if (extracted) txnId = extracted;
      }
    } catch { }

    // Se ainda é o checkout UUID, busca na API
    if (txnId === id) {
      try {
        const checkout = await client.checkouts.get(id);
        const extracted = checkout.transactions?.[0]?.id;
        if (extracted) txnId = extracted;
      } catch { }
    }

    // Processa o reembolso
    const refundPayload = amount ? { amount } : {};
    const result = await client.transactions.refund(txnId, refundPayload);

    const newStatus = amount ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
    await c.env.DB.prepare(
      "UPDATE financial_logs SET status = ? WHERE payment_id = ? AND method = 'sumup_card'"
    ).bind(newStatus, id).run();

    return c.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Erro ao processar reembolso SumUp:', err);
    return c.json({ error: err.message || 'Reembolso SumUp falhou.' }, 502);
  }
});

app.put('/api/sumup-payment/:id/cancel', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    const token = c.env.SUMUP_API_KEY_PRIVATE;
    if (!token) throw new Error("SUMUP_API_KEY_PRIVATE ausente.");

    const client = new SumUp({ apiKey: token });

    await client.checkouts.deactivate(id);

    await c.env.DB.prepare(
      "UPDATE financial_logs SET status = 'CANCELLED' WHERE payment_id = ? AND method = 'sumup_card'"
    ).bind(id).run();

    return c.json({ success: true });
  } catch (err) {
    console.error('Erro ao cancelar pagamento SumUp:', err);
    return c.json({ error: err.message || 'Falha ao cancelar pagamento SumUp.' }, 502);
  }
});

// --- UPLOAD PARA CLOUDFLARE R2 ---

app.post('/api/upload', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    if (!file) throw new Error("Nenhum arquivo submetido.");
    const extension = file.name.split('.').pop();
    const uniqueName = `${crypto.randomUUID()}.${extension}`;
    await c.env.BUCKET.put(uniqueName, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    const url = new URL(c.req.url);
    return c.json({ success: true, url: `${url.origin}/api/uploads/${uniqueName}` }, 201);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/uploads/:filename', async (c) => {
  const filename = c.req.param('filename');
  try {
    const object = await c.env.BUCKET.get(filename);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', 'https://www.lcv.rio.br');
    return new Response(object.body, { headers });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/uploads/brands/:filename', async (c) => {
  const filename = c.req.param('filename');
  try {
    const object = await c.env.BUCKET.get(`brands/${filename}`);
    if (!object) return c.text('Arquivo não encontrado.', 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Access-Control-Allow-Origin', 'https://www.lcv.rio.br');
    return new Response(object.body, { headers });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- CRUD DE POSTS ---

app.get('/api/posts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/posts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
    if (!post) return c.json({ error: "Post não encontrado" }, 404);
    return c.json(post);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/posts', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { title, content } = await c.req.json();
    await c.env.DB.prepare("INSERT INTO posts (title, content, is_pinned, display_order) VALUES (?, ?, 0, 0)").bind(title, content).run();
    return c.json({ success: true }, 201);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/posts/:id/pin', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    const post = await c.env.DB.prepare("SELECT is_pinned FROM posts WHERE id = ?").bind(id).first();
    const newStatus = post && post.is_pinned ? 0 : 1;
    if (newStatus === 1) await c.env.DB.prepare("UPDATE posts SET is_pinned = 0").run();
    await c.env.DB.prepare("UPDATE posts SET is_pinned = ? WHERE id = ?").bind(newStatus, id).run();
    return c.json({ success: true, is_pinned: newStatus });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/posts/reorder', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const items = await c.req.json();
    const statements = items.map(item => c.env.DB.prepare("UPDATE posts SET display_order = ? WHERE id = ?").bind(item.display_order, item.id));
    await c.env.DB.batch(statements);
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/posts/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    const { title, content } = await c.req.json();
    await c.env.DB.prepare("UPDATE posts SET title = ?, content = ? WHERE id = ?").bind(title, content, id).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.delete('/api/posts/:id', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  const id = c.req.param('id');
  try {
    await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- SETTINGS E CONFIGURAÇÕES DO SISTEMA ---

app.get('/api/settings', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'appearance'").first();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({ allowAutoMode: true, light: { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' }, dark: { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' }, shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' } });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/settings', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO settings (id, payload) VALUES ('appearance', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload").bind(payload).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/settings/rotation', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'rotation'").first();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({ enabled: false, interval: 60, last_rotated_at: 0 });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/settings/rotation', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO settings (id, payload) VALUES ('rotation', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload").bind(payload).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/settings/ratelimit', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'ratelimit'").first();
    if (record) return c.json(normalizeRateLimitConfig(JSON.parse(record.payload)));
    return c.json(DEFAULT_RATE_LIMIT);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/settings/ratelimit', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO settings (id, payload) VALUES ('ratelimit', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload").bind(payload).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/settings/disclaimers', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'disclaimers'").first();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({ enabled: true, items: [{ id: crypto.randomUUID(), title: 'Aviso', text: 'Texto de exemplo.', buttonText: 'Concordo' }] });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.put('/api/settings/disclaimers', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO settings (id, payload) VALUES ('disclaimers', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload").bind(payload).run();
    return c.json({ success: true });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- SEO SITEMAP ---

app.get('/api/sitemap.xml', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT id, created_at FROM posts ORDER BY created_at DESC").all();
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
    xml += `\n  <url>\n    <loc>https://www.lcv.rio.br/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`;
    results.forEach(post => {
      const dateIso = new Date(post.created_at.replace(' ', 'T') + 'Z').toISOString().split('T')[0];
      xml += `\n  <url>\n    <loc>https://www.lcv.rio.br/?p=${post.id}</loc>\n    <lastmod>${dateIso}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`;
    });
    xml += `\n</urlset>`;
    return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } });
  } catch (err) { return c.text('Erro ao gerar sitemap', 500); }
});

// --- CRON JOBS (ROTAÇÃO DE TEXTOS) ---

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    try {
      const record = await env.DB.prepare("SELECT payload FROM settings WHERE id = 'rotation'").first();
      if (!record) return;
      const config = JSON.parse(record.payload);
      if (!config.enabled) return;

      const pinnedCheck = await env.DB.prepare("SELECT id FROM posts WHERE is_pinned = 1 LIMIT 1").first();
      if (pinnedCheck) return;

      const now = Date.now();
      const lastRotated = config.last_rotated_at || 0;
      const intervalMs = (config.interval || 60) * 60 * 1000;
      if (now - lastRotated < intervalMs) return;

      const { results: posts } = await env.DB.prepare("SELECT id FROM posts ORDER BY display_order ASC, created_at DESC").all();
      if (!posts || posts.length <= 1) return;

      const topPost = posts.shift();
      posts.push(topPost);

      const statements = posts.map((post, index) => env.DB.prepare("UPDATE posts SET display_order = ? WHERE id = ?").bind(index, post.id));
      await env.DB.batch(statements);

      config.last_rotated_at = now;
      await env.DB.prepare("UPDATE settings SET payload = ? WHERE id = 'rotation'").bind(JSON.stringify(config)).run();
    } catch (err) { console.error("Falha no Job:", err); }
  }
};