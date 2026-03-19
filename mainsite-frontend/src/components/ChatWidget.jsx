// Módulo: mainsite-frontend/src/components/ChatWidget.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para utilizar o motor de estilos central (Glassmorphism/MD3), alinhando completamente a UI do chat com o restante da aplicação.

import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Loader2, Sparkles, Heart } from 'lucide-react';

const ChatWidget = ({ isOpen, onClose, currentPost, activePalette, API_URL, triggerDonation, styles, showNotification }) => {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Olá. Como posso guiar sua reflexão sobre os textos hoje?', hasDonationButton: false }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);
    setInteractionCount(prev => prev + 1);

    try {
      const payload = { 
        message: userMsg, 
        currentContext: currentPost ? { title: currentPost.title, content: currentPost.content } : null,
        askForDonation: interactionCount + 1 === 3
      };

      const res = await fetch(`${API_URL}/ai/public/chat`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha de comunicação neural.');
      const data = await res.json();
      
      let rawText = data.reply || data.text || 'Processamento concluído.';
      const showDonationButton = rawText.includes('[[PEDIR_DOACAO]]');
      if (showDonationButton) rawText = rawText.replace('[[PEDIR_DOACAO]]', '').trim();
      
      setMessages(prev => [...prev, { role: 'bot', text: rawText, hasDonationButton: showDonationButton }]);
    } catch (err) {
      showNotification(err.message || 'Sinal interrompido. Tente novamente.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !styles) return null;
  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const panelStyle = {
    ...styles.appContainer,
    position: 'fixed',
    bottom: '30px',
    right: '30px',
    width: '370px',
    height: 'min(600px, 80vh)',
    padding: '0',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 9998,
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  };
  
  const headerStyle = {
    padding: '16px 20px',
    borderBottom: `1px solid ${styles.glassBorder}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  };

  const messageAreaStyle = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const inputAreaStyle = {
    padding: '16px',
    borderTop: `1px solid ${styles.glassBorder}`,
    display: 'flex',
    gap: '10px',
    flexShrink: 0
  };

  const donationCCommerceBtnStyle = {
    ...styles.adminButton,
    backgroundColor: '#ec4899', 
    color: '#fff', 
    marginTop: '15px',
    width: '100%',
    boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.3)'
  };

  return (
    <>
      <style>{`@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ ...styles.plusButton, borderRadius: '50%', width: '36px', height: '36px', padding: 0 }}>
              <Sparkles size={18} />
            </div>
            <span style={{ fontWeight: '600', fontSize: '15px', color: activePalette.fontColor }}>Consciência Auxiliar</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }}> <X size={20} /> </button>
        </div>

        <div style={messageAreaStyle}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ 
                ...styles.postCard,
                padding: '12px 16px',
                maxWidth: '85%', 
                background: msg.role === 'user' ? activePalette.titleColor : styles.glassBg,
                color: msg.role === 'user' ? (isDarkBase ? '#000' : '#fff') : activePalette.fontColor,
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'bot' ? '4px' : '16px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
              }}>
                {msg.text}
              </div>
              {msg.hasDonationButton && (
                <button onClick={() => triggerDonation?.()} style={donationCCommerceBtnStyle}>
                  <Heart size={14} fill="#fff" /> Apoiar o Projeto
                </button>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activePalette.fontColor, opacity: 0.6, fontSize: '12px', padding: '10px 0' }}>
              <Loader2 size={14} className="animate-spin" /> A analisar...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} style={inputAreaStyle}>
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Faça uma pergunta..." style={{...styles.textInput, flex: 1}} disabled={isLoading} autoFocus />
          <button type="submit" disabled={isLoading || !input.trim()} style={{ ...styles.adminButton, width: '50px', padding: 0 }}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </>
  );
};

export default ChatWidget;