/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Schemas Zod centralizados para validação de input nos endpoints públicos.
 * Uso: z.safeParse(await c.req.json()) nos handlers de rotas.
 */
import { z } from 'zod';

/** POST /api/contact */
export const ContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(320),
  message: z.string().min(1).max(5000),
  phone: z.string().max(30).optional(),
  turnstile_token: z.string().optional(),
});
export type ContactInput = z.infer<typeof ContactSchema>;

/** POST /api/comment (email ao admin) */
export const CommentEmailSchema = z.object({
  name: z.string().max(200).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(320).optional(),
  message: z.string().min(1).max(5000),
  post_title: z.string().max(300).optional(),
  turnstile_token: z.string().optional(),
});
export type CommentEmailInput = z.infer<typeof CommentEmailSchema>;

/** POST /api/ai/public/chat */
export const ChatInputSchema = z.object({
  message: z.string().min(1).max(4000),
  currentContext: z
    .object({
      title: z.string().max(500).optional(),
      content: z.string().optional(),
    })
    .nullish(),
  askForDonation: z.boolean().optional(),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

/** POST /api/share/email */
export const ShareEmailSchema = z.object({
  post_id: z.union([z.string(), z.number()]),
  post_title: z.string().max(300),
  link: z.string().url(),
  target_email: z.string().email(),
  turnstile_token: z.string().min(1),
});
export type ShareEmailInput = z.infer<typeof ShareEmailSchema>;

/** POST /api/comments (comentário público com moderação) */
export const NewCommentSchema = z.object({
  post_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  author_name: z.string().max(100).optional(),
  author_email: z.string().email().max(255).optional(),
  content: z.string().min(1),
  turnstile_token: z.string().optional(),
  _hp: z.string().optional(),
});
export type NewCommentInput = z.infer<typeof NewCommentSchema>;

/** POST /api/ratings */
export const RatingsSchema = z.object({
  post_id: z.number().int().positive().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  reaction_type: z.string().optional(),
});
export type RatingsInput = z.infer<typeof RatingsSchema>;

/** POST /api/sumup/checkout */
export const SumupCheckoutSchema = z.object({
  baseAmount: z.union([z.number(), z.string()]).optional(),
  coverFees: z.boolean().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  redirectUrl: z.string().url().optional(),
  sourceProject: z.string().trim().min(1).max(100).optional(),
});
export type SumupCheckoutInput = z.infer<typeof SumupCheckoutSchema>;

/** POST /api/posts, PUT /api/posts/:id (admin) */
export const PostBodySchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
});
export type PostBodyInput = z.infer<typeof PostBodySchema>;

/** PUT /api/posts/reorder (admin) */
export const PostReorderSchema = z.array(
  z.object({
    id: z.union([z.string(), z.number()]),
    display_order: z.number().int(),
  }),
);
export type PostReorderInput = z.infer<typeof PostReorderSchema>;

/** POST /api/shares (público) */
export const ShareLogSchema = z.object({
  post_id: z.union([z.string(), z.number()]).optional(),
  post_title: z.string().max(300).optional(),
  platform: z.string().max(50).optional(),
  target: z.string().max(320).optional(),
});
export type ShareLogInput = z.infer<typeof ShareLogSchema>;

/**
 * Secrets do Worker após resolução pelo middleware SecretStore.
 *
 * Camadas:
 * - "Sempre obrigatório": ausência indica deploy mal configurado; sinalização warn (não 503).
 * - "Feature-gated": runtime já é fail-closed (handlers retornam 503/410/etc. quando
 *   estes faltam). Por isso NÃO são `.optional()` — o schema reflete o contrato real
 *   exigido pelos handlers (`comments.ts`, `contact.ts` etc. dependem de
 *   `TURNSTILE_SECRET_KEY` e `GCP_NL_API_KEY`).
 * - PIX: realmente opcionais; PIX permanece desabilitado se ausentes.
 */
export const EnvSecretsSchema = z.object({
  // Sempre obrigatório
  CLOUDFLARE_PW: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  SUMUP_API_KEY_PRIVATE: z.string().min(1),
  SUMUP_MERCHANT_CODE: z.string().min(1),
  // Feature-gated (handlers retornam 503 quando faltam): require para alinhar schema/runtime
  GCP_NL_API_KEY: z.string().min(1),
  TURNSTILE_SECRET_KEY: z.string().min(1),
  // Realmente opcional — PIX desabilitado quando ausente
  PIX_KEY: z.string().min(1).optional(),
  PIX_NAME: z.string().min(1).optional(),
  PIX_CITY: z.string().min(1).optional(),
});
