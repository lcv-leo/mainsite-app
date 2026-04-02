/*
 * INTERACTIVE EXAMPLES — Text Zoom Feature
 * mainsite-frontend PostReader
 * 
 * Exemplos de código mostrando como usar a feature
 */

// ============================================================================
// EXEMPLO 1: Usar em outro componente
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';
import TextZoomControl from '../components/TextZoomControl';

export const MyCustomReader = () => {
  const { zoomLevel, percentage, increase, decrease, reset, setZoomLevel } = useTextZoom();

  return (
    <div style={{ '--text-zoom-scale': zoomLevel } as React.CSSProperties}>
      <TextZoomControl
        zoomLevel={zoomLevel}
        percentage={percentage}
        onIncrease={increase}
        onDecrease={decrease}
        onReset={reset}
        onSliderChange={setZoomLevel}
        isDarkMode={false}
      />
      
      <article>
        <h1>Meu Artigo</h1>
        <p style={{ fontSize: 'calc(18px * var(--text-zoom-scale, 1))' }}>
          Este parágrafo será escalado junto com o zoom do usuário!
        </p>
      </article>
    </div>
  );
};


// ============================================================================
// EXEMPLO 2: Usar com persistência manual
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';

export const ArticleWithZoom = ({ article }) => {
  const { zoomLevel, setZoomLevel } = useTextZoom();

  // Salvar zoom quando usuário sair
  useEffect(() => {
    return () => {
      localStorage.setItem('last-zoom', zoomLevel.toString());
    };
  }, [zoomLevel]);

  // Carregar zoom anterior
  useEffect(() => {
    const saved = localStorage.getItem('last-zoom');
    if (saved) setZoomLevel(parseFloat(saved));
  }, []);

  return (
    <article style={{ '--text-zoom-scale': zoomLevel } as React.CSSProperties}>
      <h1>{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.content }} />
    </article>
  );
};


// ============================================================================
// EXEMPLO 3: Usar com Analytics
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';

export const TrackedPostReader = ({ post }) => {
  const { zoomLevel, percentage, increase, decrease, reset } = useTextZoom();
  const [zoomStartTime] = useState(Date.now());

  // Rastrear mudanças de zoom
  const handleIncrease = () => {
    trackEvent('text_zoom_increase', {
      newLevel: percentage + 5,
      timeOnPage: Date.now() - zoomStartTime,
    });
    increase();
  };

  const handleDecrease = () => {
    trackEvent('text_zoom_decrease', {
      newLevel: percentage - 5,
      timeOnPage: Date.now() - zoomStartTime,
    });
    decrease();
  };

  const handleReset = () => {
    trackEvent('text_zoom_reset', {
      previousLevel: percentage,
      timeOnPage: Date.now() - zoomStartTime,
    });
    reset();
  };

  return (
    <PostReader
      {...props}
      // Usar handlers customizados que rastreiam eventos
      onZoomIncrease={handleIncrease}
      onZoomDecrease={handleDecrease}
      onZoomReset={handleReset}
    />
  );
};


// ============================================================================
// EXEMPLO 4: Keyboard shortcuts globais
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';

export const GlobalZoomShortcuts = ({ children }) => {
  const { increase, decrease, reset } = useTextZoom();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl++ ou Cmd++
      if ((e.ctrlKey || e.metaKey) && e.key === '+') {
        e.preventDefault();
        increase();
      }
      // Ctrl+- ou Cmd+-
      else if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        decrease();
      }
      // Ctrl+0 ou Cmd+0 para reset
      else if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [increase, decrease, reset]);

  return <>{children}</>;
};

// Usar:
// <GlobalZoomShortcuts>
//   <App />
// </GlobalZoomShortcuts>


// ============================================================================
// EXEMPLO 5: Presets para dislexia
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';

interface DyslexiaPresets {
  none: number;
  mild: number;
  moderate: number;
  severe: number;
}

const DYSLEXIA_PRESETS: DyslexiaPresets = {
  none: 1.0,
  mild: 1.2,
  moderate: 1.4,
  severe: 1.6,
};

export const PostReaderWithA11y = ({ post, userProfile }) => {
  const { zoomLevel, setZoomLevel } = useTextZoom();

  // Auto-apply dyslexia preset
  useEffect(() => {
    if (userProfile?.hasDyslexia) {
      const preset = DYSLEXIA_PRESETS[userProfile.dyslexiaSeverity || 'mild'];
      setZoomLevel(preset);
    }
  }, [userProfile]);

  return <PostReader {...props} />;
};


// ============================================================================
// EXEMPLO 6: Sincronizar com nuvem
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';

export const CloudSyncedPostReader = ({ post, userId }) => {
  const { zoomLevel, setZoomLevel } = useTextZoom();

  // Carregar preferência na nuvem ao montar
  useEffect(() => {
    (async () => {
      const userPrefs = await fetch(`/api/user/${userId}/preferences`);
      const { textZoom } = await userPrefs.json();
      if (textZoom) setZoomLevel(textZoom);
    })();
  }, [userId]);

  // Sincronizar mudanças com nuvem (debounced)
  const debouncedSync = useCallback(
    debounce((level: number) => {
      fetch(`/api/user/${userId}/preferences`, {
        method: 'PATCH',
        body: JSON.stringify({ textZoom: level }),
      });
    }, 500),
    [userId]
  );

  useEffect(() => {
    debouncedSync(zoomLevel);
  }, [zoomLevel]);

  return <PostReader {...props} />;
};


