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
import { getContentFingerprint } from '../lib/content-version.ts';
import { structuredLog } from '../lib/logger.ts';
import { DEFAULT_RATE_LIMIT, normalizeRateLimitConfig } from '../lib/rate-limit.ts';
import { buildThemeStylesheet, DEFAULT_THEME_SETTINGS, loadThemeSettings } from '../lib/theme.ts';

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
      },
    });
  } catch (err) {
    structuredLog('error', '[Settings] Erro ao gerar stylesheet do tema', { error: (err as Error).message });
    return new Response(buildThemeStylesheet(DEFAULT_THEME_SETTINGS), {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
      },
    });
  }
});

settings.put('/api/settings', requireAuth, async (c) => {
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare(
      "INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/appearance', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    )
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
    const record = await c.env.DB.prepare(
      "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/rotation'",
    ).first<{ payload: string }>();
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
    await c.env.DB.prepare(
      "INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/rotation', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    )
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
    const record = await c.env.DB.prepare(
      "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'",
    ).first<{ payload: string }>();
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
    await c.env.DB.prepare(
      "INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/ratelimit', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    )
      .bind(payload)
      .run();
    return c.json({ success: true });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

// --- Disclaimers ---
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

settings.get('/api/settings/disclaimers', async (c) => {
  try {
    const record = await c.env.DB.prepare(
      "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/disclaimers'",
    ).first<{ payload: string }>();
    if (record) {
      const rawParsed: unknown = JSON.parse(record.payload);
      // Defesa contra payload corrompido (null, array, primitivo) — qualquer coisa
      // que não seja objeto é tratada como vazio (fail-safe). Frontend recebe lista
      // vazia em vez de crashar tentando acessar item.id.
      if (!isPlainObject(rawParsed)) {
        return c.json({ enabled: true, items: [] });
      }
      // Soft-disable individual: item.enabled === false oculta o item no público
      // sem removê-lo do D1. Ausência/undefined = ativo (retrocompat com registros
      // antigos sem o campo). Admin continua vendo tudo via /api/mainsite/settings.
      const rawItems = Array.isArray(rawParsed.items) ? rawParsed.items : [];
      const items = rawItems.filter(
        // Item só passa se for shape renderizável no frontend: objeto não-nulo com
        // id, title, text e buttonText todos strings. Campos ausentes/tipo errado
        // fariam `DisclaimerModal` crashar em `item.text.split(...)` etc. — descartar
        // silenciosamente é fail-safe coerente com o tratamento da raiz corrompida.
        // `enabled !== false` preserva semântica do soft-disable (ausência = ativo).
        (
          item,
        ): item is Record<string, unknown> & {
          id: string;
          title: string;
          text: string;
          buttonText: string;
          enabled?: boolean;
        } =>
          isPlainObject(item) &&
          typeof item.id === 'string' &&
          item.id.length > 0 &&
          typeof item.title === 'string' &&
          typeof item.text === 'string' &&
          typeof item.buttonText === 'string' &&
          (item as { enabled?: unknown }).enabled !== false,
      );
      return c.json({ enabled: rawParsed.enabled !== false, items });
    }
    return c.json({
      enabled: true,
      items: [
        { id: crypto.randomUUID(), title: 'Aviso', text: 'Texto de exemplo.', buttonText: 'Concordo', enabled: true },
      ],
    });
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

settings.put('/api/settings/disclaimers', requireAuth, async (c) => {
  try {
    const payload = await c.req.text();
    await c.env.DB.prepare(
      "INSERT INTO mainsite_settings (id, payload) VALUES ('mainsite/disclaimers', ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
    )
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
    return c.json(fingerprint);
  } catch (err) {
    structuredLog('error', '[Settings] Erro interno', { error: (err as Error).message });
    return c.json({ error: 'Erro interno.' }, 500);
  }
});

export default settings;
