// Módulo: mainsite-worker/src/index.js
// Versão: v1.5.0
// Descrição: Implementação de Rate Limiting em memória (Isolate Cache) nas rotas públicas de IA, com configuração dinâmica via D1.

import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) return '*';
    const allowedSuffixes = ['.pages.dev', '.com', '.br'];
    const isAllowed = allowedSuffixes.some(suffix => origin.endsWith(suffix));
    if (isAllowed || origin.includes('localhost')) return origin;
    return 'https://mainsite-frontend.pages.dev';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}));

// --- ENGINE DE RATE LIMITING (ISOLATE MEMORY) ---
const ipCache = new Map();
let cachedRlConfig = null;
let rlConfigLastFetched = 0;

const rateLimiterMiddleware = async (c, next) => {
  const now = Date.now();
  
  // Cache da configuração por 60s para evitar leitura constante no D1
  if (!cachedRlConfig || now - rlConfigLastFetched > 60000) {
    try {
      const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'ratelimit'").first();
      cachedRlConfig = record ? JSON.parse(record.payload) : { enabled: false, maxRequests: 5, windowMinutes: 1 };
      rlConfigLastFetched = now;
    } catch (e) {
      cachedRlConfig = { enabled: false }; // Fallback de segurança
    }
  }

  if (!cachedRlConfig.enabled) return next();

  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const windowMs = (cachedRlConfig.windowMinutes || 1) * 60000;
  const maxReq = cachedRlConfig.maxRequests || 5;
  
  if (!ipCache.has(ip)) {
    ipCache.set(ip, { count: 1, firstRequest: now });
  } else {
    const data = ipCache.get(ip);
    if (now - data.firstRequest > windowMs) {
      // Janela de tempo expirou, reseta o contador
      ipCache.set(ip, { count: 1, firstRequest: now });
    } else {
      data.count++;
      if (data.count > maxReq) {
        return c.json({ error: "Limite de requisições de IA excedido. Aguarde alguns instantes." }, 429);
      }
    }
  }
  
  // Limpeza de memória assíncrona (Lazy Cleanup 5% de chance)
  if (Math.random() < 0.05) {
    for (const [key, value] of ipCache.entries()) {
      if (now - value.firstRequest > windowMs) ipCache.delete(key);
    }
  }

  await next();
};

// Aplicação do escudo estritamente nas rotas públicas da IA
app.use('/api/ai/public/*', rateLimiterMiddleware);


// --- ROTAS DE INTELIGÊNCIA ARTIFICIAL (GEMINI 2.5 PRO) ---
app.post('/api/ai/transform', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { action, text } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY ausente.");
    if (!text) throw new Error("Texto ausente.");

    let promptContext = "";
    switch(action) {
      case 'summarize': promptContext = "Resuma o seguinte texto de forma concisa e direta, mantendo a formatação e o idioma original:"; break;
      case 'expand': promptContext = "Expanda o seguinte texto, adicionando mais profundidade, contexto e detalhes técnicos, mantendo o idioma original:"; break;
      case 'grammar': promptContext = "Corrija os erros gramaticais e melhore a fluidez e coesão do seguinte texto, sem alterar seu significado central:"; break;
      case 'formal': promptContext = "Reescreva o seguinte texto em um tom estritamente formal, profissional e acadêmico:"; break;
      default: promptContext = "Melhore o seguinte texto:";
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: `${promptContext}\n\n"${text}"` }] }], generationConfig: { temperature: 0.5 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Falha na API Gemini.");
    return c.json({ success: true, text: data.candidates[0].content.parts[0].text });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/ai/public/chat', async (c) => {
  try {
    const { message, currentContext } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey || !message) throw new Error("Parâmetros inválidos.");

    const { results } = await c.env.DB.prepare("SELECT title, content FROM posts ORDER BY is_pinned DESC, created_at DESC LIMIT 30").all();
    const dbContext = results.map(p => `TÍTULO: ${p.title}\nCONTEÚDO: ${p.content}`).join('\n\n---\n\n');

    let activeContextPrompt = "";
    const contextTitleLog = currentContext && currentContext.title ? currentContext.title : "Contexto Geral / Busca Global";
    
    if (currentContext && currentContext.title) {
      activeContextPrompt = `\nATENÇÃO - CONTEXTO ATIVO: O usuário está atualmente com o seguinte texto aberto na tela:\n[TÍTULO DO TEXTO NA TELA]: ${currentContext.title}\n[CONTEÚDO DO TEXTO NA TELA]: ${currentContext.content}\nSe a pergunta do usuário se referir a "este texto", "o texto", "aqui" ou fizer menções implícitas ao conteúdo visualizado, você DEVE basear sua resposta rigorosa e primariamente no [CONTEXTO ATIVO] acima.\n`;
    }

    const systemPrompt = `Você é o assistente de IA do site. O usuário fará uma pergunta ou busca semântica.${activeContextPrompt}
    \nComo base de conhecimento secundária (para perguntas sobre outros assuntos do site), utilize os textos gerais fornecidos abaixo. 
    Se a resposta não estiver em nenhum dos textos, diga educadamente que o site ainda não abordou este tema.
    Forneça respostas diretas, limpas e cite o TÍTULO do texto quando for relevante.
    \n\nTEXTOS GERAIS DO SITE:\n${dbContext}\n\nPERGUNTA DO USUÁRIO: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.3 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");
    
    const replyText = data.candidates[0].content.parts[0].text;

    const logPromise = c.env.DB.batch([
      c.env.DB.prepare("INSERT INTO chat_logs (role, message, context_title) VALUES ('user', ?, ?)").bind(message, contextTitleLog),
      c.env.DB.prepare("INSERT INTO chat_logs (role, message, context_title) VALUES ('bot', ?, ?)").bind(replyText, contextTitleLog)
    ]);
    c.executionCtx.waitUntil(logPromise);

    return c.json({ success: true, reply: replyText });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/ai/public/summarize', async (c) => {
  try {
    const { text } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey || !text) throw new Error("Parâmetros inválidos.");

    const prompt = `Crie um resumo conciso (TL;DR) em um único parágrafo objetivo para o seguinte texto:\n\n${text}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");
    return c.json({ success: true, summary: data.candidates[0].content.parts[0].text });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.post('/api/ai/public/translate', async (c) => {
  try {
    const { text, lang } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey || !text || !lang) throw new Error("Parâmetros inválidos.");

    const prompt = `Traduza rigorosamente o texto abaixo para o idioma: ${lang}. Mantenha qualquer tag HTML ou formatação intacta. Texto:\n\n${text}`;
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");
    return c.json({ success: true, translation: data.candidates[0].content.parts[0].text });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/chat-logs', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- ROTAS DE UPLOAD E MÍDIA (R2) ---
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
    const publicUrl = `${url.origin}/api/uploads/${uniqueName}`;
    return c.json({ success: true, url: publicUrl }, 201);
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
    headers.set('Cache-Control', 'public, max-age=31536000');
    return new Response(object.body, { headers });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- ROTAS DE POSTAGENS (D1) ---
app.get('/api/posts', async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM posts ORDER BY is_pinned DESC, display_order ASC, created_at DESC").all();
    return c.json(results || []);
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

// --- ROTAS DE CONFIGURAÇÃO DE SISTEMA ---
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

// NOVA ROTA: Escrita/Leitura de Rate Limit
app.get('/api/settings/ratelimit', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'ratelimit'").first();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({ enabled: false, maxRequests: 5, windowMinutes: 1 });
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
    } catch (err) { console.error("Falha no Job de Rotação:", err); }
  }
};