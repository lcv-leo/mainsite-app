/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Utilitário compartilhado para geração de resumos de compartilhamento social.
 * Usa o @google/genai SDK via lib/genai.ts.
 */
import { structuredLog } from './logger.ts';
import { createClient, generate, extractText, getConfiguredModel, DEFAULT_GEMINI_MODEL } from './genai.ts';

// ========== HASH ==========

/**
 * Gera SHA-256 hex dos primeiros `maxChars` caracteres do conteúdo.
 * Usado para detectar mudança no conteúdo e invalidar resumo IA.
 */
export async function hashContent(content: string, maxChars = 2000): Promise<string> {
  const trimmed = content.substring(0, maxChars);
  const data = new TextEncoder().encode(trimmed);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ========== STRIP HTML ==========

export function stripHtml(html: string): string {
  return (html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
}

// ========== SUMMARIZE FOR SHARING ==========

interface ShareSummaryResult {
  summary_og: string;   // ≤ 200 chars — OG / Twitter / meta description
  summary_ld: string;   // ≤ 300 chars — Schema.org JSON-LD
}

/**
 * Gera dois resumos otimizados para compartilhamento social via Gemini SDK.
 * - summary_og: curto (≤ 200 chars) para og:description, twitter:description, meta description
 * - summary_ld: médio (≤ 300 chars) para Schema.org Article.description
 *
 * @returns null se falhar (caller deve usar fallback)
 */
export async function generateShareSummary(
  db: D1Database,
  title: string,
  content: string,
  apiKey: string
): Promise<ShareSummaryResult | null> {
  const cleanText = stripHtml(content).substring(0, 2000);
  if (!cleanText || cleanText.length < 50) return null;

  const prompt = `Você é um editor de metadados de compartilhamento social para o site "Divagações Filosóficas".

Gere DOIS resumos do texto fornecido, em formato JSON puro (sem markdown, sem code fences):

{
  "summary_og": "resumo curto aqui",
  "summary_ld": "resumo médio aqui"
}

REGRAS para summary_og (preview social — WhatsApp, Facebook, Twitter):
1. MÁXIMO 180 caracteres (incluindo espaços)
2. Capturar a ideia central e o tom filosófico
3. Português brasileiro
4. Factual — descrever o que o texto aborda, sem inventar
5. Sem aspas, emojis, hashtags ou formatação HTML
6. Frase completa e autossuficiente
7. Despertar curiosidade sem ser clickbait

REGRAS para summary_ld (SEO, Schema.org):
1. MÁXIMO 280 caracteres
2. Mais detalhado que summary_og, mas ainda conciso
3. Mesmas regras de tom e factualidade

Responda APENAS com o JSON, sem explicações.

TÍTULO: ${title}
TEXTO: ${cleanText}`;

  try {
    const client = createClient(apiKey);
    const modelStr = await getConfiguredModel(db, 'summaryModeloIA');

    const response = await generate({
      client,
      prompt,
      endpoint: 'shareSummary',
      model: modelStr,
      enableThinking: false, // Thinking desnecessário para extração JSON curta
    });

    const rawText = extractText(response);
    if (!rawText) return null;

    // Parse JSON — tolerante a code fences markdown
    const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned) as { summary_og?: string; summary_ld?: string };

    if (!parsed.summary_og) return null;

    return {
      summary_og: String(parsed.summary_og).substring(0, 200).trim(),
      summary_ld: String(parsed.summary_ld || parsed.summary_og).substring(0, 300).trim(),
    };
  } catch (err) {
    structuredLog('error', 'Failed to generate share summary', { error: (err as Error).message });
    return null;
  }
}

// Re-export GEMINI_MODEL for post-summaries route to reference
export { DEFAULT_GEMINI_MODEL as GEMINI_MODEL };
