/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/FloatingControls.tsx
// Versão: v1.2.0
// Descrição: Componente MD3 para o Botão de Voltar ao Topo, Troca de Tema e Chat.

import { ArrowDown, ArrowUp, Bot, Monitor, Moon, RotateCcw, Sun, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect } from 'react';
import type { ActivePalette } from '../types';
import './FloatingControls.css';

interface FloatingControlsProps {
  showBackToTop: boolean;
  showScrollToBottom: boolean;
  scrollToTop: () => void;
  scrollToBottom: () => void;
  userTheme: 'auto' | 'dark' | 'light';
  cycleTheme: () => void;
  isChatOpen: boolean;
  setIsChatOpen: (open: boolean) => void;
  activePalette: ActivePalette | null;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}

const FloatingControls = ({
  showBackToTop,
  showScrollToBottom,
  scrollToTop,
  scrollToBottom,
  userTheme,
  cycleTheme,
  isChatOpen,
  setIsChatOpen,
  activePalette,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: FloatingControlsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (target?.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        onZoomIn();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        onZoomOut();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        onZoomReset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onZoomIn, onZoomOut, onZoomReset]);

  if (!activePalette) return null;

  const isZoomed = Math.abs(zoomLevel - 1) > 0.01;

  return (
    <div className="floating-controls" role="toolbar" aria-label="Controles do leitor">
      <div className={`fab-bottom-cluster${isChatOpen ? ' chat-open' : ''}`}>
        {showBackToTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="fab-btn"
            title="Voltar ao Topo"
            aria-label="Voltar ao topo"
          >
            <ArrowUp size={24} />
          </button>
        )}

        {showScrollToBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="fab-btn"
            title="Ir para o Final"
            aria-label="Ir para o final"
          >
            <ArrowDown size={24} />
          </button>
        )}

        <button
          type="button"
          onClick={cycleTheme}
          className="fab-btn"
          title={`Modo do Tema: ${userTheme.toUpperCase()}`}
          aria-label={`Alternar tema: modo ${userTheme} ativo`}
        >
          {userTheme === 'auto' ? <Monitor size={24} /> : userTheme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
        </button>

        <button
          type="button"
          onClick={onZoomOut}
          className="fab-btn"
          title="Diminuir texto (Ctrl+-)"
          aria-label="Diminuir tamanho do texto"
        >
          <ZoomOut size={24} />
        </button>

        <button
          type="button"
          onClick={onZoomIn}
          className="fab-btn"
          title={`Aumentar texto (${Math.round(zoomLevel * 100)}%) (Ctrl++)`}
          aria-label={`Aumentar tamanho do texto. Atual ${Math.round(zoomLevel * 100)} por cento`}
        >
          <ZoomIn size={24} />
        </button>

        {isZoomed && (
          <button
            type="button"
            onClick={onZoomReset}
            className="fab-btn"
            title="Restaurar texto para 100% (Ctrl+0)"
            aria-label="Restaurar tamanho padrão do texto"
          >
            <RotateCcw size={22} />
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`fab-btn chat-trigger ${isChatOpen ? 'chat-active' : ''}`}
          title="Busca Semântica / Conversar"
          aria-label={isChatOpen ? 'Fechar busca semântica' : 'Abrir busca semântica'}
        >
          {isChatOpen ? <X size={28} /> : <Bot size={28} />}
        </button>
      </div>
    </div>
  );
};

export default FloatingControls;
