/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Hook: useTextZoomAnalytics
// Purpose: Track text zoom patterns and user preferences
// Features: analytics collection, preference learning

import { useEffect, useCallback } from 'react';

interface ZoomAnalytics {
  timestamp: number;
  zoomLevel: number;
  action: 'increase' | 'decrease' | 'reset' | 'slider' | 'preset';
  sessionId: string;
}

interface TextZoomAnalyticsOptions {
  enabled?: boolean;
}

export const useTextZoomAnalytics = (
  zoomLevel: number,
  apiUrl: string = '/api',
  options: TextZoomAnalyticsOptions = {}
) => {
  const { enabled = false } = options;

  const sessionId = useCallback(() => {
    if (typeof window === 'undefined') return '';
    let sid = sessionStorage.getItem('text-zoom-session-id');
    if (!sid) {
      sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem('text-zoom-session-id', sid);
    }
    return sid;
  }, [])();

  const trackZoomChange = useCallback(
    (action: ZoomAnalytics['action']) => {
      if (!enabled) {
        return;
      }

      const analytics: ZoomAnalytics = {
        timestamp: Date.now(),
        zoomLevel,
        action,
        sessionId,
      };

      // Send to analytics endpoint
      fetch(`${apiUrl}/analytics/text-zoom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analytics),
        keepalive: true, // Ensure it's sent even if page unloads
      }).catch((e) => console.warn('Analytics tracking failed:', e));
    },
    [enabled, zoomLevel, sessionId, apiUrl]
  );

  // Track on zoom change
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const key = `text-zoom-level-${zoomLevel}`;
    const lastTracked = sessionStorage.getItem(key);
    if (!lastTracked) {
      sessionStorage.setItem(key, 'true');
      trackZoomChange('slider');
    }
  }, [enabled, zoomLevel, trackZoomChange]);

  // Get user's zoom preferences summary
  const getPreferenceSummary = useCallback(async () => {
    if (!enabled) {
      return null;
    }

    try {
      const res = await fetch(`${apiUrl}/analytics/text-zoom/summary`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Failed to fetch preference summary:', e);
    }
    return null;
  }, [apiUrl, enabled]);

  return { trackZoomChange, getPreferenceSummary, sessionId };
};
