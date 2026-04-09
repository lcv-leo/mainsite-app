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
