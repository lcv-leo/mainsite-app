/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import type { Context, Next } from 'hono';
import type { Env } from '../env.ts';

/**
 * Comparação constant-time de duas strings.
 * Previne timing attacks ao garantir tempo de execução independente do conteúdo.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compara contra si mesmo para manter tempo constante mesmo com tamanhos diferentes
    const dummy = new TextEncoder().encode(a);
    crypto.subtle.timingSafeEqual(dummy, dummy);
    return false;
  }
  const encoder = new TextEncoder();
  return crypto.subtle.timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

/**
 * Middleware de autenticação por Bearer token.
 * Compara o header Authorization com CLOUDFLARE_PW do environment.
 * Usa comparação constant-time para prevenir timing attacks.
 */
interface JwtConfig {
  teamDomain?: string;
  audience?: string;
  enforcement?: string;
}

interface AuthContext {
  isAuthenticated: boolean;
  source?: 'bearer' | 'cloudflare-access' | 'none';
  error?: string;
}

type JwksKey = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

let cachedJwks: JwksKey[] | null = null;
let cachedJwksTeamDomain: string | null = null;

function base64UrlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function parseExpectedAudiences(raw: string | undefined): string[] {
  return String(raw || '')
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function audienceMatches(tokenAudience: string | string[] | undefined, expectedAudiences: string[]): boolean {
  const tokenAudiences = Array.isArray(tokenAudience)
    ? tokenAudience.map((item) => item.trim()).filter(Boolean)
    : typeof tokenAudience === 'string'
      ? [tokenAudience.trim()].filter(Boolean)
      : [];
  return expectedAudiences.some((aud) => tokenAudiences.includes(aud));
}

async function fetchJwks(teamDomain: string): Promise<JwksKey[]> {
  if (cachedJwks && cachedJwksTeamDomain === teamDomain) {
    return cachedJwks;
  }
  const res = await fetch(`https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`);
  if (!res.ok) {
    throw new Error(`JWKS fetch failed: ${res.status}`);
  }
  const body = await res.json() as { keys?: JwksKey[] };
  const keys = Array.isArray(body?.keys) ? body.keys : [];
  cachedJwks = keys;
  cachedJwksTeamDomain = teamDomain;
  return keys;
}

async function verifyJwt(jwt: string, teamDomain: string, expectedAudiences: string[]): Promise<{ valid: boolean; email?: string; error?: string }> {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) return { valid: false, error: 'JWT malformado.' };

    const [headerB64, payloadB64, signatureB64] = parts;
    const headerJson = JSON.parse(new TextDecoder().decode(base64UrlDecode(headerB64))) as { kid?: string; alg?: string };
    const payloadJson = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64))) as {
      aud?: string | string[];
      email?: string;
      exp?: number;
      iat?: number;
      iss?: string;
      nbf?: number;
    };

    if (headerJson.alg !== 'RS256') return { valid: false, error: `Algoritmo JWT inesperado: ${headerJson.alg}` };

    const now = Math.floor(Date.now() / 1000);
    if (payloadJson.exp && now > payloadJson.exp + 30) return { valid: false, error: 'JWT expirado.' };
    if (payloadJson.iat && payloadJson.iat > now + 30) return { valid: false, error: 'JWT com iat no futuro.' };
    if (payloadJson.nbf && payloadJson.nbf > now + 30) return { valid: false, error: 'JWT ainda não está válido.' };

    const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
    if (payloadJson.iss !== expectedIssuer) return { valid: false, error: 'Issuer JWT inválido.' };
    if (!audienceMatches(payloadJson.aud, expectedAudiences)) return { valid: false, error: 'Audience JWT inválido.' };

    const keys = await fetchJwks(teamDomain);
    const signingKey = keys.find((key) => (!headerJson.kid || key.kid === headerJson.kid) && key.kty === 'RSA');
    if (!signingKey?.n || !signingKey?.e) return { valid: false, error: 'Chave JWT não encontrada.' };

    const publicKey = await crypto.subtle.importKey(
      'jwk',
      { kty: 'RSA', n: signingKey.n, e: signingKey.e, alg: 'RS256', use: 'sig' },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signingInput);

    if (!isValid) return { valid: false, error: 'Assinatura JWT inválida.' };
    return { valid: true, email: payloadJson.email };
  } catch (err) {
    return { valid: false, error: `Erro ao validar JWT: ${(err as Error).message}` };
  }
}

