/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTextZoomCloud } from './useTextZoomCloud';

describe('useTextZoomCloud', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no-op when userId not provided', () => {
    renderHook(() => useTextZoomCloud(1.2, vi.fn(), { enabled: true }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no-op when enabled=false', () => {
    renderHook(() => useTextZoomCloud(1.2, vi.fn(), { userId: 'u1', enabled: false }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads zoom from cloud on mount and calls onZoomChange', async () => {
    const onZoomChange = vi.fn();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ zoomLevel: 1.3 }),
    });

    renderHook(() => useTextZoomCloud(1.0, onZoomChange, { userId: 'u1', apiUrl: '/api' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/user/preferences/text-zoom'));
    await waitFor(() => expect(onZoomChange).toHaveBeenCalledWith(1.3));
  });

  it('clearCloudSync calls DELETE when userId present', async () => {
    const onZoomChange = vi.fn();
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() =>
      useTextZoomCloud(1.0, onZoomChange, { userId: 'u1', apiUrl: '/api' }),
    );

    await result.current.clearCloudSync();
    const deleteCalls = fetchMock.mock.calls.filter((c) => c[1]?.method === 'DELETE');
    expect(deleteCalls.length).toBe(1);
    expect(deleteCalls[0][0]).toBe('/api/user/preferences/text-zoom');
  });

  it('clearCloudSync no-op when userId missing', async () => {
    const { result } = renderHook(() => useTextZoomCloud(1.0, vi.fn(), { enabled: true }));
    await result.current.clearCloudSync();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
