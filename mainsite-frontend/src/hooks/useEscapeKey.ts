/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { useEffect } from 'react';

/**
 * v03.22.00 / mainsite-app audit closure (MEDIUM): centralized ESC-key
 * handler hook. Pre-fix the contact / donation / disclaimer modals only
 * closed via backdrop click, leaving keyboard-only users without a way
 * out (WCAG 2.1 Level AA recommends ESC for dialog dismissal). Each
 * modal calls this hook with `enabled` tied to its own visibility state
 * so the listener auto-detaches when the modal closes.
 */
export function useEscapeKey(onEscape: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        onEscape();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}
