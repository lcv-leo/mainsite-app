/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * v03.22.00 / mainsite-app audit closure (MEDIUM): centralized fetch
 * timeout wrapper. Pre-fix every component called `fetch()` directly,
 * with no AbortController and no upper bound on response time. A slow
 * Worker (cold start, AI route under load) could leave the UI in an
 * indefinite loading state, plus consume open sockets. This helper
 * provides:
 *
 *   - default 8s timeout for normal API calls
 *   - explicit `signal` override for callers that already manage one
 *     (e.g. polling loops with their own AbortController)
 *   - a typed exception (`HttpTimeoutError`) so callers can branch
 *     between "user network is slow" and "real server error"
 *
 * The default 8s is generous for the worker's typical 200-2000ms
 * response window but short enough that a loading UI feels broken to
 * the user before it fires.
 */
export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export class HttpTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'HttpTimeoutError';
  }
}

export type FetchWithTimeoutInit = RequestInit & { timeoutMs?: number };

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: FetchWithTimeoutInit = {},
): Promise<Response> {
  const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, signal: externalSignal, ...rest } = init;
  // If the caller already passed a signal, compose: we still abort on
  // our own timeout, AND we abort if their signal aborts.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  try {
    return await fetch(input, { ...rest, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // Distinguish OUR timeout from the caller's external abort.
      if (externalSignal?.aborted) throw err;
      throw new HttpTimeoutError(String(input), timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
