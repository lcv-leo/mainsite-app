/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * mainsite-motor — Entry Point
 * Hono-based modular Worker com paridade total ao monolito.
 * Versão modular: todos os domínios em src/routes/*.ts
 */
export const APP_VERSION = 'APP v02.18.00';

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { timing } from 'hono/timing';
import type { Env } from './env.ts';
import { bumpContentVersion } from './lib/content-version.ts';
import { getAllowedOrigin } from './lib/origins.ts';
import { readPublishingMode } from './lib/publishing.ts';
import { EnvSecretsSchema } from './lib/schemas.ts';
// --- Route Modules ---
import aboutRoutes from './routes/about.ts';
import aiRoutes from './routes/ai.ts';
import commentsRoutes from './routes/comments.ts';
import contactRoutes from './routes/contact.ts';
import paymentsRoutes from './routes/payments.ts';
import postSummariesRoutes from './routes/post-summaries.ts';
import postsRoutes from './routes/posts.ts';
import ratingsRoutes from './routes/ratings.ts';
import settingsRoutes from './routes/settings.ts';
import siteStatusRoutes from './routes/site-status.ts';
import uploadsRoutes from './routes/uploads.ts';

const app = new Hono<{ Bindings: Env }>();

// ========== OBSERVABILITY ==========
app.use('*', timing());
app.use(
  '*',
  logger((msg) => console.log(`[mainsite-motor] ${msg}`)),
);

// ========== SECRET STORE RESOLVER MIDDLEWARE ==========
// Cloudflare Secret Store bindings are Fetcher objects with `.get()`.
// This middleware eagerly resolves all secret values so downstream
// handlers can use c.env.GEMINI_API_KEY as a plain string.
const SECRET_KEYS = [
  'CLOUDFLARE_PW',
  'GEMINI_API_KEY',
  'RESEND_API_KEY',
  'SUMUP_API_KEY_PRIVATE',
  'SUMUP_MERCHANT_CODE',
  'PIX_KEY',
  'PIX_NAME',
  'PIX_CITY',
  'GCP_NL_API_KEY',
  'TURNSTILE_SECRET_KEY',
  'CF_ACCESS_TEAM_DOMAIN',
  'CF_ACCESS_AUD',
  'ENFORCE_JWT_VALIDATION',
] as const;

app.use('*', async (c, next) => {
  const env = c.env as unknown as Record<string, unknown>;
  await Promise.all(
    SECRET_KEYS.map(async (key) => {
      const binding = env[key];
      if (binding && typeof binding === 'object' && typeof (binding as { get?: unknown }).get === 'function') {
        try {
          env[key] = await (binding as { get(): Promise<string> }).get();
        } catch (error) {
          console.warn(`[mainsite-motor] [Secrets Store] Falha ao resolver secret ${key}:`, error);
          env[key] = undefined;
        }
      }
    }),
  );
  return next();
});

// ========== ENV VALIDATION (post-secret-resolution, warn-only) ==========
// IMPORTANT: This middleware MUST remain warn-only (never return 503).
// A prior fail-closed version caused a full production outage.
app.use('*', async (c, next) => {
  const result = EnvSecretsSchema.safeParse(c.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ');
    console.warn(`[mainsite-motor] [Env] Secrets ausentes ou inválidos: ${missing}`);
  }
  return next();
});

// ========== CORS + CSRF ==========
// Lista de domínios autorizados — usada tanto pelo CORS quanto pelo CSRF check.
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      return getAllowedOrigin(origin);
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
);

// CSRF — server-side Origin check para mutations.
// CORS só seta headers; o browser é quem bloqueia. Este middleware bloqueia
// no servidor, impedindo side-effects mesmo que o browser não bloqueie.
// Requests sem Origin (curl, server-to-server, same-origin) são permitidos.
app.use('/api/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
    const origin = c.req.header('origin');
    if (origin) {
      if (!getAllowedOrigin(origin)) {
        return c.json({ error: 'Header Origin inválido.' }, 403);
      }
    }
  }
  return next();
});

// ========== RATE LIMITING (Cloudflare native binding) ==========
// Limites definidos via infrastructure-as-code em wrangler.json
// Toggle enabled/disabled lido do D1 para preservar controle admin

const RATE_LIMIT_BINDINGS: Record<string, keyof Pick<Env, 'RL_CHATBOT' | 'RL_EMAIL' | 'RL_COMMENTS'>> = {
  chatbot: 'RL_CHATBOT',
  email: 'RL_EMAIL',
  comments: 'RL_COMMENTS',
};

interface RlToggleConfig {
  chatbot: { enabled: boolean };
  email: { enabled: boolean };
  comments: { enabled: boolean };
}
let cachedRlToggle: RlToggleConfig | null = null;
let rlToggleFetchedAt = 0;

