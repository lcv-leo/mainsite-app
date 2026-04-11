/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Abstração centralizada do @google/genai SDK para o mainsite-worker.
 *
 * Responsabilidades:
 * - Factory do GoogleGenAI (per-request, pois apiKey vem do env)
 * - Configuração padronizada de safety settings
 * - Helper de geração tipada com logging estruturado
 * - Token counting tipado
 */
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { structuredLog } from './logger.ts';

// ========== CONFIG CENTRALIZADA ==========

/** Fallback model when admin has not configured one */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

export const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export const ENDPOINT_CONFIGS = {
  transform: { maxOutputTokens: 8192, temperature: 0.5 },
  chat: { maxOutputTokens: 8192, temperature: 0.3 },
  shareSummary: { maxOutputTokens: 8192, temperature: 0.3 },
} as const;

export type EndpointName = keyof typeof ENDPOINT_CONFIGS;

// ========== FACTORY ==========

import type { Env } from '../env.ts';

/** Creates a GoogleGenAI client per-request.
 *  Secret Store bindings are resolved to strings by middleware in index.ts
 *  before handlers execute, so env values are plain strings here.
 */
export function createClient(env: Env): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY
  });
}

// ========== DYNAMIC MODEL FROM ADMIN CONFIG ==========

interface MainsiteConfig {
  chat?: string;
  summary?: string;
  editor?: string;
  import?: string;
}

/**
 * Reads the Gemini model configured by the admin for the MainSite module.
 * Falls back to DEFAULT_GEMINI_MODEL if no model is configured.
 *
 * @param db - D1 database binding (same bigdata_db used by admin-app)
 * @param configKey - which model to read: 'chat' or 'summary'
 */
export async function getConfiguredModel(
  db: D1Database,
  configKey: keyof MainsiteConfig = 'chat',
): Promise<string> {
  try {
    const row = await db.prepare(
      'SELECT payload FROM mainsite_settings WHERE id = ? LIMIT 1'
    ).bind('mainsite/ai_models').first<{ payload: string }>();

    if (row?.payload) {
      const parsed = JSON.parse(row.payload) as MainsiteConfig;
      const model = parsed[configKey];
      if (model && model.trim().length > 0) {
        return model.trim();
      }
    }
  } catch (err) {
    structuredLog('warn', 'Failed to read model config from D1', {
      configKey,
      error: (err as Error).message,
    });
  }
  return DEFAULT_GEMINI_MODEL;
}

// ========== TOKEN COUNTING ==========

export async function countTokens(client: GoogleGenAI, text: string, model?: string): Promise<number> {
  if (!text) return 0;
  try {
    const result = await client.models.countTokens({
      model: model || DEFAULT_GEMINI_MODEL,
      contents: text,
    });
    return result.totalTokens ?? 0;
  } catch (err) {
    structuredLog('warn', 'SDK countTokens failed', { error: (err as Error).message });
    return 0;
  }
}

// ── Telemetria: registra uso de AI no BIGDATA_DB ──
function logAiUsage(
  db: D1Database | undefined,
  entry: { module: string; model: string; input_tokens: number; output_tokens: number; latency_ms: number; status: string; error_detail?: string },
) {
  if (!db) return;
  (async () => {
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS ai_usage_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT, timestamp TEXT NOT NULL DEFAULT (datetime('now')),
          module TEXT NOT NULL, model TEXT NOT NULL, input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0, latency_ms INTEGER DEFAULT 0,
          status TEXT DEFAULT 'ok', error_detail TEXT
        )
      `).run();
      await db.prepare(`
        INSERT INTO ai_usage_logs (module, model, input_tokens, output_tokens, latency_ms, status, error_detail)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        entry.module, entry.model,
        entry.input_tokens, entry.output_tokens,
        entry.latency_ms, entry.status,
        entry.error_detail || null,
      ).run();
    } catch (err) {
      console.warn('[mainsite-motor] [telemetry] ai_usage_logs INSERT failed:', err instanceof Error ? err.message : err);
    }
  })();
}

// ========== CONTENT GENERATION (with retry) ==========

interface GenerateOptions {
  client: GoogleGenAI;
  prompt: string;
  endpoint: EndpointName;
  model?: string;
  enableThinking?: boolean;
  /** Optional D1Database for telemetry logging (ai_usage_logs) */
  db?: D1Database;
}

/**
 * Generates content via Gemini SDK with structured logging and retry.
 * Returns the full SDK response for the caller to extract what it needs.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateContentResponse> {
  const { client, prompt, endpoint, model, enableThinking = true, db } = opts;
  const config = ENDPOINT_CONFIGS[endpoint];
  const resolvedModel = model || DEFAULT_GEMINI_MODEL;

  let lastError: unknown;
  const _telStart = Date.now();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      structuredLog('info', `Gemini SDK request attempt ${attempt}`, { endpoint, attempt, model: resolvedModel });

      const isThinkingModel = resolvedModel.includes('thinking');
      const response = await client.models.generateContent({
        model: resolvedModel,
        contents: prompt,
        config: {
          temperature: config.temperature,
          maxOutputTokens: config.maxOutputTokens,
          safetySettings: GEMINI_SAFETY_SETTINGS,
          ...(enableThinking && isThinkingModel ? { thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH } } : {}),
        },
      });

      structuredLog('info', 'Gemini SDK request succeeded', {
        endpoint,
        attempt,
        promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        cachedTokens: response.usageMetadata?.cachedContentTokenCount ?? 0,
      });

      // Telemetria de sucesso
      void logAiUsage(db, {
        module: `mainsite-${endpoint}`, model: resolvedModel,
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        latency_ms: Date.now() - _telStart, status: 'ok'
      });

      return response;
    } catch (err) {
      lastError = err;
      structuredLog('warn', 'Gemini SDK request failed', {
        endpoint,
        attempt,
        error: (err as Error).message,
      });

      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  structuredLog('error', 'Gemini SDK request exhausted retries', {
    endpoint,
    totalAttempts: MAX_RETRIES,
    lastError: (lastError as Error)?.message,
  });

  // Telemetria de falha
  void logAiUsage(db, {
    module: `mainsite-${endpoint}`, model: resolvedModel,
    input_tokens: 0, output_tokens: 0,
    latency_ms: Date.now() - _telStart, status: 'error',
    error_detail: ((lastError as Error)?.message || 'Unknown').slice(0, 200),
  });

  throw new Error(`Gemini API failed after ${MAX_RETRIES} attempts: ${(lastError as Error)?.message}`);
}

// ========== USAGE METADATA EXTRACTION ==========

export function extractUsage(response: GenerateContentResponse) {
  return {
    promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    cachedTokens: response.usageMetadata?.cachedContentTokenCount ?? 0,
  };
}

// ========== TEXT EXTRACTION (filters thought parts) ==========

/**
 * Extracts text from the response, filtering out thinking/thought parts.
 * Uses the SDK's built-in `.text` accessor when available.
 */
export function extractText(response: GenerateContentResponse): string {
  // The SDK's .text getter auto-filters thought parts
  try {
    return response.text ?? '';
  } catch {
    // Fallback: manual extraction if .text throws (e.g. no candidates)
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return parts
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('');
  }
}

