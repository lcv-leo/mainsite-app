// Módulo: mainsite-frontend/src/components/ChatWidget.jsx
// Versão: v1.4.0
// Descrição: Integração C-Commerce (Conversational Commerce). O Chat intercepta interações, aciona a flag de sustentabilidade (askForDonation) após 3 turnos, apaga a tag [[PEDIR_DOACAO]] e renderiza um botão nativo de doação. Preservado o Glassmorphism e o ícone Sparkles.

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, Heart } from 'lucide-react';

const ChatWidget = ({ isOpen, onClose, currentPost, activePalette, API_URL, triggerDonation }) => {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Olá. Como posso guiar sua reflexão sobre os textos hoje?', hasDonationButton: false }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0); // Contador C-Commerce
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

    // Incrementa a contagem de interações do usuário
    const currentCount = interactionCount + 1;
    setInteractionCount(currentCount);

    try {
      // Flag de gatilho C-Commerce enviada ao backend na 3ª iteração
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

      // Interceptação C-Commerce: Localiza a tag, remove-a e ativa o botão
      if (rawText.includes('[[PEDIR_DOACAO]]')) {
        showDonationButton = true;
        rawText = rawText.replace('[[PEDIR_DOACAO]]', '').trim();
      }
      
      setMessages(prev => [...prev, { role: 'bot', text: rawText, hasDonationButton: showDonationButton }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sinal interrompido. Tente novamente em instantes.', hasDonationButton: false }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  // Métrica Glassmorphism: Painel do Chat
  const panelStyle = {
    position: 'fixed',
    bottom: '90px',
    right: '20px',
    width: '350px',
    height: '500px',
    maxHeight: '75vh',
    maxWidth: 'calc(100vw - 40px)',
    backgroundColor: isDarkBase ? 'rgba(20, 20, 22, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '16px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    zIndex: 9998,
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
  };

  const headerStyle = {
    padding: '16px 20px',
    borderBottom: '1px solid rgba(128, 128, 128, 0.15)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
  };

  const messageAreaStyle = {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    scrollbarWidth: 'thin',
    scrollbarColor: 'rgba(128,128,128,0.3) transparent'
  };

  const inputAreaStyle = {
    padding: '16px',
    borderTop: '1px solid rgba(128, 128, 128, 0.15)',
    backgroundColor: isDarkBase ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)',
    display: 'flex',
    gap: '10px'
  };

  const inputFieldStyle = {
    flex: 1,
    padding: '12px 16px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '8px',
    color: activePalette.fontColor,
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box'
  };

  const sendButtonStyle = {
    backgroundColor: activePalette.titleColor,
    color: isDarkBase ? '#000' : '#fff',
    border: 'none',
    borderRadius: '8px',
    width: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isLoading ? 'not-allowed' : 'pointer',
    opacity: isLoading ? 0.6 : 1,
    transition: 'transform 0.2s'
  };

  // Botão Injetado via C-Commerce
  const donationCCommerceBtnStyle = {
    backgroundColor: '#ec4899', 
    color: '#fff', 
    border: 'none', 
    padding: '10px 16px', 
    fontSize: '12px', 
    fontWeight: 'bold', 
    borderRadius: '8px', 
    cursor: 'pointer', 
    marginTop: '10px', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    boxShadow: '0 4px 14px 0 rgba(236, 72, 153, 0.3)', 
    transition: 'transform 0.2s',
    letterSpacing: '0.5px'
  };

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ 
              backgroundColor: activePalette.titleColor, 
              color: isDarkBase ? '#000' : '#fff', 
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '30px',
              height: '30px',
              flexShrink: 0
            }}>
              <Sparkles size={16} />
            </div>
            <span style={{ fontWeight: '600', fontSize: '15px', color: activePalette.fontColor }}>Consciência Auxiliar</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }} onMouseOver={(e) => e.currentTarget.style.opacity = 1} onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}>
            <X size={20} />
          </button>
        </div>

        <div style={messageAreaStyle}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', width: '100%' }}>
              <div style={{ 
                maxWidth: '85%', 
                padding: '12px 16px', 
                borderRadius: '12px', 
                backgroundColor: msg.role === 'user' ? activePalette.titleColor : (isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
                color: msg.role === 'user' ? (isDarkBase ? '#000' : '#fff') : activePalette.fontColor,
                fontSize: '14px',
                lineHeight: '1.5',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                borderBottomLeftRadius: msg.role === 'bot' ? '4px' : '12px',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.text}
              </div>
              
              {/* RENDERIZAÇÃO DO GATILHO C-COMMERCE */}
              {msg.hasDonationButton && (
                <button 
                  onClick={() => triggerDonation && triggerDonation()} 
                  style={donationCCommerceBtnStyle}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Heart size={14} fill="#fff" /> Apoiar o Projeto
                </button>
              )}
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activePalette.fontColor, opacity: 0.6, fontSize: '12px', padding: '10px 0' }}>
              <Loader2 size={14} className="animate-spin" /> A analisar o contexto...
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