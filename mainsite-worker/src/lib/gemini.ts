/**
 * Utilitário compartilhado para chamadas Gemini (summary generation).
 * Extraído para evitar duplicação com ai.ts.
 */
import { structuredLog } from './logger.ts';

// ========== CONFIG ==========

const GEMINI_MODEL = 'gemini-pro-latest';
const GEMINI_VERSION = 'v1beta';

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
 * Gera dois resumos otimizados para compartilhamento social via Gemini.
 * - summary_og: curto (≤ 200 chars) para og:description, twitter:description, meta description
 * - summary_ld: médio (≤ 300 chars) para Schema.org Article.description
 *
 * @returns null se falhar (caller deve usar fallback)
 */
export async function generateShareSummary(
  title: string,
  content: string,
  apiKey: string
): Promise<ShareSummaryResult | null> {
  const cleanText = stripHtml(content).substring(0, 2000);
  if (!cleanText || cleanText.length < 50) return null; // conteúdo muito curto, não vale resumir

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
    const url = `https://generativelanguage.googleapis.com/${GEMINI_VERSION}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 512,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    });

    if (!response.ok) {
      structuredLog('warn', 'Gemini share-summary API error', { status: response.status });
      return null;
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    };

    const rawText = (data.candidates?.[0]?.content?.parts || [])
      .filter((p) => p.text && !p.thought)
      .map((p) => p.text)
      .join('');

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
