/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * IndexNow client — notifica buscadores (Bing, Yandex, Seznam, Naver, Yep)
 * que uma URL foi criada ou atualizada, acelerando a indexação.
 *
 * Especificação: https://www.indexnow.org/documentation
 *
 * Uso típico (fire-and-forget via executionCtx.waitUntil):
 *   c.executionCtx.waitUntil(pingIndexNow([`${SITE_URL}/p/${id}`]));
 *
 * O arquivo de validação da chave deve estar acessível em
 * https://{HOST}/{INDEXNOW_KEY}.txt contendo apenas a chave em texto puro.
 */

import { structuredLog } from './logger.ts';

export const INDEXNOW_KEY = 'c8f3a7d6b2e9415d8f3c7a6b9e2d4f8c';
export const INDEXNOW_HOST = 'www.reflexosdaalma.blog';
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/IndexNow';

export async function pingIndexNow(urlList: string[]): Promise<void> {
  if (!urlList || urlList.length === 0) return;

  try {
    const body = {
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      urlList,
    };

    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      structuredLog('warn', '[IndexNow] non-OK status', { status: res.status, count: urlList.length });
      return;
    }

    structuredLog('info', '[IndexNow] pinged', { count: urlList.length, status: res.status });
  } catch (err) {
    structuredLog('warn', '[IndexNow] ping failed', { error: (err as Error).message });
  }
}

export function postUrl(postId: string | number): string {
  return `https://${INDEXNOW_HOST}/p/${postId}`;
}
