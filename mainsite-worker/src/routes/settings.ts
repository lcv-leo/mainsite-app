/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de Settings e Configurações do Sistema.
 * Domínio: /api/settings/*, /api/settings/disclaimers
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { structuredLog } from '../lib/logger.ts';
import { normalizeRateLimitConfig, DEFAULT_RATE_LIMIT } from '../lib/rate-limit.ts';
import { getContentFingerprint } from '../lib/content-version.ts';
import { buildThemeStylesheet, loadThemeSettings, DEFAULT_THEME_SETTINGS } from '../lib/theme.ts';

const settings = new Hono<{ Bindings: Env }>();

// --- Aparência ---
settings.get('/api/settings', async (c) => {
  try {
    const themeSettings = await loadThemeSettings(c.env.DB);
    return c.json(themeSettings);
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

settings.get('/api/theme.css', async (c) => {
  try {
    const themeSettings = await loadThemeSettings(c.env.DB);
    return new Response(buildThemeStylesheet(themeSettings), {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    structuredLog('error', '[Settings] Erro ao gerar stylesheet do tema', { error: (err as Error).message });
    return new Response(buildThemeStylesheet(DEFAULT_THEME_SETTINGS), {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }
});

settings.put('/api/settings', requireAuth, async (c) => {
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/appearance', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload")
      .bind(payload)
      .run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// --- Rotação ---
settings.get('/api/settings/rotation', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/rotation'").first<{ payload: string }>();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({ enabled: false, interval: 60, last_rotated_at: 0 });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

settings.put('/api/settings/rotation', requireAuth, async (c) => {
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/rotation', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload")
      .bind(payload)
      .run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// --- Rate Limit ---
settings.get('/api/settings/ratelimit', requireAuth, async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'").first<{ payload: string }>();
    if (record) return c.json(normalizeRateLimitConfig(JSON.parse(record.payload)));
    return c.json(DEFAULT_RATE_LIMIT);
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

settings.put('/api/settings/ratelimit', requireAuth, async (c) => {
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/ratelimit', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload")
      .bind(payload)
      .run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// --- Disclaimers ---
settings.get('/api/settings/disclaimers', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/disclaimers'").first<{ payload: string }>();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({
      enabled: true,
      items: [{ id: crypto.randomUUID(), title: 'Aviso', text: 'Texto de exemplo.', buttonText: 'Concordo' }],
    });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

settings.put('/api/settings/disclaimers', requireAuth, async (c) => {
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare("INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/disclaimers', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload")
      .bind(payload)
      .run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});


// --- Content Fingerprint (polling para sincronização em tempo real) ---
settings.get('/api/content-fingerprint', async (c) => {
  try {
    const fingerprint = await getContentFingerprint(c.env.DB);
    return c.json(fingerprint, 200, {
      'Cache-Control': 'public, max-age=5',
    });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default settings;
