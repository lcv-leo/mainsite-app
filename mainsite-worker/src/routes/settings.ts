/**
 * Rotas de Settings e Configurações do Sistema.
 * Domínio: /api/settings/*, /api/settings/disclaimers
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { requireAuth } from '../lib/auth.ts';
import { normalizeRateLimitConfig, DEFAULT_RATE_LIMIT } from '../lib/rate-limit.ts';

const settings = new Hono<{ Bindings: Env }>();

// --- Aparência ---
settings.get('/api/settings', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/appearance'").first<{ payload: string }>();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({
      allowAutoMode: true,
      light: { bgColor: '#ffffff', bgImage: '', fontColor: '#333333', titleColor: '#111111' },
      dark: { bgColor: '#131314', bgImage: '', fontColor: '#E3E3E3', titleColor: '#8AB4F8' },
      shared: { fontSize: '1.15rem', titleFontSize: '1.8rem', fontFamily: 'sans-serif' },
    });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
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
    return c.json({ error: (err as Error).message }, 500);
  }
});

// --- Rotação ---
settings.get('/api/settings/rotation', async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/rotation'").first<{ payload: string }>();
    if (record) return c.json(JSON.parse(record.payload));
    return c.json({ enabled: false, interval: 60, last_rotated_at: 0 });
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
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
    return c.json({ error: (err as Error).message }, 500);
  }
});

// --- Rate Limit ---
settings.get('/api/settings/ratelimit', requireAuth, async (c) => {
  try {
    const record = await c.env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'").first<{ payload: string }>();
    if (record) return c.json(normalizeRateLimitConfig(JSON.parse(record.payload)));
    return c.json(DEFAULT_RATE_LIMIT);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
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
    return c.json({ error: (err as Error).message }, 500);
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
    return c.json({ error: (err as Error).message }, 500);
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
    return c.json({ error: (err as Error).message }, 500);
  }
});

export default settings;
