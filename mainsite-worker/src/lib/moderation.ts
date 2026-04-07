/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Módulo de Moderação de Conteúdo via Google Cloud Natural Language API v2.
 * Utiliza REST direto (SDK @google-cloud/language requer gRPC, incompatível com Workers).
 *
 * Responsabilidades:
 * - Chamada à API moderateText v2
 * - Decision engine (auto-approve / hold / auto-reject)
 * - Hashing de IP para dedup sem cookies
 * - Notificação por email via Resend
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModerationCategory {
  name: string;
  confidence: number;
}

export interface ModerationResult {
  categories: ModerationCategory[];
  languageCode: string;
  languageSupported: boolean;
}

export interface ModerationDecision {
  action: 'approved' | 'pending' | 'rejected_auto';
  maxScore: number;
  triggerCategory: string | null;
  reason: string;
}

export interface ModerationSettings {
  autoApproveThreshold: number;
  autoRejectThreshold: number;
  criticalCategories: string[];
  requireApproval: boolean;
  commentsEnabled: boolean;
  ratingsEnabled: boolean;
  allowAnonymous: boolean;
  maxCommentLength: number;
  maxNestingDepth: number;
}

// ── GCP Natural Language API v2 — moderateText ──────────────────────────────

const GCP_NL_API_URL = 'https://language.googleapis.com/v2/documents:moderateText';

/**
 * Chama a API moderateText v2 do Google Cloud Natural Language.
 * Retorna scores de 16 categorias de segurança.
 * Em caso de falha, retorna categorias vazias (graceful degradation → pending).
 */
