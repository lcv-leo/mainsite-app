/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * ContentUpdateToast — Notificação premium de atualização de conteúdo.
 *
 * Glassmorphism toast com micro-animações que aparece quando o backend
 * detecta uma nova matéria na primeira página. Auto-dismiss após 15s.
 */
import { useEffect, useRef } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import type { ActivePalette } from '../types';

interface ContentUpdateToastProps {
  visible: boolean;
  activePalette: ActivePalette;
  onRefresh: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 15_000;

const ContentUpdateToast = ({ visible, activePalette, onRefresh, onDismiss }: ContentUpdateToastProps) => {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss após 15 segundos
  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  const isDark = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  return (
    <>
      <style>{`
        @keyframes contentToastSlideIn {
          from { opacity: 0; transform: translate(-50%, -40%) scale(0.96); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes contentToastSlideOut {
          from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          to { opacity: 0; transform: translate(-50%, -40%) scale(0.96); }
        }
        @keyframes sparkleRotate {
          0%, 100% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-8deg) scale(1.15); }
          50% { transform: rotate(8deg) scale(1); }
          75% { transform: rotate(-4deg) scale(1.08); }
        }
        @keyframes progressShrink {
          from { width: 100%; }
          to { width: 0%; }
        }
        .content-update-toast {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 10000;
          max-width: 400px;
          width: calc(100vw - 40px);
          border-radius: 16px;
          padding: 20px;
          animation: contentToastSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 12px 48px rgba(0,0,0,0.2), 0 0 0 1px ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'}, 0 0 120px 20px rgba(66,133,244,0.06);
          background: ${isDark
            ? 'linear-gradient(135deg, rgba(30,32,44,0.95) 0%, rgba(24,26,36,0.97) 100%)'
            : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,249,250,0.97) 100%)'
          };
          border: 1px solid ${isDark ? 'rgba(138,180,248,0.15)' : 'rgba(66,133,244,0.12)'};
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }
        @media (max-width: 480px) {
          .content-update-toast {
            top: 50%;
            left: 16px;
            right: 16px;
            width: auto;
            max-width: none;
            transform: translate(0, -50%);
          }
        }
        .content-update-toast__header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .content-update-toast__icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #4285f4, #7c3aed);
          color: #fff;
          flex-shrink: 0;
          animation: sparkleRotate 3s ease-in-out infinite;
        }
        .content-update-toast__title {
          font-size: 14px;
          font-weight: 700;
          color: ${isDark ? '#e8eaed' : '#1a1a2e'};
          letter-spacing: -0.01em;
          flex: 1;
        }
        .content-update-toast__close {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          border-radius: 8px;
          color: ${isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)'};
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .content-update-toast__close:hover {
          background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'};
          color: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
        }
        .content-update-toast__body {
          font-size: 13px;
          line-height: 1.5;
          color: ${isDark ? 'rgba(255,255,255,0.65)' : 'rgba(0,0,0,0.55)'};
          margin-bottom: 16px;
        }
        .content-update-toast__actions {
          display: flex;
          gap: 8px;
        }
        .content-update-toast__btn {
          flex: 1;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font-family: inherit;
        }
        .content-update-toast__btn--primary {
          background: linear-gradient(135deg, #4285f4, #5b6bf4);
          color: #fff;
          box-shadow: 0 4px 14px rgba(66, 133, 244, 0.3);
        }
        .content-update-toast__btn--primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(66, 133, 244, 0.4);
        }
        .content-update-toast__btn--secondary {
          background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
          color: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
          border: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
        }
        .content-update-toast__btn--secondary:hover {
          background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'};
        }
        .content-update-toast__progress {
          position: absolute;
          bottom: 0;
          left: 16px;
          right: 16px;
          height: 2px;
          border-radius: 0 0 16px 16px;
          overflow: hidden;
        }
        .content-update-toast__progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #4285f4, #7c3aed);
          border-radius: 2px;
          animation: progressShrink ${AUTO_DISMISS_MS}ms linear forwards;
        }
      `}</style>

      <div className="content-update-toast" role="alert" aria-live="polite">
        <div className="content-update-toast__header">
          <div className="content-update-toast__icon">
            <Sparkles size={18} />
          </div>
          <span className="content-update-toast__title">Nova matéria em destaque</span>
          <button
            className="content-update-toast__close"
            onClick={onDismiss}
            aria-label="Dispensar notificação"
          >
            <X size={16} />
          </button>
        </div>

        <div className="content-update-toast__body">
          Uma nova matéria acaba de ser publicada na primeira página.
          Deseja atualizar para ver o novo conteúdo?
        </div>

        <div className="content-update-toast__actions">
          <button className="content-update-toast__btn content-update-toast__btn--primary" onClick={onRefresh}>
            <RefreshCw size={14} />
            Atualizar Agora
          </button>
          <button className="content-update-toast__btn content-update-toast__btn--secondary" onClick={onDismiss}>
            Dispensar
          </button>
        </div>

        <div className="content-update-toast__progress">
          <div className="content-update-toast__progress-bar" />
        </div>
      </div>
    </>
  );
};

export default ContentUpdateToast;
