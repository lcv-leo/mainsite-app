/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Contato, Comentários e Compartilhamento.
 * Domínio: /api/contact, /api/comment, /api/shares/*, /api/share/email
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';

const contact = new Hono<{ Bindings: Env }>();

// POST /api/contact (público, rate-limited upstream)
contact.post('/api/contact', async (c) => {
  try {
    const { name, phone, email, message } = (await c.req.json()) as {
      name?: string; phone?: string; email?: string; message?: string;
    };
    if (!name || !email || !message) return c.json({ error: 'Dados incompletos' }, 400);

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
        <p>Atenciosamente,<br/><strong>Reflexos da Alma</strong></p>
      </div>
    `;

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Reflexos da Alma <mainsite@lcv.app.br>', to: 'lcv@lcv.rio.br', subject: `Novo Contato de ${name}`, html: adminHtml }),
    });

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Reflexos da Alma <mainsite@lcv.app.br>', to: email, subject: 'Recebemos sua mensagem', html: userHtml }),
    });

    c.executionCtx.waitUntil(
      c.env.DB.prepare('INSERT INTO mainsite_contact_logs (name, phone, email, message) VALUES (?, ?, ?, ?)')
        .bind(name, phone || '', email, message)
        .run()
    );
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Falha ao processar contato.' }, 500);
  }
});

// POST /api/comment (público, rate-limited upstream)
contact.post('/api/comment', async (c) => {
  try {
    const { name, phone, email, message, post_title } = (await c.req.json()) as {
      name?: string; phone?: string; email?: string; message?: string; post_title?: string;
    };
    if (!message) return c.json({ error: 'Comentário obrigatório' }, 400);

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
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Reflexos da Alma <mainsite@lcv.app.br>', to: 'lcv@lcv.rio.br', subject: `Novo Comentário: ${post_title || 'Geral'}`, html: adminHtml }),
    });

    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Falha ao processar comentário.' }, 500);
  }
});

// --- Contact Logs (admin) ---
contact.get('/api/contact-logs', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM mainsite_contact_logs ORDER BY created_at DESC LIMIT 200').all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

contact.delete('/api/contact-logs/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_contact_logs WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

// --- Shares (admin + público) ---
contact.get('/api/shares', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM mainsite_shares ORDER BY created_at DESC LIMIT 200').all();
    return c.json(results || []);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

contact.delete('/api/shares/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_shares WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

contact.post('/api/shares', async (c) => {
  try {
    const { post_id, post_title, platform, target } = (await c.req.json()) as {
      post_id?: string; post_title?: string; platform?: string; target?: string;
    };
    await c.env.DB.prepare('INSERT INTO mainsite_shares (post_id, post_title, platform, target) VALUES (?, ?, ?, ?)')
      .bind(post_id, post_title, platform, target || null)
      .run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

contact.post('/api/share/email', async (c) => {
  try {
    const { post_id, post_title, link, target_email } = (await c.req.json()) as {
      post_id?: string; post_title?: string; link?: string; target_email?: string;
    };
    if (!c.env.RESEND_API_KEY) throw new Error('Chave do Resend não configurada.');

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reflexos da Alma <mainsite@lcv.app.br>',
        to: [target_email],
        subject: `Compartilhamento: ${post_title}`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>Alguém compartilhou uma leitura com você</h2>
                <p><strong>${post_title}</strong></p>
                <a href="${link}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">Ler Texto Completo</a>
               </div>`,
      }),
    });

    if (!emailRes.ok) throw new Error('Erro no envio pelo Resend.');
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO mainsite_shares (post_id, post_title, platform, target) VALUES (?, ?, 'email', ?)")
        .bind(post_id, post_title, target_email)
        .run()
    );
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default contact;
