/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Contato, Comentários e Compartilhamento.
 * Domínio: /api/contact, /api/comment, /api/shares/*, /api/share/email
 */

import type { Context } from 'hono';
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { getAdminEmail, requireAuth } from '../lib/auth.ts';
import { escapeHtml } from '../lib/html.ts';
import { structuredLog } from '../lib/logger.ts';
import { verifyTurnstile } from '../lib/moderation.ts';
import { CommentEmailSchema, ContactSchema, ShareEmailSchema, ShareLogSchema } from '../lib/schemas.ts';

const contact = new Hono<{ Bindings: Env }>();
type RouteContext = Context<{ Bindings: Env }>;

async function requireTurnstileValidation(c: RouteContext, token: string | undefined): Promise<Response | null> {
  const turnstileSecret = c.env.TURNSTILE_SECRET_KEY?.trim();
  if (!turnstileSecret) {
    return c.json({ error: 'Proteção antiabuso temporariamente indisponível.' }, 503);
  }
  if (!token) {
    return c.json({ error: 'Token de verificação ausente.' }, 400);
  }
  const ip = c.req.header('CF-Connecting-IP') || '';
  const isValid = await verifyTurnstile(token, turnstileSecret, ip);
  if (!isValid) {
    return c.json({ error: 'Verificação de segurança falhou.' }, 403);
  }
  return null;
}

async function getSentimentPrefix(env: Env, text: string): Promise<string> {
  try {
    const response = await env.AI.run('@cf/huggingface/distilbert-sst-2-int8', { text: text.substring(0, 500) });
    const negative = response.find((r: any) => r.label === 'NEGATIVE');
    if (negative && negative.score > 0.8) {
      return '[🔴 Tensão Identificada] ';
    }
    const positive = response.find((r: any) => r.label === 'POSITIVE');
    if (positive && positive.score > 0.8) {
      return '[🟢 Feedback Positivo] ';
    }
    return '';
  } catch {
    return ''; // Silent fallback
  }
}

// POST /api/contact (público, rate-limited upstream)
contact.post('/api/contact', async (c) => {
  try {
    const parsed = ContactSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Dados incompletos' }, 400);
    const { name, phone, email, message, turnstile_token } = parsed.data;

    const turnstileFailure = await requireTurnstileValidation(c, turnstile_token);
    if (turnstileFailure) return turnstileFailure;

    const sentiment = await getSentimentPrefix(c.env, message);
    const resendToken = c.env.RESEND_API_KEY;
    const adminHtml = `
      <div style="font-family: sans-serif; color: #333;">
        <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Novo Contato pelo Site ${escapeHtml(sentiment)}</h2>
        <p><strong>Nome:</strong> ${escapeHtml(name)}</p>
        <p><strong>Telefone:</strong> ${escapeHtml(phone || 'Não informado')}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email)}</p>
        <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #000; margin-top: 20px;">
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
      </div>
    `;
    const userHtml = `
      <div style="font-family: sans-serif; color: #333; line-height: 1.6;">
        <h2 style="color: #0ea5e9;">Olá, ${escapeHtml(name)}</h2>
        <p>Recebemos sua mensagem com sucesso através do nosso site. Abaixo está uma cópia do que você nos enviou:</p>
        <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
          <p style="margin: 0; white-space: pre-wrap; font-style: italic;">"${escapeHtml(message)}"</p>
        </div>
        <p>Em breve entraremos em contato.</p>
        <p>Atenciosamente,<br/><strong>Reflexos da Alma</strong></p>
      </div>
    `;

    const adminEmail = await getAdminEmail(c.env.DB);

    if (adminEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Reflexos da Alma <mainsite@lcv.app.br>',
          to: adminEmail,
          subject: `Novo Contato de ${name}`,
          html: adminHtml,
        }),
      });
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reflexos da Alma <mainsite@lcv.app.br>',
        to: email,
        subject: 'Recebemos sua mensagem',
        html: userHtml,
      }),
    });

    c.executionCtx.waitUntil(
      c.env.DB.prepare('INSERT INTO mainsite_contact_logs (name, phone, email, message) VALUES (?, ?, ?, ?)')
        .bind(name, phone || '', email, message)
        .run(),
    );
    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Falha ao processar contato.' }, 500);
  }
});

