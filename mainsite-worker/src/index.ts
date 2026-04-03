/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * mainsite-motor — Entry Point
 * Hono-based modular Worker com paridade total ao monolito.
 * Versão modular: todos os domínios em src/routes/*.ts
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env.ts';

// --- Route Modules ---
import aiRoutes from './routes/ai.ts';
import postsRoutes from './routes/posts.ts';
import contactRoutes from './routes/contact.ts';
import settingsRoutes from './routes/settings.ts';
import uploadsRoutes from './routes/uploads.ts';
import miscRoutes from './routes/misc.ts';
import paymentsSumupRoutes from './routes/payments-sumup.ts';
import paymentsMpRoutes from './routes/payments-mp.ts';
import postSummariesRoutes from './routes/post-summaries.ts';


const app = new Hono<{ Bindings: Env }>();

// ========== SECRET STORE RESOLVER MIDDLEWARE ==========
// Cloudflare Secret Store bindings are Fetcher objects with `.get()`.
// This middleware eagerly resolves all secret values so downstream
// handlers can use c.env.GEMINI_API_KEY as a plain string.
const SECRET_KEYS = [
  'CLOUDFLARE_PW', 'GEMINI_API_KEY', 'RESEND_API_KEY', 'CF_AI_GATEWAY',
  'SUMUP_API_KEY_PRIVATE', 'SUMUP_MERCHANT_CODE', 'MP_ACCESS_TOKEN',
  'MERCADO_PAGO_WEBHOOK_SECRET',
] as const;

app.use('*', async (c, next) => {
  const env = c.env as unknown as Record<string, unknown>;
  await Promise.all(
    SECRET_KEYS.map(async (key) => {
      const binding = env[key];
      if (binding && typeof binding === 'object' && typeof (binding as { get?: unknown }).get === 'function') {
        env[key] = await (binding as { get(): Promise<string> }).get();
      }
    }),
  );
  return next();
});


// ========== CORS (paridade total com monolito) ==========
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

// ========== RATE LIMITING (Cloudflare native binding) ==========
// Limites definidos via infrastructure-as-code em wrangler.json
// Toggle enabled/disabled lido do D1 para preservar controle admin

const RATE_LIMIT_BINDINGS: Record<string, keyof Pick<Env, 'RL_CHATBOT' | 'RL_EMAIL'>> = {
  chatbot: 'RL_CHATBOT',
  email: 'RL_EMAIL',
};

interface RlToggleConfig { chatbot: { enabled: boolean }; email: { enabled: boolean } }
let cachedRlToggle: RlToggleConfig | null = null;
let rlToggleFetchedAt = 0;

async function getRlEnabled(env: Env): Promise<RlToggleConfig> {
  const now = Date.now();
  if (cachedRlToggle && now - rlToggleFetchedAt < 60000) return cachedRlToggle;
  try {
    const record = await env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'").first<{ payload: string }>();
    if (record) {
      const parsed = JSON.parse(record.payload);
      cachedRlToggle = {
        chatbot: { enabled: Boolean(parsed?.chatbot?.enabled ?? parsed?.enabled) },
        email: { enabled: Boolean(parsed?.email?.enabled) },
      };
    } else {
      cachedRlToggle = { chatbot: { enabled: false }, email: { enabled: false } };
    }
    rlToggleFetchedAt = now;
  } catch {
    cachedRlToggle = { chatbot: { enabled: false }, email: { enabled: false } };
  }
  return cachedRlToggle;
}

function createRateLimiterMiddleware(bucketName: 'chatbot' | 'email') {
  return async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => Response; env: Env }, next: () => Promise<void>) => {
    const toggles = await getRlEnabled(c.env);
    if (!toggles[bucketName]?.enabled) return next();

    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const bindingKey = RATE_LIMIT_BINDINGS[bucketName];
    const limiter = c.env[bindingKey];

    const { success } = await limiter.limit({ key: `${bucketName}:${ip}` });
    if (!success) {
      const errMsg = bucketName === 'email'
        ? 'Limite de envios de e-mail excedido. Aguarde alguns instantes.'
        : 'Limite de requisições de IA excedido. Aguarde alguns instantes.';
      return c.json({ error: errMsg }, 429);
    }

    await next();
  };
}

// Rate limit middleware em rotas públicas
app.use('/api/ai/public/*', createRateLimiterMiddleware('chatbot') as Parameters<typeof app.use>[1]);
app.use('/api/share/email', createRateLimiterMiddleware('email') as Parameters<typeof app.use>[1]);
app.use('/api/contact', createRateLimiterMiddleware('email') as Parameters<typeof app.use>[1]);
app.use('/api/comment', createRateLimiterMiddleware('email') as Parameters<typeof app.use>[1]);


// ========== MOUNT ROUTE MODULES ==========
app.route('/', aiRoutes);
app.route('/', postsRoutes);
app.route('/', contactRoutes);
app.route('/', settingsRoutes);
app.route('/', uploadsRoutes);
app.route('/', miscRoutes);
app.route('/', paymentsSumupRoutes);
app.route('/', paymentsMpRoutes);
app.route('/', postSummariesRoutes);

// ========== CRON JOBS (ROTAÇÃO DE TEXTOS) ==========

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      const record = await env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/rotation'").first<{ payload: string }>();
      if (!record) return;
      const config = JSON.parse(record.payload) as { enabled: boolean; interval: number; last_rotated_at: number };
      if (!config.enabled) return;

      const pinnedCheck = await env.DB.prepare("SELECT id FROM mainsite_posts WHERE is_pinned = 1 LIMIT 1").first();
      if (pinnedCheck) return;

      const now = Date.now();
      const lastRotated = config.last_rotated_at || 0;
      const intervalMs = (config.interval || 60) * 60 * 1000;
      if (now - lastRotated < intervalMs) return;

      const { results: posts } = await env.DB.prepare("SELECT id FROM mainsite_posts ORDER BY display_order ASC, created_at DESC").all();
      if (!posts || posts.length <= 1) return;

      const topPost = posts.shift()!;
      posts.push(topPost);

      const statements = posts.map((post, index) =>
        env.DB.prepare("UPDATE mainsite_posts SET display_order = ? WHERE id = ?").bind(index, (post as { id: number }).id)
      );
      await env.DB.batch(statements);

      config.last_rotated_at = now;
      await env.DB.prepare("UPDATE mainsite_settings SET payload = ? WHERE id = 'mainsite/rotation'").bind(JSON.stringify(config)).run();
    } catch (err) {
      console.error('Falha no Job:', err);
    }
  },
};
