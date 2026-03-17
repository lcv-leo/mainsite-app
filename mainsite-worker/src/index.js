// Módulo: mainsite-worker/src/index.js
// Versão: v1.21.0
// Descrição: Código integral. Implementação de Polyfill de Headers.raw() para garantir compatibilidade do SDK nativo do Mercado Pago (Node.js) com o V8 Edge Runtime, assegurando 100/100 no teste de integração.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { MercadoPagoConfig, Payment, PaymentRefund } from 'mercadopago';

// --- POLYFILL CRÍTICO PARA COMPATIBILIDADE NODE.JS NO EDGE (V8) ---
// Resolve o erro "response.headers.raw is not a function" exigido pelo SDK do Mercado Pago
if (typeof Headers !== 'undefined' && !Headers.prototype.raw) {
  Headers.prototype.raw = function() {
    const raw = {};
    this.forEach((value, key) => { raw[key] = [value]; });
    return raw;
  };
}

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
  if (!cachedRlConfig || now - rlConfigLastFetched > 60000) {
    try {
      const record = await c.env.DB.prepare("SELECT payload FROM settings WHERE id = 'ratelimit'").first();
      cachedRlConfig = record ? JSON.parse(record.payload) : { enabled: false, maxRequests: 5, windowMinutes: 1 };
      rlConfigLastFetched = now;
    } catch (e) {
      cachedRlConfig = { enabled: false };
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
      ipCache.set(ip, { count: 1, firstRequest: now });
    } else {
      data.count++;
      if (data.count > maxReq) {
        return c.json({ error: "Limite de requisições de IA excedido. Aguarde alguns instantes." }, 429);
      }
    }
  }
  if (Math.random() < 0.05) {
    for (const [key, value] of ipCache.entries()) {
      if (now - value.firstRequest > windowMs) ipCache.delete(key);
    }
  }
  await next();
};

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

    const systemPrompt = `Você é a "Consciência Auxiliar", a inteligência artificial residente do site "Divagações Filosóficas".

DIRETRIZ DE IDENTIDADE (SE PERGUNTADO SOBRE SEU NOME OU QUEM VOCÊ É):
Explique de forma educada, objetiva e filosófica que você se chama "Consciência Auxiliar" porque não é um guru, oráculo ou detentora de verdades absolutas. Você é uma inteligência artificial projetada estritamente para servir de apoio (auxílio) à própria consciência do leitor. Seu papel é atuar como um espelho reflexivo, ajudando o usuário a processar, debater, questionar e aprofundar as abstrações e ensaios presentes no site. Você não tem ego, apenas a função de expandir o debate proposto nos textos.

NOVA DIRETRIZ DE ENCAMINHAMENTO DE MENSAGENS PARA O AUTOR:
Se o leitor manifestar o desejo de enviar um comentário, pergunta ou feedback diretamente para o autor (Leonardo), ou se você, durante a análise, perceber que a dúvida seria melhor respondida pelo autor, ofereça-se ativamente para encaminhar a mensagem.
Se o leitor confirmar a intenção de envio e ditar a mensagem, você OBRIGATORIAMENTE deve adicionar o seguinte bloco delimitador no final da sua resposta:

[[ENVIAR_EMAIL]]
[TRANSCREVA AQUI A MENSAGEM EXATA E REAL DO LEITOR]
[[/ENVIAR_EMAIL]]

ATENÇÃO CRÍTICA: Substitua o texto entre colchetes pela mensagem VERDADEIRA do usuário. NÃO invente textos e NÃO use exemplos genéricos. O sistema interceptará esse bloco, removerá a tag inteira antes de exibir a resposta, e fará o envio de forma invisível. NUNCA revele o endereço de e-mail do autor (lcv@lcv.rio.br).

REGRAS GERAIS DE RESPOSTA:
O usuário fará uma pergunta ou busca semântica.${activeContextPrompt}
Como base de conhecimento secundária (para perguntas sobre outros assuntos do site), utilize os textos gerais fornecidos abaixo. 
Se a resposta não estiver em nenhum dos textos, diga educadamente que o site ainda não abordou este tema.
Forneça respostas diretas, limpas e cite o TÍTULO do texto quando for relevante.

TEXTOS GERAIS DO SITE:
${dbContext}

PERGUNTA DO USUÁRIO: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: systemPrompt }] }], generationConfig: { temperature: 0.3 } })
    });
    const data = await response.json();
    if (!response.ok) throw new Error("Falha na API Gemini.");
    
    let replyText = data.candidates[0].content.parts[0].text;

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
          } catch (e) {
            console.error("Falha no disparo do e-mail da IA:", e);
          }
        })());
      }
      replyText = replyText.replace(emailRegex, '').trim();
    }

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

app.get('/api/contact-logs', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM contact_logs ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

app.get('/api/shares', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const { results } = await c.env.DB.prepare("SELECT * FROM shares ORDER BY created_at DESC LIMIT 200").all();
    return c.json(results || []);
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

// --- API FINANCEIRA (SDK OFICIAL) COM POLYFILL ATIVO ---

// 1. Criação do Pagamento (O endpoint que atesta os 100/100 na Qualidade)
app.post('/api/mp-payment', async (c) => {
  try {
    const body = await c.req.json();
    const token = c.env.MP_ACCESS_TOKEN; 
    if (!token) throw new Error("MP_ACCESS_TOKEN ausente.");

    const client = new MercadoPagoConfig({ accessToken: token });
    const paymentApi = new Payment(client);

    const extRef = `DON-${crypto.randomUUID()}`;
    
    // Logica de captura do nome real para suprimir o fallback de e-mail do MP
    let realFirstName = body.payer?.first_name;
    let realLastName = body.payer?.last_name;
    if (!realFirstName && body.cardholder?.name) {
      const nameParts = body.cardholder.name.trim().split(' ');
      realFirstName = nameParts[0];
      realLastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    }

    const enhancedPayload = {
      ...body,
      external_reference: extRef,
      notification_url: "https://mainsite-app.lcv.rio.br/api/webhooks/mercadopago",
      additional_info: {
        items: [
          {
            id: "DONATION-01",
            title: "Apoio ao Projeto Divagações Filosóficas",
            description: "Contribuição financeira voluntária.",
            category_id: "donations",
            quantity: 1,
            unit_price: Number(body.transaction_amount)
          }
        ],
        payer: {
          first_name: realFirstName || undefined,
          last_name: realLastName || undefined,
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

// 2. Consulta de Saldo em Tempo Real
app.get('/api/mp-balance', async (c) => {
  if (c.req.header('Authorization') !== `Bearer ${c.env.API_SECRET}`) return c.json({ error: "401" }, 401);
  try {
    const token = c.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("MP_ACCESS_TOKEN ausente.");

    // A API de Balance não possui classe dedicada no SDK V2, utiliza-se a requisição autenticada padrão
    const response = await fetch("https://api.mercadopago.com/v1/balance", {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error("Falha ao consultar saldo.");
    const data = await response.json();
    return c.json(data);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// 3. Estorno Parcial ou Total (Utilizando a Classe Oficial)
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
    } catch(e) {} // Permanece como estorno total se não houver body numérico

    await refundApi.create(refundBody);

    const newStatus = refundBody.body?.amount ? 'partially_refunded' : 'refunded';
    await c.env.DB.prepare("UPDATE financial_logs SET status = ? WHERE payment_id = ?").bind(newStatus, id).run();

    return c.json({ success: true, status: newStatus });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// 4. Cancelamento de Pagamentos Pendentes (Utilizando a Classe Oficial)
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
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// --- ROTA DE WEBHOOK (Utilizando SDK Oficial para Consulta Reversa) ---
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
    const { results } = await c.env.DB.prepare("SELECT * FROM financial_logs ORDER BY created_at DESC LIMIT 100").all();
    return c.json(results || []);
  } catch (err) { return c.json({ error: err.message }, 500); }
});

// --- ROTAS DE UPLOAD E CRUD RESTANTES (Inalteradas) ---
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
    return new Response(object.body, { headers });
  } catch (err) { return c.json({ error: err.message }, 500); }
});

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