/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * Rotas de PIX.
 * Domínio: /api/pix/*
 */
import { Hono } from 'hono';
import type { Env } from '../env.ts';
import { structuredLog } from '../lib/logger.ts';

const misc = new Hono<{ Bindings: Env }>();



export default misc;