async function getRlEnabled(env: Env): Promise<RlToggleConfig> {
  const now = Date.now();
  if (cachedRlToggle && now - rlToggleFetchedAt < 60000) return cachedRlToggle;
  try {
    const record = await env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'").first<{
      payload: string;
    }>();
    if (record) {
      const parsed = JSON.parse(record.payload);
      cachedRlToggle = {
        chatbot: { enabled: Boolean(parsed?.chatbot?.enabled ?? parsed?.enabled) },
        email: { enabled: Boolean(parsed?.email?.enabled) },
        comments: { enabled: Boolean(parsed?.comments?.enabled ?? true) },
      };
    } else {
      cachedRlToggle = { chatbot: { enabled: false }, email: { enabled: false }, comments: { enabled: true } };
    }
    rlToggleFetchedAt = now;
  } catch {
    cachedRlToggle = { chatbot: { enabled: false }, email: { enabled: false }, comments: { enabled: true } };
  }
  return cachedRlToggle ?? { chatbot: { enabled: false }, email: { enabled: false }, comments: { enabled: true } };
}

function createRateLimiterMiddleware(bucketName: 'chatbot' | 'email' | 'comments') {
  return async (
    c: {
      req: { header: (name: string) => string | undefined };
      json: (data: unknown, status?: number) => Response;
      env: Env;
    },
    next: () => Promise<void>,
  ) => {
    const toggles = await getRlEnabled(c.env);
    if (!toggles[bucketName]?.enabled) return next();

    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const bindingKey = RATE_LIMIT_BINDINGS[bucketName];
    const limiter = c.env[bindingKey];

    const { success } = await limiter.limit({ key: `${bucketName}:${ip}` });
    if (!success) {
      const errMsg =
        bucketName === 'email'
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
app.use('/api/comments', createRateLimiterMiddleware('comments') as Parameters<typeof app.use>[1]);
app.use('/api/ratings', createRateLimiterMiddleware('comments') as Parameters<typeof app.use>[1]);

// ========== MOUNT ROUTE MODULES ==========
app.route('/', aiRoutes);
app.route('/', aboutRoutes);
app.route('/', postsRoutes);
app.route('/', contactRoutes);
app.route('/', settingsRoutes);
app.route('/', siteStatusRoutes);
app.route('/', uploadsRoutes);
app.route('/', paymentsRoutes);
app.route('/', postSummariesRoutes);
app.route('/', commentsRoutes);
app.route('/', ratingsRoutes);

// ========== APP TYPE (for Hono RPC consumers) ==========

export type AppType = typeof app;

// ========== CRON JOBS (ROTAÇÃO DE TEXTOS) ==========

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    try {
      // Kill switch global: se o site está oculto, não rotacionar nada.
      if ((await readPublishingMode(env.DB)) === 'hidden') return;

      const record = await env.DB.prepare(
        "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/rotation'",
      ).first<{ payload: string }>();
      if (!record) return;
      const config = JSON.parse(record.payload) as { enabled: boolean; interval: number; last_rotated_at: number };
      if (!config.enabled) return;

      const pinnedCheck = await env.DB.prepare(
        'SELECT id FROM mainsite_posts WHERE is_pinned = 1 AND is_published = 1 LIMIT 1',
      ).first();
      if (pinnedCheck) return;

      const now = Date.now();
      const lastRotated = config.last_rotated_at || 0;
      const intervalMs = (config.interval || 60) * 60 * 1000;
      if (now - lastRotated < intervalMs) return;

      // Rotação opera apenas entre posts visíveis. Posts ocultos ficam fora
      // do ciclo até serem reativados.
      const { results: posts } = await env.DB.prepare(
        'SELECT id FROM mainsite_posts WHERE is_published = 1 ORDER BY display_order ASC, created_at DESC',
      ).all();
      if (!posts || posts.length <= 1) return;

      const topPost = posts.shift();
      if (!topPost) return;
      posts.push(topPost);

      const statements = posts.map((post, index) =>
        env.DB.prepare('UPDATE mainsite_posts SET display_order = ? WHERE id = ?').bind(
          index,
          (post as { id: number }).id,
        ),
      );
      await env.DB.batch(statements);

      config.last_rotated_at = now;
      await env.DB.prepare("UPDATE mainsite_settings SET payload = ? WHERE id = 'mainsite/rotation'")
        .bind(JSON.stringify(config))
        .run();

      // Sinaliza mudança para o polling de content-fingerprint
      ctx.waitUntil(bumpContentVersion(env.DB));
    } catch (err) {
      console.error('[mainsite-motor] Falha no Job:', err);
    }
  },
};
