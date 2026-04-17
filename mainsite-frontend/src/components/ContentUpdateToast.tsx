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
import './ContentUpdateToast.css';

interface ContentUpdateToastProps {
  visible: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 15_000;

const ContentUpdateToast = ({ visible, onRefresh, onDismiss }: ContentUpdateToastProps) => {
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

  return (
    <>
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