// ============================================================================
// EXEMPLO 7: A/B Testing
// ============================================================================

import { useTextZoom } from '../hooks/useTextZoom';

type TextZoomUIVariant = 'horizontal' | 'vertical' | 'compact';

interface TextZoomControlProps {
  variant?: TextZoomUIVariant;
}

export const ABTestedPostReader = ({ post }) => {
  const variant = getABTestVariant('text-zoom-ui', {
    control: 'horizontal',
    variant1: 'vertical',
    variant2: 'compact',
  }) as TextZoomUIVariant;

  const { zoomLevel, percentage, increase, decrease, reset, setZoomLevel } = useTextZoom();

  trackEvent('text_zoom_variant_shown', { variant });

  return (
    <PostReader
      {...props}
      textZoomVariant={variant}
      onZoomLevelChange={(level) => {
        trackEvent('text_zoom_changed', { variant, level: Math.round(level * 100) });
      }}
    />
  );
};


// ============================================================================
// EXEMPLO 8: Alternativas de UI
// ============================================================================

// Versão Vertical (para sidebar)
export const TextZoomControlVertical = (props: TextZoomControlProps) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <button onClick={props.onIncrease}>A+</button>
      <input type="range" {...rangeProps} />
      <button onClick={props.onDecrease}>A−</button>
      {props.percentage && <small>{props.percentage}%</small>}
    </div>
  );
};

// Versão Compact (para mobile)
export const TextZoomControlCompact = (props: TextZoomControlProps) => {
  return (
    <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
      <button onClick={props.onDecrease} title="Smaller">−</button>
      <span>{props.percentage}%</span>
      <button onClick={props.onIncrease} title="Larger">+</button>
    </div>
  );
};

// Versão com Presets
export const TextZoomControlWithPresets = (props: TextZoomControlProps) => {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <button onClick={() => props.onSliderChange(0.8)}>Pequeno</button>
      <button onClick={() => props.onSliderChange(1.0)}>Normal</button>
      <button onClick={() => props.onSliderChange(1.2)}>Grande</button>
      <button onClick={() => props.onSliderChange(1.4)}>Muito Grande</button>
    </div>
  );
};


// ============================================================================
// EXEMPLO 9: CSS Classes para diferentes states
// ============================================================================

const styles = `
  /* Normal state */
  .text-zoom-active {
    --text-zoom-scale: var(--user-zoom-level);
  }

  /* High zoom (>150%) */
  .text-zoom-active.zoom-high {
    /* Pode adicionar styling especial */
    letter-spacing: 0.5px;
    line-height: 1.8;
  }

  /* Low zoom (<100%) */
  .text-zoom-active.zoom-low {
    /* Pode adicionar styling especial */
    letter-spacing: -0.25px;
  }

  /* Print — sempre resetar para 100% */
  @media print {
    .text-zoom-active {
      --text-zoom-scale: 1;
    }
  }

  /* Reduced motion — transições lentas */
  @media (prefers-reduced-motion: reduce) {
    .text-zoom-active {
      transition: none !important;
    }
  }

  /* High contrast — cores adaptem */
  @media (prefers-contrast: more) {
    .text-zoom-control {
      border: 2px solid currentColor;
      background: transparent;
    }
  }
`;


// ============================================================================
// EXEMPLO 10: Testing (Jest/Vitest)
// ============================================================================

import { renderHook, act } from '@testing-library/react';
import { useTextZoom } from '../hooks/useTextZoom';

describe('useTextZoom', () => {
  it('should initialize with default value', () => {
    const { result } = renderHook(() => useTextZoom());
    expect(result.current.zoomLevel).toBe(1.0);
    expect(result.current.percentage).toBe(100);
  });

  it('should increase zoom level', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => result.current.increase());
    expect(result.current.zoomLevel).toBe(1.05);
    expect(result.current.percentage).toBe(105);
  });

  it('should decrease zoom level', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.increase();
      result.current.decrease();
    });
    expect(result.current.zoomLevel).toBe(1.0);
  });

  it('should reset to 1.0', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => {
      result.current.increase();
      result.current.increase();
      result.current.reset();
    });
    expect(result.current.zoomLevel).toBe(1.0);
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => result.current.setZoomLevel(1.3));
    
    expect(localStorage.getItem('mainsite:text-zoom-level')).toBe('1.3');
  });

  it('should restore from localStorage', () => {
    localStorage.setItem('mainsite:text-zoom-level', '1.5');
    const { result } = renderHook(() => useTextZoom());
    expect(result.current.zoomLevel).toBe(1.5);
  });

  it('should clamp values to min/max', () => {
    const { result } = renderHook(() => useTextZoom());
    act(() => result.current.setZoomLevel(3.0));
    expect(result.current.zoomLevel).toBe(2.0); // Clamped to MAX

    act(() => result.current.setZoomLevel(0.5));
    expect(result.current.zoomLevel).toBe(0.8); // Clamped to MIN
  });
});
