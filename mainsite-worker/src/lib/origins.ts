/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

export const ALLOWED_FRONTEND_DOMAINS = [
  'reflexosdaalma.blog',
  'lcv.rio.br',
  'lcv.eng.br',
  'lcv.psc.br',
  'cardozovargas.com',
  'cardozovargas.com.br',
  'lcvleo.com',
  'lcvmail.com',
  'lcvmasker.com',
];

export const ALLOWED_ORIGIN_HOSTNAMES = new Set<string>(
  ALLOWED_FRONTEND_DOMAINS.flatMap((domain) => [domain, `www.${domain}`]),
);

export function getAllowedOrigin(origin: string | null | undefined): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== 'https:') return null;
    const hostname = url.hostname.toLowerCase();
    return ALLOWED_ORIGIN_HOSTNAMES.has(hostname) ? origin : null;
  } catch {
    return null;
  }
}
