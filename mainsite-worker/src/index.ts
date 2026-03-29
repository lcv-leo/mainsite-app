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

// --- Polyfill: Headers.raw() exigido por algumas dependências ---
if (typeof Headers !== 'undefined' && !(Headers.prototype as unknown as Record<string, unknown>).raw) {
  (Headers.prototype as unknown as Record<string, unknown>).raw = function (this: Headers) {
    const raw: Record<string, string[]> = {};
    this.forEach((value, key) => { raw[key] = [value]; });
    return raw;
  };
}

const app = new Hono<{ Bindings: Env }>();

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

// ========== RATE LIMITING (in-memory, paridade monolito) ==========

const ipCache = new Map<string, { count: number; firstRequest: number }>();
let cachedRlConfig: ReturnType<typeof normalizeRlConfig> | null = null;
let rlConfigLastFetched = 0;

interface RlBucket { enabled: boolean; maxRequests: number; windowMinutes: number }
interface RlConfig { chatbot: RlBucket; email: RlBucket }

const DEFAULT_RL: RlConfig = {
  chatbot: { enabled: false, maxRequests: 5, windowMinutes: 1 },
  email: { enabled: false, maxRequests: 3, windowMinutes: 15 },
};

function normalizeRlConfig(raw: Record<string, unknown> | null): RlConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_RL;

  // Retrocompatibilidade com config legada { enabled, maxRequests, windowMinutes }
  if ('enabled' in raw || 'maxRequests' in raw || 'windowMinutes' in raw) {
    return {
      chatbot: {
        enabled: Boolean(raw.enabled),
        maxRequests: Math.max(1, Number(raw.maxRequests) || DEFAULT_RL.chatbot.maxRequests),
        windowMinutes: Math.max(1, Number(raw.windowMinutes) || DEFAULT_RL.chatbot.windowMinutes),
      },
      email: { ...DEFAULT_RL.email },
    };
  }

  const normalizeBucket = (bucket: Record<string, unknown> | undefined, fallback: RlBucket): RlBucket => ({
    enabled: Boolean(bucket?.enabled),
    maxRequests: Math.max(1, Number(bucket?.maxRequests) || fallback.maxRequests),
    windowMinutes: Math.max(1, Number(bucket?.windowMinutes) || fallback.windowMinutes),
  });

  return {
    chatbot: normalizeBucket(raw.chatbot as Record<string, unknown>, DEFAULT_RL.chatbot),
    email: normalizeBucket(raw.email as Record<string, unknown>, DEFAULT_RL.email),
  };
}

async function getRateLimitConfig(env: Env): Promise<RlConfig> {
  const now = Date.now();
  if (!cachedRlConfig || now - rlConfigLastFetched > 60000) {
    try {
      const record = await env.DB.prepare("SELECT payload FROM mainsite_settings WHERE id = 'mainsite/ratelimit'").first<{ payload: string }>();
      const parsed = record ? JSON.parse(record.payload) : DEFAULT_RL;
      cachedRlConfig = normalizeRlConfig(parsed);
      rlConfigLastFetched = now;
    } catch {
      cachedRlConfig = DEFAULT_RL;
    }
  }
  return cachedRlConfig;
}

function createRateLimiterMiddleware(bucketName: keyof RlConfig) {
  return async (c: { req: { header: (name: string) => string | undefined }; json: (data: unknown, status?: number) => Response; env: Env }, next: () => Promise<void>) => {
    const now = Date.now();
    const config = await getRateLimitConfig(c.env);
    const bucket = config[bucketName] || DEFAULT_RL[bucketName];
    if (!bucket?.enabled) return next();

    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const key = `${bucketName}:${ip}`;
    const windowMs = (bucket.windowMinutes || 1) * 60000;
    const maxReq = bucket.maxRequests || 5;

    if (!ipCache.has(key)) {
      ipCache.set(key, { count: 1, firstRequest: now });
    } else {
      const data = ipCache.get(key)!;
      if (now - data.firstRequest > windowMs) {
        ipCache.set(key, { count: 1, firstRequest: now });
      } else {
        data.count++;
        if (data.count > maxReq) {
          const errMsg = bucketName === 'email'
            ? 'Limite de envios de e-mail excedido. Aguarde alguns instantes.'
            : 'Limite de requisições de IA excedido. Aguarde alguns instantes.';
          return c.json({ error: errMsg }, 429);
        }
      }
    }

    // Limpeza probabilística do cache de IPs
    if (Math.random() < 0.05) {
      for (const [cacheKey, value] of ipCache.entries()) {
        if (!cacheKey.startsWith(`${bucketName}:`)) continue;
        if (now - value.firstRequest > windowMs) ipCache.delete(cacheKey);
      }
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
