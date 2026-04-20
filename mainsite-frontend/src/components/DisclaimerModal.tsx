/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/DisclaimerModal.tsx
// Versão: v1.6.1
// Descrição: Redimensionamento dinâmico, corpo rolável com parágrafos justificados/recuados e botão liberado somente após leitura integral.

import { AlertTriangle, ChevronDown, Heart } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivePalette, DisclaimerItem, DisclaimersConfig } from '../types';

interface DisclaimerModalProps {
  show: boolean;
  onClose: () => void;
  activePalette: ActivePalette | null;
  config: DisclaimersConfig | null;
  onDonationTrigger?: () => void;
}

const SCROLL_END_TOLERANCE_PX = 2;

interface DisclaimerItemViewProps {
  disclaimer: DisclaimerItem;
  activePalette: ActivePalette;
  isDarkBase: boolean;
  totalItems: number;
  positionIndex: number;
  dontShowAgain: boolean;
  setDontShowAgain: (v: boolean) => void;
  onAgree: () => void;
  onSkipDonation: () => void;
}

// O subcomponente é remontado via `key` no pai a cada troca de item, resetando
// `canClose` (inicial `false`) e o `scrollTop` do corpo sem precisar setState
// dentro do corpo de um effect.
const DisclaimerItemView = ({
  disclaimer,
  activePalette,
  isDarkBase,
  totalItems,
  positionIndex,
  dontShowAgain,
  setDontShowAgain,
  onAgree,
  onSkipDonation,
}: DisclaimerItemViewProps) => {
  const [canClose, setCanClose] = useState(false);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const evaluate = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const reachedEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_END_TOLERANCE_PX;
    const fitsWithoutScroll = el.scrollHeight <= el.clientHeight + SCROLL_END_TOLERANCE_PX;
    setCanClose(fitsWithoutScroll || reachedEnd);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(evaluate);
    ro.observe(el);
    window.addEventListener('resize', evaluate);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', evaluate);
    };
  }, [evaluate]);

  const isDonationMode = disclaimer.isDonationTrigger;
  const primaryBg = isDonationMode ? '#ec4899' : activePalette.titleColor;
  const primaryFg = isDonationMode ? '#fff' : activePalette.bgColor;
  const surfaceBg = isDarkBase ? 'rgba(24, 24, 28, 0.9)' : 'rgba(255, 255, 255, 0.88)';
  const fadeColor = isDarkBase ? 'rgba(24, 24, 28, 1)' : 'rgba(255, 255, 255, 1)';

  const handleAgree = () => {
    if (!canClose) return;
    onAgree();
  };

  const handleSkip = () => {
    if (!canClose) return;
    onSkipDonation();
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '480px',
        maxHeight: 'min(90vh, 720px)',
        background: surfaceBg,
        backdropFilter: 'blur(var(--glass-blur-deep))',
        WebkitBackdropFilter: 'blur(var(--glass-blur-deep))',
        border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.15)`,
        borderRadius: '28px',
        padding: 'clamp(20px, 4vw, 36px)',
        boxShadow: '0 32px 64px -12px rgba(0,0,0,0.4)',
        color: activePalette.fontColor,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        animation: 'fadeIn 0.4s ease-out',
        textShadow: isDarkBase ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {totalItems > 1 && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '20px',
            fontSize: '12px',
            fontWeight: 800,
            opacity: 0.5,
            letterSpacing: '1px',
          }}
        >
          {positionIndex + 1} / {totalItems}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          color: isDonationMode ? '#ec4899' : activePalette.titleColor,
          opacity: 0.9,
          flex: '0 0 auto',
        }}
      >
        {isDonationMode ? <Heart size={44} /> : <AlertTriangle size={44} />}
      </div>
      <h3
        id="disclaimer-title"
        style={{
          margin: 0,
          fontSize: '22px',
          color: activePalette.titleColor,
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontWeight: 800,
          flex: '0 0 auto',
        }}
      >
        {disclaimer.title || 'Aviso'}
      </h3>

      <div style={{ position: 'relative', flex: '1 1 auto', minHeight: 0, display: 'flex' }}>
        <div
          id="disclaimer-body"
          ref={bodyRef}
          onScroll={evaluate}
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            minHeight: 0,
            padding: '4px 12px 20px',
            margin: '0 -4px',
            fontSize: '15px',
            lineHeight: 1.8,
            opacity: 0.9,
            fontWeight: 500,
            textAlign: 'justify',
            hyphens: 'auto',
            outline: 'none',
          }}
        >
          {(() => {
            const paragraphs = disclaimer.text
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter((p) => p.length > 0);
            const list = paragraphs.length > 0 ? paragraphs : [disclaimer.text];
            return list.map((paragraph, i) => (
              <p
                // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos derivados de split estável, ordem imutável
                key={i}
                style={{
                  margin: 0,
                  marginBottom: i === list.length - 1 ? 0 : '0.9em',
                  textIndent: '1.75em',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {paragraph}
              </p>
            ));
          })()}
        </div>
        {!canClose && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: '48px',
              pointerEvents: 'none',
              background: `linear-gradient(to bottom, transparent, ${fadeColor})`,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: '4px',
            }}
          >
            <ChevronDown size={20} style={{ opacity: 0.7, animation: 'fadeIn 0.4s ease-out' }} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: '0 0 auto' }}>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '13px',
            opacity: 0.8,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          <input
            id="disclaimer-dont-show"
            name="disclaimerDontShow"
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
          />
          Não exibir este aviso novamente
        </label>

        <button
          type="button"
          onClick={handleAgree}
          disabled={!canClose}
          aria-disabled={!canClose}
          title={canClose ? undefined : 'Role o texto até o final para habilitar este botão'}
          style={{
            padding: '14px 28px',
            background: primaryBg,
            color: primaryFg,
            border: 'none',
            borderRadius: '100px',
            cursor: canClose ? 'pointer' : 'not-allowed',
            fontWeight: 800,
            letterSpacing: '2px',
            transition: 'all 0.2s',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: canClose
              ? `0 8px 24px ${isDonationMode ? 'rgba(236, 72, 153, 0.4)' : `${activePalette.titleColor}40`}`
              : 'none',
            opacity: canClose ? 1 : 0.45,
            filter: canClose ? 'none' : 'saturate(0.6)',
          }}
          onMouseOver={(e) => {
            if (canClose) e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onFocus={(e) => {
            if (canClose) e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isDonationMode ? <Heart size={18} fill="#fff" /> : null}
          {disclaimer.buttonText || (isDonationMode ? 'Apoiar Projeto' : 'Concordo')}
        </button>

        {!canClose && (
          <span aria-live="polite" style={{ fontSize: '12px', opacity: 0.65, fontWeight: 600, letterSpacing: '0.5px' }}>
            Role o texto até o final para habilitar o botão.
          </span>
        )}

        {isDonationMode && (
          <button
            type="button"
            onClick={handleSkip}
            disabled={!canClose}
            aria-disabled={!canClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: activePalette.fontColor,
              fontSize: '13px',
              opacity: canClose ? 0.6 : 0.3,
              cursor: canClose ? 'pointer' : 'not-allowed',
              textDecoration: 'underline',
              fontWeight: 700,
              marginTop: '4px',
            }}
          >
            Pular agora e ler os textos
          </button>
        )}
      </div>
    </div>
  );
};

const DisclaimerModal = ({ show, onClose, activePalette, config, onDonationTrigger }: DisclaimerModalProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (show) setTimeout(() => setCurrentIndex(0), 0);
  }, [show]);

  if (!show || !activePalette || !config?.enabled || !config.items || config.items.length === 0) {
    if (show) onClose();
    return null;
  }

  const isDarkBase = !!(
    activePalette.bgColor &&
    (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'))
  );
  const currentDisclaimer = config.items[currentIndex];

  const advanceOrClose = () => {
    if (dontShowAgain) {
      localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
    }
    if (currentIndex < config.items.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setDontShowAgain(false);
    } else {
      onClose();
    }
  };

  const handleAgree = () => {
    if (currentDisclaimer.isDonationTrigger && onDonationTrigger) onDonationTrigger();
    advanceOrClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="disclaimer-title"
      aria-describedby="disclaimer-body"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 11000,
        padding: '16px',
      }}
    >
      <div
        key={`bg-${currentIndex}`}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: isDarkBase ? 'rgba(15,15,20,0.85)' : 'rgba(240,240,244,0.56)',
          backdropFilter: 'blur(var(--glass-blur-subtle))',
          WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
          animation: 'fadeIn 0.3s ease-out',
        }}
      ></div>

      <DisclaimerItemView
        key={`card-${currentIndex}`}
        disclaimer={currentDisclaimer}
        activePalette={activePalette}
        isDarkBase={isDarkBase}
        totalItems={config.items.length}
        positionIndex={currentIndex}
        dontShowAgain={dontShowAgain}
        setDontShowAgain={setDontShowAgain}
        onAgree={handleAgree}
        onSkipDonation={advanceOrClose}
      />
    </div>
  );
};

export default DisclaimerModal;
