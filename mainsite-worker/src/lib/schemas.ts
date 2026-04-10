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
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(1),
  phone: z.string().optional(),
});
export type ContactInput = z.infer<typeof ContactSchema>;

/** POST /api/comment (email ao admin) */
export const CommentEmailSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  message: z.string().min(1),
  post_title: z.string().optional(),
});
export type CommentEmailInput = z.infer<typeof CommentEmailSchema>;

/** POST /api/ai/public/chat */
export const ChatInputSchema = z.object({
  message: z.string().min(1),
  currentContext: z
    .object({
      title: z.string().optional(),
      content: z.string().optional(),
    })
    .optional(),
  askForDonation: z.boolean().optional(),
});
export type ChatInput = z.infer<typeof ChatInputSchema>;

/** POST /api/share/email */
export const ShareEmailSchema = z.object({
  post_id: z.string().optional(),
  post_title: z.string().optional(),
  link: z.string().url().optional(),
  target_email: z.string().email(),
});
export type ShareEmailInput = z.infer<typeof ShareEmailSchema>;

/** POST /api/comments (comentário público com moderação) */
export const NewCommentSchema = z.object({
  post_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  author_name: z.string().max(100).optional(),
  author_email: z.string().max(255).optional(),
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
});
export type SumupCheckoutInput = z.infer<typeof SumupCheckoutSchema>;

/** POST /api/sumup/checkout/:id/pay */
export const SumupPaySchema = z.object({
  baseAmount: z.union([z.number(), z.string()]).optional(),
  coverFees: z.boolean().optional(),
  card: z
    .object({
      name: z.string(),
      number: z.string(),
      expiryMonth: z.string(),
      expiryYear: z.string(),
      cvv: z.string(),
    })
    .optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  document: z.string().optional(),
});
export type SumupPayInput = z.infer<typeof SumupPaySchema>;

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

/**
 * Secrets do Worker após resolução pelo middleware SecretStore.
 * Todos opcionais para não bloquear deploy em caso de secret temporariamente
 * indisponível — ausências são logadas como warn para visibilidade.
 */
export const EnvSecretsSchema = z.object({
  CLOUDFLARE_PW:              z.string().min(1).optional(),
  GEMINI_API_KEY:             z.string().min(1).optional(),
  RESEND_API_KEY:             z.string().min(1).optional(),
  SUMUP_API_KEY_PRIVATE:      z.string().min(1).optional(),
  SUMUP_MERCHANT_CODE:        z.string().min(1).optional(),
  MP_ACCESS_TOKEN:            z.string().min(1).optional(),
  MERCADO_PAGO_WEBHOOK_SECRET:z.string().min(1).optional(),
  PIX_KEY:                    z.string().min(1).optional(),
  PIX_NAME:                   z.string().min(1).optional(),
  PIX_CITY:                   z.string().min(1).optional(),
  GCP_NL_API_KEY:             z.string().min(1).optional(),
  TURNSTILE_SECRET_KEY:       z.string().min(1).optional(),
});
