/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/CommentModal.tsx
// Versão: v1.2.0
// Descrição: MD3 + Glassmorphism

import { Loader2, Mail, Phone, Send, User, X } from 'lucide-react';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import type { ActivePalette, ContactFormData, Post } from '../types';
import { isDarkPalette } from '../types';

interface CommentModalProps {
  show: boolean;
  onClose: () => void;
  onSubmit: (data: ContactFormData & { post_title?: string; turnstile_token?: string }, resetForm: () => void) => void;
  activePalette: ActivePalette;
  isSubmitting: boolean;
  currentPost: Post | null;
  turnstileSiteKey?: string;
}

const CommentModal = ({
  show,
  onClose,
  onSubmit,
  activePalette,
  isSubmitting,
  currentPost,
  turnstileSiteKey,
}: CommentModalProps) => {
  const [formData, setFormData] = useState<ContactFormData>({ name: '', phone: '', email: '', message: '' });
  const [isVisible, setIsVisible] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileMessage, setTurnstileMessage] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (show) {
      setTimeout(() => setIsVisible(true), 0);
    } else {
      setTimeout(() => setIsVisible(false), 400);
    }
  }, [show]);

  // Turnstile initialization
  useEffect(() => {
    if (!turnstileSiteKey || !show || !turnstileRef.current) return;
    if (turnstileWidgetId.current) return;
    const siteKey = turnstileSiteKey;

    function renderTurnstile() {
      if (!window.turnstile || !turnstileRef.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        callback: (token: string) => {
          setTurnstileToken(token);
          setTurnstileMessage(null);
        },
        'error-callback': () => {
          setTurnstileToken('');
          setTurnstileMessage('Falha na verificacao de seguranca. Tente novamente.');
        },
        'expired-callback': () => {
          setTurnstileToken('');
          setTurnstileMessage('A verificacao expirou. Conclua o desafio novamente.');
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
  }, [turnstileSiteKey, show]);

  if (!isVisible && !show) return null;

  const isDarkBase = isDarkPalette(activePalette);
  const charsLeft = 1000 - formData.message.length;

  const formatPhone = (val: string): string => {
    const v = val.replace(/\D/g, '').substring(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'phone') setFormData({ ...formData, phone: formatPhone(value) });
    else setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (turnstileSiteKey && !turnstileToken) return;
    const payload = turnstileToken
      ? { ...formData, turnstile_token: turnstileToken, post_title: currentPost?.title }
      : { ...formData, post_title: currentPost?.title };
    onSubmit(payload, () => {
      setFormData({ name: '', phone: '', email: '', message: '' });
      setTurnstileToken('');
      setTurnstileMessage(null);
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current);
      }
    });
  };

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
    zIndex: 9999,
    opacity: show ? 1 : 0,
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    padding: '20px',
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: isDarkBase ? 'rgba(24,24,28,0.9)' : 'rgba(255,255,255,0.88)',
    color: activePalette.fontColor,
    padding: '40px',
    maxWidth: '550px',
    width: '100%',
    borderRadius: '28px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase ? '0 32px 64px -12px rgba(0, 0, 0, 0.6)' : '0 32px 64px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    backdropFilter: 'blur(var(--glass-blur-deep))',
    textShadow: isDarkBase ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px 14px 44px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '16px',
    color: activePalette.fontColor,
    fontSize: '14px',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const iconStyle: React.CSSProperties = {
    position: 'absolute',
    top: '15px',
    left: '16px',
    opacity: 0.5,
    color: activePalette.fontColor,
  };

  const submitDisabled = isSubmitting || !turnstileSiteKey || !turnstileToken;

  const buttonStyle: React.CSSProperties = {
    backgroundColor: activePalette.titleColor,
    color: isDarkBase ? '#000' : '#fff',
    border: 'none',
    padding: '16px',
    fontSize: '15px',
    fontWeight: '800',
    borderRadius: '100px',
    cursor: submitDisabled ? 'not-allowed' : 'pointer',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s ease',
    boxShadow: `0 8px 24px ${activePalette.titleColor}40`,
    opacity: submitDisabled ? 0.7 : 1,
    marginTop: '10px',
    letterSpacing: '1px',
  };

  return (
    <div style={overlayStyle} role="dialog" aria-modal="true" aria-labelledby="comment-title">
      <div style={modalStyle}>
        <button
          type="button"
          onClick={onClose}
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

        <h2
          id="comment-title"
          style={{
            margin: '0 0 8px 0',
            fontSize: '24px',
            fontWeight: '800',
            color: activePalette.titleColor,
            letterSpacing: '-0.02em',
          }}
        >
          Deixar um Comentário
        </h2>
        <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '25px', marginTop: 0, fontWeight: '500' }}>
          Em relação ao fragmento: <strong>{currentPost?.title || 'Geral'}</strong>
        </p>

        <form
          onSubmit={handleSubmit}
          autoComplete="on"
          style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}
        >
          <div style={{ position: 'relative' }}>
            <label htmlFor="comment-name" className="sr-only">
              Seu Nome
            </label>
            <User size={18} style={iconStyle} />
            <input
              id="comment-name"
              type="text"
              name="name"
              placeholder="Seu Nome (Opcional)"
              autoComplete="name"
              value={formData.name}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <label htmlFor="comment-phone" className="sr-only">
                Telefone
              </label>
              <Phone size={18} style={iconStyle} />
              <input
                id="comment-phone"
                type="tel"
                name="phone"
                placeholder="Telefone (Opcional)"
                autoComplete="tel-national"
                inputMode="tel"
                value={formData.phone}
                onChange={handleChange}
                maxLength={16}
                style={inputStyle}
              />
            </div>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <label htmlFor="comment-email" className="sr-only">
                Seu E-mail
              </label>
              <Mail size={18} style={iconStyle} />
              <input
                id="comment-email"
                type="email"
                name="email"
                placeholder="Seu E-mail (Opcional)"
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label htmlFor="comment-message" className="sr-only">
              Comentário
            </label>
            <textarea
              id="comment-message"
              name="message"
              required
              maxLength={1000}
              autoComplete="off"
              placeholder="Escreva seu comentário aqui (Obrigatório)..."
              value={formData.message}
              onChange={handleChange}
              style={{ ...inputStyle, padding: '16px', minHeight: '140px', resize: 'vertical' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                right: '16px',
                fontSize: '11px',
                fontWeight: '800',
                color: charsLeft < 50 ? 'var(--semantic-error)' : activePalette.fontColor,
                opacity: charsLeft < 50 ? 1 : 0.5,
              }}
            >
              {charsLeft} restantes
            </div>
          </div>

          {turnstileSiteKey ? (
            <div ref={turnstileRef} />
          ) : (
            <div style={{ fontSize: '12px', opacity: 0.72 }}>
              Comentários por e-mail ficam indisponíveis até a verificação de segurança ser configurada.
            </div>
          )}
          {turnstileMessage && (
            <div style={{ fontSize: '12px', color: 'var(--semantic-error)', opacity: 0.9 }}>{turnstileMessage}</div>
          )}

          <button
            type="submit"
            disabled={submitDisabled}
            style={buttonStyle}
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
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {isSubmitting ? 'ENVIANDO...' : 'ENVIAR COMENTÁRIO'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CommentModal;
