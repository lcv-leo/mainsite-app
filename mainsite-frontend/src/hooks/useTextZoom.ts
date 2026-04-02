/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Hook: useTextZoom
// Purpose: Manage text zoom state with localStorage persistence
// Features: range 80-200%, 5% steps, smooth scaling, keyboard accessible

import { useState, useEffect, useCallback } from 'react';

const MIN_ZOOM = 0.8;
const MAX_ZOOM = 2.0;
const STEP = 0.05;
const STORAGE_KEY = 'mainsite:text-zoom-level';

interface UseTextZoomReturn {
  zoomLevel: number;
  percentage: number;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
  setZoomLevel: (level: number) => void;
}

export const useTextZoom = (): UseTextZoomReturn => {
  const [zoomLevel, setZoomLevelState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseFloat(stored);
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, parsed));
      }
    } catch (e) {
      console.warn('Failed to read zoom level from localStorage:', e);
    }
    return 1.0;
  });

  // Persist zoom level to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, zoomLevel.toString());
    } catch (e) {
      console.warn('Failed to save zoom level to localStorage:', e);
    }
  }, [zoomLevel]);

  const setZoomLevel = useCallback((level: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(level / STEP) * STEP));
    setZoomLevelState(clamped);
  }, []);

  const increase = useCallback(() => {
    setZoomLevel(zoomLevel + STEP);
  }, [zoomLevel, setZoomLevel]);

  const decrease = useCallback(() => {
    setZoomLevel(zoomLevel - STEP);
  }, [zoomLevel, setZoomLevel]);

  const reset = useCallback(() => {
    setZoomLevel(1.0);
  }, [setZoomLevel]);

  return {
    zoomLevel,
    percentage: Math.round(zoomLevel * 100),
    increase,
    decrease,
    reset,
    setZoomLevel,
  };
};
