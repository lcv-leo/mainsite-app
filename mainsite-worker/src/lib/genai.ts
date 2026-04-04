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
export const DEFAULT_GEMINI_MODEL = '';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;

export const GEMINI_SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
];

export const ENDPOINT_CONFIGS = {
  transform: { maxOutputTokens: 6000, temperature: 0.5 },
  chat: { maxOutputTokens: 8192, temperature: 0.3 },
  summarize: { maxOutputTokens: 4096, temperature: 0.4 },
  translate: { maxOutputTokens: 5000, temperature: 0.2 },
  shareSummary: { maxOutputTokens: 512, temperature: 0.3 },
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
    apiKey: env.GEMINI_API_KEY,
    httpOptions: {
      baseUrl: 'https://gateway.ai.cloudflare.com/v1/d65b76a0e64c3791e932edd9163b1c71/workspace-gateway/google-ai-studio',
      headers: {
        'cf-aig-authorization': `Bearer ${env.CF_AI_GATEWAY}`,
      },
    },
  });
}

// ========== DYNAMIC MODEL FROM ADMIN CONFIG ==========

interface MainsiteConfig {
  chat?: string;
  summary?: string;
  reader?: string;
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

// ========== CONTENT GENERATION (with retry) ==========

interface GenerateOptions {
  client: GoogleGenAI;
  prompt: string;
  endpoint: EndpointName;
  model?: string;
  enableThinking?: boolean;
}

/**
 * Generates content via Gemini SDK with structured logging and retry.
 * Returns the full SDK response for the caller to extract what it needs.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateContentResponse> {
  const { client, prompt, endpoint, model, enableThinking = true } = opts;
  const config = ENDPOINT_CONFIGS[endpoint];
  const resolvedModel = model || DEFAULT_GEMINI_MODEL;

  let lastError: unknown;

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
