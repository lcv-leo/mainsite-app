// Módulo: mainsite-frontend/src/components/ChatWidget.jsx
// Versão: v1.5.0
// Descrição: Chat MD3 + Glassmorphism. Gatilho de Doação preservado.

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, Heart } from 'lucide-react';

const ChatWidget = ({ isOpen, onClose, currentPost, activePalette, API_URL, triggerDonation }) => {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Olá. Como posso guiar sua reflexão sobre os textos hoje?', hasDonationButton: false }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    const currentCount = interactionCount + 1;
    setInteractionCount(currentCount);

    try {
      const payload = {
        message: userMsg,
        currentContext: currentPost ? { title: currentPost.title, content: currentPost.content } : null,
        askForDonation: currentCount === 3
      };

      const res = await fetch(`${API_URL}/ai/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha de comunicação neural.');
      const data = await res.json();

      let rawText = data.reply || data.text || 'Processamento concluído.';
      let showDonationButton = false;

      if (rawText.includes('[[PEDIR_DOACAO]]')) {
        showDonationButton = true;
        rawText = rawText.replace('[[PEDIR_DOACAO]]', '').trim();
      }

      setMessages(prev => [...prev, { role: 'bot', text: rawText, hasDonationButton: showDonationButton }]);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sinal interrompido. Tente novamente em instantes.', hasDonationButton: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const panelStyle = {
    position: 'fixed',
    bottom: '96px',
    right: '24px',
    width: '380px',
    height: '550px',
    maxHeight: '75vh',
    maxWidth: 'calc(100vw - 48px)',
    backgroundColor: isDarkBase ? 'rgba(18, 18, 22, 0.88)' : 'rgba(255, 255, 255, 0.88)',
    backdropFilter: 'blur(var(--glass-blur-deep))',
    WebkitBackdropFilter: 'blur(var(--glass-blur-deep))',
    borderRadius: '28px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase ? '0 32px 64px -12px rgba(0, 0, 0, 0.6)' : '0 32px 64px -12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 9998,
    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
  };

  const headerStyle = {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(128, 128, 128, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkBase ? 'rgba(8,8,12,0.34)' : 'rgba(255,255,255,0.4)',
  };

  const messageAreaStyle = {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(128,128,128,0.3) transparent'
  };

  const inputAreaStyle = {
    padding: '20px',
    borderTop: '1px solid rgba(128, 128, 128, 0.15)',
    backgroundColor: isDarkBase ? 'rgba(8,8,12,0.34)' : 'rgba(255,255,255,0.4)',
    display: 'flex',
    gap: '12px'
  };

  const inputFieldStyle = {
    flex: 1,
    padding: '14px 20px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '100px',
    color: activePalette.fontColor,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const sendButtonStyle = {
    backgroundColor: activePalette.titleColor,
    color: isDarkBase ? '#000' : '#fff',
    border: 'none',
    borderRadius: '100px',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.6 : 1,
    transition: 'all 0.2s',
    boxShadow: `0 8px 16px ${activePalette.titleColor}40`
  };

  const donationCCommerceBtnStyle = {
    backgroundColor: '#ec4899',
    color: '#fff',
    border: 'none',
    padding: '14px 20px',
    fontSize: '14px',
    fontWeight: '800',
    borderRadius: '100px',
    cursor: 'pointer',
    marginTop: '20px',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 8px 24px rgba(236, 72, 153, 0.3)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    letterSpacing: '0.5px'
  };

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: activePalette.titleColor,
              color: isDarkBase ? '#000' : '#fff',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              flexShrink: 0
            }}>
              <Sparkles size={18} />
            </div>
            <span style={{ fontWeight: '700', fontSize: '16px', color: activePalette.fontColor, letterSpacing: '0.5px' }}>Consciência Auxiliar</span>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(128,128,128,0.1)', borderRadius: '100px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(128,128,128,0.16)', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.8, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = 0.8; e.currentTarget.style.transform = 'translateY(0)'; }}>
            <X size={20} />
          </button>
        </div>

        <div style={messageAreaStyle}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
              <div style={{
                maxWidth: '85%',
                padding: '14px 18px',
                borderRadius: '20px',
                backgroundColor: msg.role === 'user' ? activePalette.titleColor : (isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                color: msg.role === 'user' ? (isDarkBase ? '#000' : '#fff') : activePalette.fontColor,
                fontSize: '14px',
                lineHeight: '1.6',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '20px',
                borderBottomLeftRadius: msg.role === 'bot' ? '4px' : '20px',
                whiteSpace: 'pre-wrap',
                boxShadow: msg.role === 'user' ? `0 4px 12px ${activePalette.titleColor}30` : 'none'
              }}>
                {msg.text}
              </div>

              {msg.hasDonationButton && (
                <button
                  onClick={() => triggerDonation && triggerDonation()}
                  style={donationCCommerceBtnStyle}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Heart size={16} fill="#fff" /> Apoiar o Projeto
                </button>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activePalette.fontColor, opacity: 0.6, fontSize: '13px', padding: '10px 0', fontWeight: '600' }}>
              <Loader2 size={16} className="animate-spin" /> A analisar o contexto...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} style={inputAreaStyle}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Faça uma pergunta..."
            style={inputFieldStyle}
            disabled={isLoading}
            autoFocus
          />
          <button type="submit" disabled={isLoading || !input.trim()} style={sendButtonStyle} onMouseOver={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1.05)')} onMouseOut={(e) => !isLoading && (e.currentTarget.style.transform = 'scale(1)')}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatWidget;