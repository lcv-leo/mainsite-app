/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextZoom } from './useTextZoom';

const STORAGE_KEY = 'mainsite:text-zoom-level';

describe('useTextZoom', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('initializes at 1.0 (100%) when no stored value', () => {
    const { result } = renderHook(() => useTextZoom());
    expect(result.current.zoomLevel).toBe(1.0);
    expect(result.current.percentage).toBe(100);
  });

  it('initializes from localStorage when present', () => {
    localStorage.setItem(STORAGE_KEY, '1.25');
    const { result } = renderHook(() => useTextZoom());
    expect(result.current.zoomLevel).toBeCloseTo(1.25);
    expect(result.current.percentage).toBe(125);
  });

  it('clamps stored value above MAX_ZOOM (2.0)', () => {
    localStorage.setItem(STORAGE_KEY, '5.0');
    const { result } = renderHook(() => useTextZoom());
    expect(result.current.zoomLevel).toBe(2.0);
  });

  it('clamps stored value below MIN_ZOOM (0.8)', () => {
    localStorage.setItem(STORAGE_KEY, '0.1');
    const { result } = renderHook(() => useTextZoom());
    expect(result.current.zoomLevel).toBe(0.8);
  });

  it('increase() adds 5% step', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.increase();
    });
    expect(result.current.zoomLevel).toBeCloseTo(1.05);
  });

  it('decrease() subtracts 5% step', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.decrease();
    });
    expect(result.current.zoomLevel).toBeCloseTo(0.95);
  });

  it('reset() restores to 1.0', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.setZoomLevel(1.5);
    });
    expect(result.current.zoomLevel).toBeCloseTo(1.5);
    act(() => {
      result.current.reset();
    });
    expect(result.current.zoomLevel).toBe(1.0);
  });

  it('persists to localStorage on change', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.setZoomLevel(1.3);
    });
    expect(Number(localStorage.getItem(STORAGE_KEY))).toBeCloseTo(1.3);
  });

  it('setZoomLevel clamps to max 2.0', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.setZoomLevel(10);
    });
    expect(result.current.zoomLevel).toBe(2.0);
  });

  it('setZoomLevel clamps to min 0.8', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.setZoomLevel(0.1);
    });
    expect(result.current.zoomLevel).toBe(0.8);
  });
});
