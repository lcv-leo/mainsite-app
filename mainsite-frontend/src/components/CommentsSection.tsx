/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
/**
 * CommentsSection — Seção pública de comentários inline no PostReader.
 * Threading de 2 níveis (comentário → resposta).
 * Integra Cloudflare Turnstile (CAPTCHA invisível) e honeypot anti-bot.
 * Comentários são moderados automaticamente via GCP NL API no backend.
 */
import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { MessageSquareText, Reply, Send, ChevronDown, ChevronUp, Shield } from 'lucide-react';
import type { ActivePalette } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface Comment {
  id: number;
  post_id: number;
  parent_id: number | null;
  author_name: string;
  content: string;
  is_author_reply: number;
  created_at: string;
  replies?: Comment[];
}

interface CommentsSectionProps {
  postId: number;
  activePalette: ActivePalette;
  apiUrl: string;
  turnstileSiteKey?: string;
}

// ── Cloudflare Turnstile Type Augmentation ──────────────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback: (token: string) => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark' | 'auto';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

// ── Component ───────────────────────────────────────────────────────────────

const CommentsSection = ({ postId, activePalette, apiUrl, turnstileSiteKey }: CommentsSectionProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Form state
  const [authorName, setAuthorName] = useState('');
  const [authorEmail, setAuthorEmail] = useState('');
  const [content, setContent] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  const isDark = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  // ── Fetch approved comments ───────────────────────────────────────────

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/comments/${postId}`);
      if (res.ok) {
        const data = await res.json() as { comments: Comment[]; total: number };
        setComments(data.comments || []);
        setTotalComments(data.total || 0);
      }
    } catch { /* silêncio */ }
    finally { setIsLoading(false); }
  }, [apiUrl, postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // ── Turnstile initialization ──────────────────────────────────────────

  useEffect(() => {
    if (!turnstileSiteKey || !showForm || !turnstileRef.current) return;
    if (turnstileWidgetId.current) return; // Already rendered

    // Load Turnstile script if not already present
    if (!document.querySelector('script[src*="turnstile"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => renderTurnstile();
      document.head.appendChild(script);
    } else {
      renderTurnstile();
    }

    function renderTurnstile() {
      if (!window.turnstile || !turnstileRef.current) return;
      turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: turnstileSiteKey!,
        callback: (token: string) => setTurnstileToken(token),
        theme: isDark ? 'dark' : 'light',
        size: 'compact',
      });
    }

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [turnstileSiteKey, showForm, isDark]);

  // ── Submit comment ────────────────────────────────────────────────────

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !content.trim()) return;

    if (turnstileSiteKey && !turnstileToken) {
      setSubmitMessage({ text: 'Aguarde a verificação de segurança.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const res = await fetch(`${apiUrl}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          parent_id: replyingTo,
          author_name: authorName.trim() || undefined,
          author_email: authorEmail.trim() || undefined,
          content: content.trim(),
          turnstile_token: turnstileToken || undefined,
          _hp: honeypot || undefined,
        }),
      });

      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (res.ok && data.success) {
        setSubmitMessage({ text: data.message || 'Comentário enviado!', type: 'success' });
        setContent('');
        setReplyingTo(null);
        setShowForm(false);
        // Refresh: if auto-approved, the new comment will appear
        setTimeout(() => fetchComments(), 1000);
      } else {
        setSubmitMessage({ text: data.error || 'Erro ao enviar comentário.', type: 'error' });
      }
    } catch {
      setSubmitMessage({ text: 'Falha de conexão. Tente novamente.', type: 'error' });
    } finally {
      setIsSubmitting(false);
      // Reset Turnstile for next submission
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId.current);
        setTurnstileToken('');
      }
    }
  };

  // ── Format date ───────────────────────────────────────────────────────

  const formatDate = (raw: string): string => {
    try {
      const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
      return d.toLocaleDateString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return raw; }
  };

  // ── Render a single comment ───────────────────────────────────────────

  const renderComment = (comment: Comment, isReply = false) => (
    <div
      key={comment.id}
      style={{
        marginLeft: isReply ? '24px' : 0,
        padding: '16px',
        marginBottom: '12px',
        borderRadius: '12px',
        background: comment.is_author_reply
          ? (isDark ? 'rgba(138,180,248,0.08)' : 'rgba(66,133,244,0.05)')
          : (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'),
        border: `1px solid ${comment.is_author_reply
          ? (isDark ? 'rgba(138,180,248,0.2)' : 'rgba(66,133,244,0.15)')
          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`,
        borderLeft: isReply
          ? `3px solid ${isDark ? 'rgba(138,180,248,0.3)' : 'rgba(66,133,244,0.25)'}`
          : undefined,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{
          fontSize: '13px', fontWeight: 700, color: activePalette.titleColor,
        }}>
          {comment.author_name}
          {comment.is_author_reply === 1 && (
            <span style={{
              marginLeft: '6px', fontSize: '10px', fontWeight: 600,
              padding: '2px 8px', borderRadius: '100px',
              background: isDark ? 'rgba(138,180,248,0.15)' : 'rgba(66,133,244,0.1)',
              color: isDark ? '#8ab4f8' : '#1a73e8',
              verticalAlign: 'middle',
            }}>
              AUTOR
            </span>
          )}
        </span>
        <span style={{ fontSize: '11px', opacity: 0.4, marginLeft: 'auto' }}>
          {formatDate(comment.created_at)}
        </span>
      </div>

      {/* Content */}
      <div style={{
        fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap',
        color: activePalette.fontColor, opacity: 0.9,
      }}>
        {comment.content}
      </div>

      {/* Reply button (only for top-level comments) */}
      {!isReply && (
        <button
          type="button"
          onClick={() => {
            setReplyingTo(comment.id);
            setShowForm(true);
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            marginTop: '8px', padding: '4px 10px', borderRadius: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '11px', fontWeight: 600, fontFamily: 'inherit',
            color: activePalette.titleColor, opacity: 0.6,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; }}
        >
          <Reply size={12} /> Responder
        </button>
      )}

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          {comment.replies.map(reply => renderComment(reply, true))}
        </div>
      )}
    </div>
  );

  // ── Main Render ───────────────────────────────────────────────────────

  return (
    <section
      aria-label="Comentários"
      style={{
        marginTop: '3rem',
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        paddingTop: '2rem',
      }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '12px 16px', borderRadius: '12px',
          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          cursor: 'pointer', fontFamily: 'inherit', color: activePalette.fontColor,
          transition: 'all 0.2s ease',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700 }}>
          <MessageSquareText size={16} />
          Comentários{totalComments > 0 ? ` (${totalComments})` : ''}
        </span>
        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {/* Expandable content */}
      <div style={{
        maxHeight: isExpanded ? '5000px' : '0',
        overflow: 'hidden',
        transition: 'max-height 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: isExpanded ? 1 : 0,
      }}>
        <div style={{ padding: '16px 0' }}>
          {/* Comment list */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.5, fontSize: '13px' }}>
              Carregando comentários...
            </div>
          ) : comments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', opacity: 0.4, fontSize: '13px' }}>
              Seja o primeiro a comentar esta leitura.
            </div>
          ) : (
            <div>{comments.map(c => renderComment(c))}</div>
          )}

          {/* Moderation notice */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '11px', opacity: 0.4, margin: '16px 0 12px',
            fontWeight: 500,
          }}>
            <Shield size={12} /> Comentários são moderados automaticamente.
          </div>

          {/* Submit message */}
          {submitMessage && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, marginBottom: '12px',
              background: submitMessage.type === 'success'
                ? (isDark ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.08)')
                : (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.08)'),
              color: submitMessage.type === 'success' ? '#10b981' : '#ef4444',
              border: `1px solid ${submitMessage.type === 'success' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {submitMessage.text}
            </div>
          )}

          {/* New comment / Reply toggle */}
          {!showForm ? (
            <button
              type="button"
              onClick={() => { setShowForm(true); setReplyingTo(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '12px 20px', borderRadius: '10px', width: '100%',
                background: isDark ? 'rgba(138,180,248,0.1)' : 'rgba(66,133,244,0.08)',
                border: `1px solid ${isDark ? 'rgba(138,180,248,0.2)' : 'rgba(66,133,244,0.15)'}`,
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600,
                color: activePalette.titleColor, justifyContent: 'center',
                transition: 'all 0.2s ease',
              }}
            >
              <MessageSquareText size={14} /> Escrever comentário
            </button>
          ) : (
            /* Comment form */
            <form onSubmit={handleSubmit} style={{
              padding: '20px', borderRadius: '12px',
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
            }}>
              {replyingTo && (
                <div style={{
                  fontSize: '12px', fontWeight: 600, marginBottom: '12px',
                  color: activePalette.titleColor, opacity: 0.7,
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}>
                  <Reply size={12} /> Respondendo a um comentário
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto',
                      fontSize: '11px', color: '#ef4444', fontWeight: 600, fontFamily: 'inherit',
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Nome (opcional)"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  maxLength={100}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: activePalette.fontColor, outline: 'none',
                  }}
                />
                <input
                  type="email"
                  placeholder="E-mail (opcional)"
                  value={authorEmail}
                  onChange={e => setAuthorEmail(e.target.value)}
                  maxLength={255}
                  style={{
                    padding: '10px 14px', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit',
                    background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    color: activePalette.fontColor, outline: 'none',
                  }}
                />
              </div>

              <textarea
                placeholder="Compartilhe sua reflexão..."
                value={content}
                onChange={e => setContent(e.target.value)}
                maxLength={2000}
                rows={4}
                required
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '8px', fontSize: '13px',
                  fontFamily: 'inherit', lineHeight: '1.7', resize: 'vertical', boxSizing: 'border-box',
                  background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  color: activePalette.fontColor, outline: 'none',
                }}
              />

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: '10px', flexWrap: 'wrap', gap: '8px',
              }}>
                <span style={{ fontSize: '11px', opacity: 0.4, fontWeight: 500 }}>
                  {content.length}/2000
                </span>

                {/* Turnstile widget container */}
                {turnstileSiteKey && <div ref={turnstileRef} />}

                {/* Honeypot — hidden field bots will fill */}
                <input
                  type="text"
                  name="_hp"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', height: 0, width: 0, opacity: 0 }}
                />

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setReplyingTo(null); }}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                      background: 'none', border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      color: activePalette.fontColor, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !content.trim()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 20px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      background: isSubmitting || !content.trim()
                        ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                        : 'linear-gradient(135deg, #4285f4, #7c3aed)',
                      border: 'none', color: isSubmitting || !content.trim() ? 'rgba(128,128,128,0.5)' : '#fff',
                      cursor: isSubmitting ? 'wait' : (content.trim() ? 'pointer' : 'not-allowed'),
                      fontFamily: 'inherit', transition: 'all 0.2s ease',
                    }}
                  >
                    <Send size={12} /> {isSubmitting ? 'Enviando...' : 'Publicar'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
};

export default CommentsSection;
