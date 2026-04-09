/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Component: TextZoomControl
// Purpose: Elegant UI for text zoom with slider, buttons, and percentage display
// Features: smooth animations, glassmorphism design, ARIA accessibility

import { useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface TextZoomControlProps {
  zoomLevel: number;
  percentage: number;
  onIncrease: () => void;
  onDecrease: () => void;
  onReset: () => void;
  onSliderChange: (level: number) => void;
  textColor?: string;
  bgColor?: string;
  isDarkMode?: boolean;
}

const TextZoomControl = ({
  zoomLevel,
  percentage,
  onIncrease,
  onDecrease,
  onReset,
  onSliderChange,
  textColor: _textColor = '#333333',
  bgColor: _bgColor = '#ffffff',
  isDarkMode = false,
}: TextZoomControlProps) => {
  const sliderRef = useRef<HTMLInputElement>(null);

  // Keyboard accessibility: arrow keys
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

  const isZoomed = Math.abs(zoomLevel - 1.0) > 0.01;
  const isAtMin = zoomLevel <= 0.8;
  const isAtMax = zoomLevel >= 2.0;

  return (
    <div
      className="text-zoom-control-wrapper"
      style={{
        margin: '0 0 2.5rem 0',
        padding: '16px 24px',
        borderRadius: '16px',
        background: isDarkMode
          ? 'rgba(0, 0, 0, 0.25)'
          : 'rgba(255, 255, 255, 0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid rgba(${isDarkMode ? '255, 255, 255' : '0, 0, 0'}, 0.1)`,
        boxShadow: isDarkMode
          ? '0 8px 32px rgba(0, 0, 0, 0.2)'
          : '0 8px 32px rgba(0, 0, 0, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        flexWrap: 'wrap',
        justifyContent: 'center',
        animation: 'fadeIn 0.3s ease-out',
      }}
      role="group"
      aria-label="Controle de tamanho de texto"
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .text-zoom-control-wrapper {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .text-zoom-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: rgba(66, 133, 244, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          color: #4285f4;
          flex-shrink: 0;
          padding: 0;
          font-size: 0;
          font-weight: 600;
        }

        .text-zoom-btn:hover:not(:disabled) {
          background: rgba(66, 133, 244, 0.2);
          transform: scale(1.08);
        }

        .text-zoom-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .text-zoom-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .text-zoom-btn.reset {
          background: rgba(244, 180, 0, 0.1);
          color: #f4b400;
        }

        .text-zoom-btn.reset:hover:not(:disabled) {
          background: rgba(244, 180, 0, 0.2);
        }

        .text-zoom-display {
          min-width: 45px;
          text-align: center;
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }

        .text-zoom-slider {
          width: 140px;
          height: 6px;
          border-radius: 3px;
          background: rgba(128, 128, 128, 0.15);
          outline: none;
          -webkit-appearance: none;
          appearance: none;
          cursor: pointer;
        }

        .text-zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4285f4, #5b9ff5);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.8);
        }

        .text-zoom-slider::-webkit-slider-thumb:hover {
          box-shadow: 0 6px 16px rgba(66, 133, 244, 0.5);
          transform: scale(1.2);
        }

        .text-zoom-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4285f4, #5b9ff5);
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
          border: 2px solid rgba(255, 255, 255, 0.8);
        }

        .text-zoom-slider::-moz-range-thumb:hover {
          box-shadow: 0 6px 16px rgba(66, 133, 244, 0.5);
          transform: scale(1.2);
        }

        .text-zoom-slider::-moz-range-track {
          background: transparent;
          border: none;
        }

        .text-zoom-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          opacity: 0.6;
          margin-left: 8px;
          flex-shrink: 0;
        }
      `}</style>

      {/* Decrease Button */}
      <button
        onClick={onDecrease}
        disabled={isAtMin}
        className="text-zoom-btn"
        aria-label="Diminuir tamanho do texto"
        title="Diminuir (Ctrl+-)  "
      >
        <ZoomOut size={18} />
      </button>

      {/* Slider */}
      <input
        ref={sliderRef}
        type="range"
        min="0.8"
        max="2.0"
        step="0.05"
        value={zoomLevel}
        onChange={(e) => onSliderChange(parseFloat(e.target.value))}
        className="text-zoom-slider"
        aria-label="Slider de tamanho de texto"
        aria-valuemin={80}
        aria-valuemax={200}
        aria-valuenow={percentage}
        aria-valuetext={`${percentage}%`}
      />

      {/* Percentage Display */}
      <div className="text-zoom-display" aria-live="polite" aria-atomic="true">
        {percentage}%
      </div>

      {/* Increase Button */}
      <button
        onClick={onIncrease}
        disabled={isAtMax}
        className="text-zoom-btn"
        aria-label="Aumentar tamanho do texto"
        title="Aumentar (Ctrl++)"
      >
        <ZoomIn size={18} />
      </button>

      {/* Reset Button (only visible when zoomed) */}
      {isZoomed && (
        <button
          onClick={onReset}
          className="text-zoom-btn reset"
          aria-label="Restaurar tamanho padrão"
          title="Restaurar padrão"
        >
          <RotateCcw size={16} />
        </button>
      )}

      <span className="text-zoom-label">Tamanho</span>
    </div>
  );
};

export default TextZoomControl;
