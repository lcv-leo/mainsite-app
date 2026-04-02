/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Hook: useTextZoomCloud
// Purpose: Synchronize zoom level across devices via Cloudflare D1 / KV
// Features: cloud persistence, cross-device sync

import { useEffect, useCallback } from 'react';

interface CloudSyncConfig {
  apiUrl?: string;
  userId?: string;
  enabled?: boolean;
}

export const useTextZoomCloud = (
  zoomLevel: number,
  onZoomChange: (level: number) => void,
  config: CloudSyncConfig = {}
) => {
  const { apiUrl = '/api', userId, enabled = true } = config;

  // Sync zoom to cloud on change
  useEffect(() => {
    if (!enabled || !userId) return;

    const syncToCloud = async () => {
      try {
        await fetch(`${apiUrl}/user/preferences/text-zoom`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ zoomLevel, timestamp: Date.now() }),
        });
      } catch (e) {
        console.warn('Failed to sync zoom to cloud:', e);
      }
    };

    const timer = setTimeout(syncToCloud, 500); // Debounce
    return () => clearTimeout(timer);
  }, [zoomLevel, userId, apiUrl, enabled]);

  // Load zoom from cloud on mount
  useEffect(() => {
    if (!enabled || !userId) return;

    const loadFromCloud = async () => {
      try {
        const res = await fetch(`${apiUrl}/user/preferences/text-zoom`);
        if (res.ok) {
          const data = await res.json();
          if (data.zoomLevel) {
            onZoomChange(data.zoomLevel);
          }
        }
      } catch (e) {
        console.warn('Failed to load zoom from cloud:', e);
      }
    };

    loadFromCloud();
  }, [userId, apiUrl, enabled, onZoomChange]);

  const clearCloudSync = useCallback(async () => {
    if (!enabled || !userId) return;
    try {
      await fetch(`${apiUrl}/user/preferences/text-zoom`, {
        method: 'DELETE',
      });
    } catch (e) {
      console.warn('Failed to clear cloud sync:', e);
    }
  }, [userId, apiUrl, enabled]);

  return { clearCloudSync };
};