export async function moderateText(content: string, apiKey: string): Promise<ModerationResult> {
  try {
    const response = await fetch(`${GCP_NL_API_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document: {
          type: 'PLAIN_TEXT',
          content,
          languageCode: 'pt',
        },
        modelVersion: 'MODEL_VERSION_2',
      }),
    });

    if (!response.ok) {
      console.error(`[Moderation] GCP NL API error: ${response.status} ${response.statusText}`);
      return { categories: [], languageCode: 'pt', languageSupported: true };
    }

    const data = (await response.json()) as {
      moderationCategories?: ModerationCategory[];
      languageCode?: string;
      languageSupported?: boolean;
    };

    return {
      categories: data.moderationCategories || [],
      languageCode: data.languageCode || 'pt',
      languageSupported: data.languageSupported ?? true,
    };
  } catch (err) {
    console.error('[Moderation] Falha na chamada GCP NL API:', err);
    // Graceful degradation: sem scores → status 'pending' para revisão manual
    return { categories: [], languageCode: 'pt', languageSupported: true };
  }
}

// ── Decision Engine ─────────────────────────────────────────────────────────

/**
 * Avalia os scores de moderação e decide o status do comentário.
 * 
 * Lógica tri-fásica:
 * 1. Se requireApproval = true → sempre 'pending'
 * 2. Se qualquer categoria crítica > autoRejectThreshold → 'rejected_auto'
 * 3. Se qualquer categoria crítica > autoApproveThreshold → 'pending'
 * 4. Se todas abaixo de autoApproveThreshold → 'approved'
 * 5. Sem scores (API falhou) → 'pending'
 */
export function evaluateModeration(
  result: ModerationResult,
  settings: ModerationSettings,
): ModerationDecision {
  // Sem scores disponíveis (API offline) → revisão manual
  if (!result.categories || result.categories.length === 0) {
    return {
      action: 'pending',
      maxScore: 0,
      triggerCategory: null,
      reason: 'API de moderação indisponível — aguardando revisão manual',
    };
  }

  // Se requireApproval = true, TODOS os comentários vão para revisão
  if (settings.requireApproval) {
    const criticalScores = result.categories
      .filter(c => settings.criticalCategories.includes(c.name));
    const maxCritical = criticalScores.reduce(
      (max, c) => (c.confidence > max.confidence ? c : max),
      { name: '', confidence: 0 },
    );
    return {
      action: 'pending',
      maxScore: maxCritical.confidence,
      triggerCategory: maxCritical.name || null,
      reason: 'Moderação obrigatória habilitada',
    };
  }

  // Filtra apenas categorias críticas (as que indicam conteúdo prejudicial)
  const criticalScores = result.categories
    .filter(c => settings.criticalCategories.includes(c.name));

  if (criticalScores.length === 0) {
    return {
      action: 'approved',
      maxScore: 0,
      triggerCategory: null,
      reason: 'Nenhuma categoria crítica detectada',
    };
  }

  // Encontra o score mais alto entre categorias críticas
  const maxCritical = criticalScores.reduce(
    (max, c) => (c.confidence > max.confidence ? c : max),
    { name: '', confidence: 0 },
  );

  // Auto-reject: score alto em categoria crítica
  if (maxCritical.confidence >= settings.autoRejectThreshold) {
    return {
      action: 'rejected_auto',
      maxScore: maxCritical.confidence,
      triggerCategory: maxCritical.name,
      reason: `Score ${maxCritical.confidence.toFixed(2)} em "${maxCritical.name}" excede limite de rejeição (${settings.autoRejectThreshold})`,
    };
  }

  // Pending: score moderado — necessita revisão humana
  if (maxCritical.confidence >= settings.autoApproveThreshold) {
    return {
      action: 'pending',
      maxScore: maxCritical.confidence,
      triggerCategory: maxCritical.name,
      reason: `Score ${maxCritical.confidence.toFixed(2)} em "${maxCritical.name}" entre limites — revisão necessária`,
    };
  }

  // Auto-approve: todos os scores baixos
  return {
    action: 'approved',
    maxScore: maxCritical.confidence,
    triggerCategory: null,
    reason: 'Todos os scores abaixo do limite de aprovação',
  };
}

// ── IP Hashing (cookie-free dedup) ──────────────────────────────────────────

/**
 * Gera hash SHA-256 para identificação anônima de visitante.
 * Utiliza Web Crypto API nativa do Workers runtime.
 * Sem cookies, sem localStorage, sem tracking.
 */
export async function hashIdentity(ip: string, userAgent: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${ip}:${userAgent}:${salt}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Turnstile Verification ──────────────────────────────────────────────────

/**
 * Verifica token do Cloudflare Turnstile (CAPTCHA invisível).
 * @returns true se o token é válido, false caso contrário
 */
export async function verifyTurnstile(token: string, secretKey: string, ip: string): Promise<boolean> {
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
        remoteip: ip,
      }).toString(),
    });

    if (!response.ok) return false;
    const data = (await response.json()) as { success: boolean };
    return data.success === true;
  } catch {
    console.error('[Turnstile] Falha na verificação');
    return false;
  }
}

// ── Email Notification ──────────────────────────────────────────────────────

/**
 * Envia notificação por email ao admin via Resend quando um comentário chega.
 */
export async function notifyAdminNewComment(
  resendApiKey: string,
  comment: { authorName: string; content: string; postTitle: string; status: string },
): Promise<void> {
  const statusLabel = comment.status === 'approved' ? '✅ Aprovado automaticamente'
    : comment.status === 'rejected_auto' ? '🚫 Rejeitado automaticamente'
    : '⏳ Aguardando revisão';

  const statusColor = comment.status === 'approved' ? '#10b981'
    : comment.status === 'rejected_auto' ? '#ef4444'
    : '#f59e0b';

  const html = `
    <div style="font-family: 'Inter', system-ui, sans-serif; color: #333; max-width: 600px;">
      <h2 style="color: #000; border-bottom: 2px solid #eee; padding-bottom: 10px;">
        Novo Comentário Público no MainSite
      </h2>
      <p><strong>Matéria:</strong> ${comment.postTitle}</p>
      <p><strong>Autor:</strong> ${comment.authorName}</p>
      <p>
        <strong>Status:</strong>
        <span style="color: ${statusColor}; font-weight: 700;">${statusLabel}</span>
      </p>
      <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid ${statusColor}; margin-top: 20px; border-radius: 0 8px 8px 0;">
        <p style="margin: 0; white-space: pre-wrap;">${comment.content}</p>
      </div>
      <p style="margin-top: 20px; font-size: 12px; color: #999;">
        Gerencie comentários no painel admin → MainSite → Moderação
      </p>
    </div>
  `;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Reflexos da Alma <mainsite@lcv.app.br>',
        to: 'cal@reflexosdaalma.blog',
        subject: `${statusLabel} — Comentário de ${comment.authorName}: ${comment.postTitle}`,
        html,
      }),
    });
  } catch (err) {
    console.error('[Moderation] Falha ao enviar notificação:', err);
  }
}
