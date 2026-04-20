/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/ChatWidget.tsx
// Versão: v1.6.0
// Descrição: TypeScript migration. Chat MD3 + Glassmorphism. Gatilho de Doação preservado.

import { Heart, Send, Sparkles, X } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import type { ActivePalette, Post } from '../types';
import './ChatWidget.css';

type AiVisualStatus = 'idle' | 'thinking' | 'responding';

interface ChatMessage {
  id: string;
  role: 'user' | 'bot';
  text: string;
  hasDonationButton?: boolean;
}

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  currentPost: Post | null;
  activePalette: ActivePalette;
  API_URL: string;
  triggerDonation?: () => void;
}

const createMessageId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const ChatWidget = ({ isOpen, onClose, currentPost, activePalette, API_URL, triggerDonation }: ChatWidgetProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createMessageId(),
      role: 'bot',
      text: 'Olá. Como posso guiar sua reflexão sobre os textos hoje?',
      hasDonationButton: false,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiVisualStatus, setAiVisualStatus] = useState<AiVisualStatus>('idle');
  const [interactionCount, setInteractionCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const aiStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen || messages.length === 0) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    return () => {
      if (aiStatusTimeoutRef.current) {
        clearTimeout(aiStatusTimeoutRef.current);
        aiStatusTimeoutRef.current = null;
      }
    };
  }, []);

  const handleSend = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    if (aiStatusTimeoutRef.current) {
      clearTimeout(aiStatusTimeoutRef.current);
      aiStatusTimeoutRef.current = null;
    }

    const userMsg = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { id: createMessageId(), role: 'user', text: userMsg }]);
    setIsLoading(true);
    setAiVisualStatus('thinking');

    const currentCount = interactionCount + 1;
    setInteractionCount(currentCount);

    try {
      const payload = {
        message: userMsg,
        currentContext: currentPost ? { title: currentPost.title, content: currentPost.content } : null,
        askForDonation: currentCount === 3,
      };

      const res = await fetch(`${API_URL}/ai/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Falha de comunicação neural.');
      const data = await res.json();

      let rawText: string = data.reply || data.text || 'Processamento concluído.';
      let showDonationButton = false;

      if (rawText.includes('[[PEDIR_DOACAO]]')) {
        showDonationButton = true;
        rawText = rawText.replace('[[PEDIR_DOACAO]]', '').trim();
      }

      setMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: 'bot', text: rawText, hasDonationButton: showDonationButton },
      ]);
      setAiVisualStatus('responding');
      aiStatusTimeoutRef.current = setTimeout(() => {
        setAiVisualStatus('idle');
      }, 1400);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: 'bot',
          text: 'Sinal interrompido. Tente novamente em instantes.',
          hasDonationButton: false,
        },
      ]);
      setAiVisualStatus('responding');
      aiStatusTimeoutRef.current = setTimeout(() => {
        setAiVisualStatus('idle');
      }, 1400);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');
  const aiStatusMeta =
    aiVisualStatus === 'thinking'
      ? { text: 'Analisando...', color: 'rgba(77,166,255,0.95)' }
      : aiVisualStatus === 'responding'
        ? { text: 'Respondendo...', color: 'rgba(46,125,50,0.95)' }
        : { text: 'Pronta', color: isDarkBase ? 'rgba(255,255,255,0.62)' : 'rgba(0,0,0,0.48)' };
  const widgetClassName = `chat-widget chat-widget--${isDarkBase ? 'dark' : 'light'} chat-widget--${aiVisualStatus}`;

  return (
    <aside aria-label="Assistente de busca semântica" className={widgetClassName}>
      <div className="chat-widget__panel">
        <div className="chat-widget__header">
          <div className="chat-widget__brand">
            <div className="chat-widget__brand-mark">
              <span aria-hidden="true" className="chat-widget__brand-ring" />
              <Sparkles size={18} className="chat-widget__brand-icon" />
            </div>
            <div className="chat-widget__brand-copy">
              <span className="chat-widget__title">Consciência Auxiliar</span>
              <span className="chat-widget__status-inline">{aiStatusMeta.text}</span>
            </div>
          </div>
          <div className="chat-widget__header-actions">
            <span className="chat-widget__status-pill">{aiStatusMeta.text}</span>
            <button type="button" onClick={onClose} aria-label="Fechar chat" className="chat-widget__close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="chat-widget__activity-track">
          {(aiVisualStatus === 'thinking' || aiVisualStatus === 'responding') && (
            <span aria-hidden="true" className="chat-widget__activity-sweep" />
          )}
        </div>

        <div role="log" aria-live="polite" aria-label="Histórico de mensagens" className="chat-widget__messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`chat-widget__message-row chat-widget__message-row--${msg.role}`}>
              <div className={`chat-widget__bubble chat-widget__bubble--${msg.role}`}>{msg.text}</div>

              {msg.hasDonationButton && (
                <button type="button" onClick={() => triggerDonation?.()} className="chat-widget__donation">
                  <Heart size={16} fill="#fff" /> Apoiar o Projeto
                </button>
              )}
            </div>
          ))}
          {isLoading && (
            <div role="status" aria-label="Processando resposta" className="chat-widget__typing">
              <div className="chat-widget__typing-pill">
                <span className="chat-widget__typing-dot" />
                <span className="chat-widget__typing-dot chat-widget__typing-dot--delay-1" />
                <span className="chat-widget__typing-dot chat-widget__typing-dot--delay-2" />
              </div>
              A analisar o contexto...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="chat-widget__input-area">
          <label htmlFor="chat-message-input" className="sr-only">
            Mensagem para o assistente
          </label>
          <input
            id="chat-message-input"
            name="chatMessageInput"
            type="text"
            autoComplete="off"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta..."
            className="chat-widget__input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Enviar mensagem"
            className="chat-widget__send"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </aside>
  );
};

export default ChatWidget;