function isBrowserLikeRequest(request: Request): boolean {
  return Boolean(
    request.headers.get('Origin') ||
    request.headers.get('Sec-Fetch-Mode') ||
    request.headers.get('Sec-Fetch-Site'),
  );
}

async function validateCfAccessJwt(request: Request, cfAccessEmail: string, jwtConfig?: JwtConfig): Promise<AuthContext | null> {
  const teamDomain = jwtConfig?.teamDomain?.trim();
  if (!teamDomain) return null;

  const enforcement = jwtConfig?.enforcement?.trim()?.toLowerCase() === 'warn' ? 'warn' : 'block';
  const expectedAudiences = parseExpectedAudiences(jwtConfig?.audience);
  if (expectedAudiences.length === 0) {
    const error = 'CF Access audience não configurada.';
    if (enforcement === 'block') return { isAuthenticated: false, source: 'cloudflare-access', error };
    console.warn(`[mainsite-motor] [Auth] ${error}`);
    return null;
  }

  const jwtToken = request.headers.get('CF-Access-JWT-Assertion');
  if (!jwtToken) {
    const error = 'CF-Access-JWT-Assertion ausente.';
    if (enforcement === 'block') return { isAuthenticated: false, source: 'cloudflare-access', error };
    console.warn(`[mainsite-motor] [Auth] ${error}`);
    return null;
  }

  const result = await verifyJwt(jwtToken, teamDomain, expectedAudiences);
  if (!result.valid) {
    if (enforcement === 'block') return { isAuthenticated: false, source: 'cloudflare-access', error: result.error };
    console.warn(`[mainsite-motor] [Auth] ${result.error}`);
    return null;
  }

  if (result.email && result.email !== cfAccessEmail) {
    const error = `JWT email (${result.email}) difere do header CF Access (${cfAccessEmail}).`;
    if (enforcement === 'block') return { isAuthenticated: false, source: 'cloudflare-access', error };
    console.warn(`[mainsite-motor] [Auth] ${error}`);
  }

  return null;
}

async function validateRequestAuth(request: Request, env: Env): Promise<AuthContext> {
  const authHeader = request.headers.get('Authorization');
  const bearerTokenEnv = env.CLOUDFLARE_PW;
  const cfAccessEmail = request.headers.get('CF-Access-Authenticated-User-Email');

  if (authHeader?.startsWith('Bearer ') && bearerTokenEnv) {
    const token = authHeader.substring(7);
    if (!timingSafeEqual(token, bearerTokenEnv)) {
      return { isAuthenticated: false, source: 'bearer', error: 'Bearer token inválido.' };
    }
    if (isBrowserLikeRequest(request) && !cfAccessEmail) {
      return { isAuthenticated: false, source: 'bearer', error: 'Bearer-only auth não é permitida em requests de navegador.' };
    }
    return { isAuthenticated: true, source: 'bearer' };
  }

  if (!cfAccessEmail) {
    return { isAuthenticated: false, source: 'none', error: 'Nenhuma autenticação válida foi fornecida.' };
  }

  const jwtRejection = await validateCfAccessJwt(request, cfAccessEmail, {
    teamDomain: env.CF_ACCESS_TEAM_DOMAIN,
    audience: env.CF_ACCESS_AUD,
    enforcement: env.ENFORCE_JWT_VALIDATION,
  });
  if (jwtRejection) return jwtRejection;

  return { isAuthenticated: true, source: 'cloudflare-access' };
}

export const requireAuth = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const auth = await validateRequestAuth(c.req.raw, c.env);
  if (!auth.isAuthenticated) {
    return c.json({ error: '401', message: auth.error || 'Unauthorized' }, 401);
  }
  await next();
};

let cachedAdminEmail: string | null = null;

/**
 * Reads admin notification email from D1 settings.
 * Returns null if not configured — callers must guard against null.
 * Caches per-isolate.
 */
export async function getAdminEmail(db: D1Database): Promise<string | null> {
  if (cachedAdminEmail) return cachedAdminEmail;
  try {
    const row = await db.prepare(
      "SELECT payload FROM mainsite_settings WHERE id = 'mainsite/admin_email'"
    ).first<{ payload: string }>();
    if (row?.payload) {
      const parsed = JSON.parse(row.payload);
      if (typeof parsed.email === 'string' && parsed.email.includes('@')) {
        cachedAdminEmail = parsed.email;
        return parsed.email;
      }
    }
  } catch { /* continue */ }
  console.warn('[mainsite-motor] [Auth] Admin email not configured in D1 (mainsite/admin_email). Email notifications disabled.');
  return null;
}
