/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/ShareOverlay.tsx
// Versão: v1.5.0
// Descrição: MD3 + Glassmorphism.

import { Mail, Send, X } from 'lucide-react';
import { type Dispatch, type FormEvent, type SetStateAction, useEffect, useRef, useState } from 'react';
import type { ActivePalette, ShareModalState } from '../types';
import { isDarkPalette } from '../types';

interface ShareOverlayProps {
  modalState: ShareModalState;
  setModalState: Dispatch<SetStateAction<ShareModalState>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  activePalette: ActivePalette;
  turnstileSiteKey?: string;
}

const ShareOverlay = ({ modalState, setModalState, onSubmit, activePalette, turnstileSiteKey }: ShareOverlayProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const isDark = isDarkPalette(activePalette);

  useEffect(() => {
    if (modalState.show) {
      setTimeout(() => setIsVisible(true), 0);
    } else {
      setTimeout(() => setIsVisible(false), 400);
    }
  }, [modalState.show]);

  useEffect(() => {
    const siteKey = turnstileSiteKey;
    if (!siteKey || !modalState.show || !turnstileRef.current) return;
    const resolvedSiteKey: string = siteKey;
    if (turnstileWidgetId.current) return;

    function renderTurnstile() {
      if (!window.turnstile || !turnstileRef.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: resolvedSiteKey,
        theme: isDark ? 'dark' : 'light',
        callback: (token: string) => {
          setTurnstileMessage(null);
          setModalState((prev) => ({ ...prev, turnstileToken: token }));
        },
        'error-callback': () => {
          setTurnstileMessage('Falha na verificacao de seguranca. Tente novamente.');
          setModalState((prev) => ({ ...prev, turnstileToken: '' }));
        },
        'expired-callback': () => {
          setTurnstileMessage('A verificacao expirou. Conclua o desafio novamente.');
          setModalState((prev) => ({ ...prev, turnstileToken: '' }));
        },
      });
    }

    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => renderTurnstile();
      document.head.appendChild(script);
    } else {
      renderTurnstile();
    }

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [isDark, modalState.show, setModalState, turnstileSiteKey]);

  if (!isVisible && !modalState.show) return null;

  const isDarkBase = isDark;
  const submitDisabled = !turnstileSiteKey || !modalState.turnstileToken;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: isDarkBase ? 'rgba(15, 15, 20, 0.85)' : 'rgba(240, 240, 244, 0.56)',
    backdropFilter: 'blur(var(--glass-blur-subtle))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11000,
    opacity: modalState.show ? 1 : 0,
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    padding: '20px',
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: isDarkBase ? 'rgba(24,24,28,0.9)' : 'rgba(255,255,255,0.88)',
    color: activePalette.fontColor,
    padding: '40px',
    maxWidth: '450px',
    width: '100%',
    borderRadius: '28px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase ? '0 32px 64px -12px rgba(0, 0, 0, 0.6)' : '0 32px 64px -12px rgba(0, 0, 0, 0.15)',
    transform: modalState.show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    backdropFilter: 'blur(var(--glass-blur-deep))',
    textShadow: isDarkBase ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px',
    marginBottom: '24px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '16px',
    color: activePalette.fontColor,
    fontSize: '15px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    textAlign: 'center',
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: activePalette.titleColor,
    color: isDarkBase ? '#000' : '#fff',
    border: 'none',
    padding: '16px',
    fontSize: '15px',
    fontWeight: '800',
    borderRadius: '100px',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s ease',
    boxShadow: `0 8px 24px ${activePalette.titleColor}40`,
    letterSpacing: '1px',
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="share-title">
      <div style={modalStyle}>
        <button
          type="button"
          onClick={() => setModalState({ show: false, email: '', turnstileToken: '' })}
          aria-label="Fechar"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(128,128,128,0.1)',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '100px',
            border: '1px solid rgba(128,128,128,0.16)',
            color: activePalette.fontColor,
            cursor: 'pointer',
            opacity: 0.8,
            transition: 'all 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.opacity = '0.8';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onFocus={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.opacity = '0.8';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <X size={20} />
        </button>

        <div
          style={{
            padding: '20px',
            borderRadius: '100px',
            backgroundColor: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            marginBottom: '20px',
          }}
        >
          <Mail size={40} strokeWidth={1.5} style={{ opacity: 0.9 }} />
        </div>

        <h2
          id="share-title"
          style={{
            margin: '0 0 12px 0',
            fontSize: '24px',
            fontWeight: '800',
            color: activePalette.titleColor,
            letterSpacing: '-0.02em',
          }}
        >
          Compartilhar Leitura
        </h2>
        <p style={{ margin: '0 0 30px 0', fontSize: '14px', opacity: 0.8, lineHeight: '1.6', fontWeight: '500' }}>
          Insira o e-mail do destinatário para enviar o link deste fragmento.
        </p>

        <form onSubmit={onSubmit} autoComplete="on" style={{ width: '100%' }}>
          <input
            id="share-recipient-email"
            name="recipientEmail"
            type="email"
            required
            autoComplete="email"
            placeholder="destinatario@exemplo.com"
            value={modalState.email}
            onChange={(e) => setModalState({ ...modalState, email: e.target.value })}
            style={inputStyle}
          />
          {turnstileSiteKey ? (
            <div ref={turnstileRef} style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }} />
          ) : (
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', opacity: 0.7 }}>
              Compartilhamento por e-mail indisponível enquanto a verificação de segurança não estiver configurada.
            </p>
          )}
          {turnstileMessage && (
            <p style={{ margin: '0 0 20px 0', fontSize: '12px', color: 'var(--semantic-error)', opacity: 0.9 }}>
              {turnstileMessage}
            </p>
          )}
          <button
            type="submit"
            disabled={submitDisabled}
            style={{
              ...buttonStyle,
              cursor: submitDisabled ? 'not-allowed' : 'pointer',
              opacity: submitDisabled ? 0.7 : 1,
            }}
            onMouseOver={(e) => {
              if (!submitDisabled) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseOut={(e) => {
              if (!submitDisabled) e.currentTarget.style.transform = 'translateY(0)';
            }}
            onFocus={(e) => {
              if (!submitDisabled) e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onBlur={(e) => {
              if (!submitDisabled) e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Send size={20} /> ENVIAR E-MAIL
          </button>
        </form>
      </div>
    </div>
  );
};

export default ShareOverlay;
