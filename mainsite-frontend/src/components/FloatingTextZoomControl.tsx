/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Component: FloatingTextZoomControl + Presets + Voice Control
// Purpose: Minimal floating zoom control with accessibility presets
// Features: reveal on hover, compact, presets (dyslexia, low vision), voice control

import { useRef, useEffect, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Settings, Mic } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTextZoomPresets } from '../hooks/useTextZoomPresets';
import { useTextZoomVoice } from '../hooks/useTextZoomVoice';

interface FloatingTextZoomControlProps {
  zoomLevel: number;
  percentage: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
  onSliderChange: (level: number) => void;
  isDarkMode?: boolean;
}

const FloatingTextZoomControl = ({
  zoomLevel,
  percentage,
  onIncrease,
  onDecrease,
  onReset,
  onSliderChange,
  isDarkMode = false,
}: FloatingTextZoomControlProps) => {
  const sliderRef = useRef<HTMLInputElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPresets, setShowPresets] = useState(false);

  const { presets, applyPreset } = useTextZoomPresets(onSliderChange);
  const { isListening, isSupported: isVoiceSupported, startVoiceControl } = useTextZoomVoice(
    onIncrease,
    onDecrease,
    onReset,
    applyPreset
  );

  // Keyboard accessibility: arrow keys on slider
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!sliderRef.current || sliderRef.current !== document.activeElement) return;

      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          e.preventDefault();
          onIncrease();
          break;
        case 'ArrowDown':
        case 'ArrowLeft':
          e.preventDefault();
          onDecrease();
          break;
        case 'Home':
          e.preventDefault();
          onReset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onIncrease, onDecrease, onReset]);

  // Global keyboard shortcut: Ctrl+/Ctrl-
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Plus (=) or Cmd+Plus
      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        onIncrease();
      }
      // Ctrl+Minus or Cmd+Minus
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        onDecrease();
      }
      // Ctrl+0 or Cmd+0 = reset
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        onReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onIncrease, onDecrease, onReset]);

  const isZoomed = Math.abs(zoomLevel - 1.0) > 0.01;

  return createPortal(
    <>
      <div
        className="floating-zoom-control"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          padding: isExpanded ? '10px 14px' : '8px',
          borderRadius: '99px',
          background: isDarkMode
            ? 'rgba(0, 0, 0, 0.5)'
            : 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(12px)',
          border: `1px solid rgba(${isDarkMode ? '255, 255, 255' : '0, 0, 0'}, 0.1)`,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: 'pointer',
        }}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => { setIsExpanded(false); setShowPresets(false); }}
        role="group"
        aria-label="Controle de tamanho de texto"
      >
        <style>{`
          .floating-zoom-control {
            will-change: background;
          }

          .floating-zoom-btn {
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            background: transparent;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            color: #4285f4;
            flex-shrink: 0;
            padding: 0;
            font-size: 0;
            opacity: 0.7;
          }

          .floating-zoom-btn:hover:not(:disabled) {
            opacity: 1;
            transform: scale(1.12);
          }

          .floating-zoom-btn:active:not(:disabled) {
            transform: scale(0.95);
          }

          .floating-zoom-btn:disabled {
            opacity: 0.3;
            cursor: not-allowed;
          }

          .floating-zoom-btn.reset {
            color: #f4b400;
          }

          .floating-zoom-btn.voice {
            color: ${isListening ? '#e74c3c' : '#9b59b6'};
            animation: ${isListening ? 'pulse 1s infinite' : 'none'};
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          .floating-zoom-display {
            min-width: 35px;
            text-align: center;
            font-weight: 700;
            font-size: 12px;
            letter-spacing: 0.3px;
            opacity: ${isExpanded ? '1' : '0.5'};
            transition: opacity 0.3s ease-out;
          }

          .floating-zoom-slider {
            width: 0;
            height: 20px;
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            cursor: pointer;
            -webkit-appearance: none;
            appearance: none;
            background: transparent;
            border: none;
            padding: 0 4px;
          }

          .floating-zoom-slider.expanded {
            width: 100px;
            opacity: 1;
          }

          .floating-zoom-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4285f4;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
          }

          .floating-zoom-slider::-webkit-slider-thumb:hover {
            background: #2d6fd9;
            transform: scale(1.2);
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.5);
          }

          .floating-zoom-slider::-moz-range-thumb {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #4285f4;
            cursor: pointer;
            border: none;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
          }

          .floating-zoom-slider::-moz-range-thumb:hover {
            background: #2d6fd9;
            transform: scale(1.2);
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.5);
          }

          .floating-zoom-slider::-webkit-slider-runnable-track {
            background: rgba(66, 133, 244, 0.1);
            height: 4px;
            border-radius: 2px;
          }

          .floating-zoom-slider::-moz-range-track {
            background: rgba(66, 133, 244, 0.1);
            height: 4px;
            border-radius: 2px;
            border: none;
          }

          .floating-presets-menu {
            position: absolute;
            top: 45px;
            right: 0;
            background: ${isDarkMode ? 'rgba(20, 20, 20, 0.95)' : 'rgba(255, 255, 255, 0.95)'};
            backdrop-filter: blur(12px);
            border-radius: 12px;
            padding: 8px;
            min-width: 180px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border: 1px solid rgba(${isDarkMode ? '255, 255, 255' : '0, 0, 0'}, 0.1);
            animation: slideDown 0.2s ease-out;
            z-index: 1001;
          }

          @keyframes slideDown {
            from {
              opacity: 0;
              transform: translateY(-8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .floating-preset-item {
            display: block;
            width: 100%;
            border: none;
            background: transparent;
            padding: 8px 12px;
            text-align: left;
            font-size: 12px;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.2s ease;
            color: ${isDarkMode ? '#fff' : '#000'};
            margin-bottom: 4px;
            font-weight: 500;
          }

          .floating-preset-item:hover {
            background: rgba(66, 133, 244, 0.15);
            color: #4285f4;
          }

          .floating-preset-item:last-child {
            margin-bottom: 0;
          }

          @media (prefers-reduced-motion: reduce) {
            .floating-zoom-control,
            .floating-zoom-btn,
            .floating-zoom-slider,
            .floating-presets-menu {
              transition: none;
              animation: none;
            }
          }

          @media (max-width: 768px) {
            .floating-zoom-control {
              top: 12px;
              right: 12px;
              padding: 6px;
            }

            .floating-zoom-btn {
              width: 24px;
              height: 24px;
            }

            .floating-zoom-slider.expanded {
              width: 80px;
            }

            .floating-zoom-display {
              font-size: 10px;
              min-width: 30px;
            }

            .floating-presets-menu {
              min-width: 160px;
              top: 40px;
            }
          }
        `}</style>

        <button
          onClick={onDecrease}
          disabled={zoomLevel <= 0.8}
          className="floating-zoom-btn"
          title="Diminuir (Ctrl+-)"
          aria-label="Diminuir tamanho do texto"
        >
          <ZoomOut size={18} />
        </button>

        {isExpanded && (
          <input
            ref={sliderRef}
            type="range"
            min="0.8"
            max="2.0"
            step="0.05"
            value={zoomLevel}
            onChange={(e) => onSliderChange(parseFloat(e.target.value))}
            className="floating-zoom-slider expanded"
            aria-label="Ajustar tamanho do texto"
            aria-valuemin={80}
            aria-valuemax={200}
            aria-valuenow={percentage}
            aria-valuetext={`${percentage}%`}
            title="Arrastar para ajustar o tamanho do texto"
          />
        )}

        <div className="floating-zoom-display" title={`${percentage}% (Ctrl+0 para reset)`}>
          {percentage}%
        </div>

        <button
          onClick={onIncrease}
          disabled={zoomLevel >= 2.0}
          className="floating-zoom-btn"
          title="Aumentar (Ctrl++)"
          aria-label="Aumentar tamanho do texto"
        >
          <ZoomIn size={18} />
        </button>

        {isVoiceSupported && (
          <button
            onClick={startVoiceControl}
            className={`floating-zoom-btn voice`}
            title="Controle por voz"
            aria-label="Iniciar controle por voz"
            style={{ color: isListening ? '#e74c3c' : '#9b59b6' }}
          >
            <Mic size={16} />
          </button>
        )}

        <button
          onClick={() => setShowPresets(!showPresets)}
          className="floating-zoom-btn"
          title="Presets de acessibilidade"
          aria-label="Abrir menu de presets"
        >
          <Settings size={16} />
        </button>

        {Math.abs(zoomLevel - 1.0) > 0.01 && (
          <button
            onClick={onReset}
            className="floating-zoom-btn reset"
            title="Reset (Ctrl+0)"
            aria-label="Resetar tamanho do texto para 100%"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {showPresets && (
        <div
          className="floating-presets-menu"
          style={{
            position: 'fixed',
            top: '75px',
            right: '20px',
            zIndex: 1001,
          }}
        >
          {Object.entries(presets).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => {
                applyPreset(key);
                setShowPresets(false);
              }}
              className="floating-preset-item"
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}
    </>,
    document.body
  );
};

export default FloatingTextZoomControl;
