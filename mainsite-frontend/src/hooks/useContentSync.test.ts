/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContentSync } from './useContentSync';

describe('useContentSync', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('initializes version on first fetch without setting hasUpdate', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, updated_at: '2026-01-01', headline_post_id: 7 }),
    });

    const { result } = renderHook(() => useContentSync('/api'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // First call just records version, doesn't set hasUpdate
    expect(result.current.hasUpdate).toBe(false);
  });

  it('skips polling when document is hidden', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, updated_at: '2026-01-01', headline_post_id: 7 }),
    });

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    renderHook(() => useContentSync('/api'));
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not poll when enabled=false', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ version: 1 }) });
    renderHook(() => useContentSync('/api', false));
    await new Promise((r) => setTimeout(r, 100));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refresh() clears update state', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, updated_at: 't1', headline_post_id: 1 }),
    });

    const { result } = renderHook(() => useContentSync('/api'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // No update yet (first fetch just initializes).
    act(() => {
      result.current.refresh();
    });
    expect(result.current.hasUpdate).toBe(false);
    expect(result.current.newHeadlineId).toBeNull();
    expect(result.current.updatedAt).toBeNull();
  });

  it('silent failure on network error', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useContentSync('/api'));
    await new Promise((r) => setTimeout(r, 100));
    expect(result.current.hasUpdate).toBe(false);
  });

  it('dismiss() also clears hasUpdate flag', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ version: 1, updated_at: 't1', headline_post_id: 1 }),
    });
    const { result } = renderHook(() => useContentSync('/api'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    act(() => {
      result.current.dismiss();
    });
    expect(result.current.hasUpdate).toBe(false);
  });
});
