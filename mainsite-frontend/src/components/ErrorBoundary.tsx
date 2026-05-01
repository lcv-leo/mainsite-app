/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Top-level Error Boundary.
 *
 * v03.22.00 / mainsite-app audit closure: a synchronous render exception
 * in any descendant (DOMPurify edge case, hook misuse, malformed post
 * content) collapses the entire React tree to a white screen for ALL
 * users without this boundary in place. React 19 still requires a class
 * component for `componentDidCatch` — function components do not yet
 * support error boundaries. This implementation:
 *   - shows a minimal, theme-agnostic fallback UI (works in any palette)
 *   - offers a "Recarregar" button that calls `window.location.reload()`
 *     because resetting state in-place after a real render error is
 *     usually not safe (the corrupt subtree may re-throw immediately)
 *   - logs to console and to the global `window.dataLayer` (GA4) if
 *     present, so operator-side observability captures the failure
 *
 * The boundary catches RENDER-PHASE exceptions only. Async fetch errors
 * propagate via Promise rejection and are NOT caught here — those still
 * need component-level try/catch in the relevant fetch hooks.
 */

type Props = {
  readonly children: ReactNode;
  /** Optional override for the fallback render. */
  readonly fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = {
  readonly hasError: boolean;
  readonly error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== 'undefined' && console.error) {
      console.error('[mainsite] ErrorBoundary caught:', error, info.componentStack);
    }
    type DataLayerEntry = Record<string, string | number | boolean | undefined>;
    const dl = (window as unknown as { dataLayer?: DataLayerEntry[] }).dataLayer;
    if (Array.isArray(dl)) {
      dl.push({
        event: 'exception',
        description: error.message?.slice(0, 200) ?? 'unknown',
        fatal: true,
      });
    }
  }

  private readonly handleReset = (): void => {
    if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback && this.state.error) {
      return this.props.fallback(this.state.error, this.handleReset);
    }
    return (
      <div
        role="alert"
        style={{
          padding: '32px',
          fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
          color: '#1a1a1a',
          background: '#f6f8fb',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <h1 style={{ fontSize: '24px', margin: 0 }}>
          Algo inesperado aconteceu ao carregar esta página.
        </h1>
        <p style={{ fontSize: '15px', margin: 0, maxWidth: '480px', textAlign: 'center', opacity: 0.7 }}>
          Tentamos preservar o que você estava lendo, mas precisamos recarregar para continuar. Se o
          problema persistir, escreva para o operador ou tente novamente em alguns minutos.
        </p>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            padding: '10px 24px',
            border: '1px solid #1a1a1a',
            background: 'white',
            borderRadius: '999px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}
