// Módulo: mainsite-worker/src/index.js
// Versão: v1.1.0

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
    const { message } = await c.req.json();
    const apiKey = c.env.GEMINI_API_KEY;
    if (!apiKey || !message) throw new Error("Parâmetros inválidos.");

    const { results } = await c.env.DB.prepare("SELECT title, content FROM posts ORDER BY is_pinned DESC, created_at DESC LIMIT 30").all();
    const dbContext = results.map(p => `TÍTULO: ${p.title}\nCONTEÚDO: ${p.content}`).join('\n\n---\n\n');

    const systemPrompt = `Você é o assistente de IA do site. O usuário fará uma pergunta ou busca semântica. 
    Responda baseando-se EXCLUSIVAMENTE nos textos fornecidos abaixo. 
    Se a resposta não estiver nos textos, diga educadamente que o site ainda não abordou este tema.
    Forneça respostas diretas, limpas e cite o TÍTULO do texto quando for relevante.
    \n\nTEXTOS DO SITE:\n${dbContext}\n\nPERGUNTA DO USUÁRIO: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.3 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");
    return c.json({ success: true, reply: data.candidates[0].content.parts[0].text });
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

// --- ROTAS DE CONFIGURAÇÃO DE APARÊNCIA ---
app.get('/api/settings', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'appearance'").first();
    if (record) return c.json(JSON.parse(record.payload));
    
    // Novo fallback com suporte a Multi-Tema (v1.1.0)
    return c.json({ 
      allowAutoMode: true,
      light: { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' },
      dark: { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' },
      shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' }
    });
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

export default app;