// POST /api/comment (público, rate-limited upstream)
contact.post('/api/comment', async (c) => {
  try {
    const parsed = CommentEmailSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Comentário obrigatório' }, 400);
    const { name, phone, email, message, post_title, turnstile_token } = parsed.data;

    const turnstileFailure = await requireTurnstileValidation(c, turnstile_token);
    if (turnstileFailure) return turnstileFailure;

    const sentiment = await getSentimentPrefix(c.env, message);
    const adminHtml = `
      <div style="font-family: sans-serif; color: #333;">
        <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">Novo Comentário no Site ${escapeHtml(sentiment)}</h2>
        <p><strong>Texto/Contexto:</strong> ${escapeHtml(post_title || 'N/A')}</p>
        <p><strong>Nome:</strong> ${escapeHtml(name || 'Não informado')}</p>
        <p><strong>Telefone:</strong> ${escapeHtml(phone || 'Não informado')}</p>
        <p><strong>E-mail:</strong> ${escapeHtml(email || 'Não informado')}</p>
        <div style="background: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; margin-top: 20px;">
          <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
        </div>
      </div>
    `;

    const commentAdminEmail = await getAdminEmail(c.env.DB);

    if (commentAdminEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Reflexos da Alma <mainsite@lcv.app.br>',
          to: commentAdminEmail,
          subject: `Novo Comentário: ${post_title || 'Geral'}`,
          html: adminHtml,
        }),
      });
    }

    return c.json({ success: true });
  } catch {
    return c.json({ error: 'Falha ao processar comentário.' }, 500);
  }
});

// --- Contact Logs (admin) ---
contact.get('/api/contact-logs', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_contact_logs ORDER BY created_at DESC LIMIT 200',
    ).all();
    return c.json(results || []);
  } catch (err) {
    structuredLog('error', '[Contact] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

contact.delete('/api/contact-logs/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_contact_logs WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Contact] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// --- Shares (admin + público) ---
contact.get('/api/shares', requireAuth, async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM mainsite_shares ORDER BY created_at DESC LIMIT 200',
    ).all();
    return c.json(results || []);
  } catch (err) {
    structuredLog('error', '[Contact] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

contact.delete('/api/shares/:id', requireAuth, async (c) => {
  try {
    await c.env.DB.prepare('DELETE FROM mainsite_shares WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Contact] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

contact.post('/api/shares', async (c) => {
  try {
    const parsed = ShareLogSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Dados inválidos.' }, 400);
    const { post_id, post_title, platform, target } = parsed.data;
    await c.env.DB.prepare('INSERT INTO mainsite_shares (post_id, post_title, platform, target) VALUES (?, ?, ?, ?)')
      .bind(post_id, post_title, platform, target || null)
      .run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Contact] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

contact.post('/api/share/email', async (c) => {
  try {
    const parsed = ShareEmailSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Dados incompletos' }, 400);
    const { post_id, post_title, link, target_email, turnstile_token } = parsed.data;
    if (!c.env.RESEND_API_KEY) throw new Error('Chave do Resend não configurada.');

    const turnstileFailure = await requireTurnstileValidation(c, turnstile_token);
    if (turnstileFailure) return turnstileFailure;

    const canonicalLink = `https://www.reflexosdaalma.blog/p/${post_id}`;
    const canonicalLinkAlt = `https://reflexosdaalma.blog/p/${post_id}`;
    if (link !== canonicalLink && link !== canonicalLinkAlt) {
      return c.json({ error: 'Link de compartilhamento inválido.' }, 400);
    }

    const post = await c.env.DB.prepare('SELECT id, title FROM mainsite_posts WHERE id = ?')
      .bind(post_id)
      .first<{ id: number; title: string }>();

    if (!post) {
      return c.json({ error: 'Post não encontrado.' }, 404);
    }

    const recipientWindow = await c.env.DB.prepare(
      `SELECT COUNT(*) AS cnt
       FROM mainsite_shares
       WHERE platform = 'email' AND target = ? AND created_at > datetime('now', '-1 day')`,
    )
      .bind(target_email)
      .first<{ cnt: number }>();

    if ((recipientWindow?.cnt || 0) >= 5) {
      return c.json({ error: 'Limite diário para este destinatário excedido.' }, 429);
    }

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reflexos da Alma <mainsite@lcv.app.br>',
        to: [target_email],
        subject: `Compartilhamento: ${(post.title || post_title || '').replace(/[<>"]/g, '')}`,
        html: `<div style="font-family: sans-serif; padding: 20px;">
                <h2>Alguém compartilhou uma leitura com você</h2>
                <p><strong>${escapeHtml(post.title || post_title)}</strong></p>
                <a href="${escapeHtml(canonicalLink)}" style="background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; margin-top: 10px;">Ler Texto Completo</a>
               </div>`,
      }),
    });

    if (!emailRes.ok) throw new Error('Erro no envio pelo Resend.');
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO mainsite_shares (post_id, post_title, platform, target) VALUES (?, ?, 'email', ?)")
        .bind(post_id, post.title || post_title, target_email)
        .run(),
    );
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Contact] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default contact;
