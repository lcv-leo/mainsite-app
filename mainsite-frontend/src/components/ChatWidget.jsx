// Módulo: mainsite-frontend/src/components/ChatWidget.jsx
// Versão: v1.2.0
// Descrição: Painel flutuante de IA padronizado em Glassmorphism, mantendo consistência visual de bordas, sombras e blur de fundo.

import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';

const ChatWidget = ({ isOpen, onClose, currentPost, activePalette, API_URL }) => {
  const [messages, setMessages] = useState([
    { role: 'bot', text: 'Olá. Como posso guiar sua reflexão sobre os textos hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
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

    try {
      const payload = { 
        message: userMsg, 
        currentContext: currentPost ? { title: currentPost.title, content: currentPost.content } : null 
      };

      const res = await fetch(`${API_URL}/ai/public/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Falha de comunicação neural.');
      const data = await res.json();
      
      setMessages(prev => [...prev, { role: 'bot', text: data.reply || data.text || 'Processamento concluído.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: 'Sinal interrompido. Tente novamente em instantes.' }]);
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

  return (
    <>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      
      <div style={panelStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', padding: '6px', borderRadius: '50%' }}>
              <Bot size={16} />
            </div>
            <span style={{ fontWeight: '600', fontSize: '15px', color: activePalette.fontColor }}>Assistente IA</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }} onMouseOver={(e) => e.currentTarget.style.opacity = 1} onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}>
            <X size={20} />
          </button>
        </div>

        <div style={messageAreaStyle}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
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
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: activePalette.fontColor, opacity: 0.6, fontSize: '12px', padding: '10px 0' }}>
              <Loader2 size={14} className="animate-spin" /> Analisando contexto...
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

export default ChatWidget;// Módulo: mainsite-frontend/src/components/ChatWidget.jsx
// Versão: v1.0.1
// Descrição: Componente isolado do Assistente Virtual (IA), com gestão de estado próprio e auto-scroll.

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Loader2 } from 'lucide-react';

const ChatWidget = ({ isOpen, onClose, currentPost, activePalette, API_URL }) => {
  const [chatMessages, setChatMessages] = useState([{ role: 'bot', text: 'Olá. Como posso ajudar você a explorar os textos publicados neste site?' }]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isOpen]);

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMessage = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setChatInput(''); 
    setIsChatLoading(true);

    const payloadContext = currentPost ? { title: currentPost.title, content: currentPost.content } : null;

    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/ai/public/chat`, { 
          method: 'POST', headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify({ message: userMessage, currentContext: payloadContext }) 
        }),
        new Promise(resolve => setTimeout(resolve, 800))
      ]);
      const data = await res.json();
      if (res.ok) setChatMessages(prev => [...prev, { role: 'bot', text: data.reply }]);
      else throw new Error();
    } catch (err) { 
      setChatMessages(prev => [...prev, { role: 'bot', text: "Desculpe, ocorreu um erro de conexão com a IA." }]); 
    } finally { 
      setIsChatLoading(false); 
    }
  };

  if (!isOpen || !activePalette) return null;

  return (
    <>
      <style>{`
        .chat-window { position: fixed; right: 30px; bottom: 100px; width: 380px; height: 550px; max-height: 80vh; background-color: ${activePalette.bgColor}; border: 1px solid rgba(77, 166, 255, 0.3); border-radius: 16px; display: flex; flex-direction: column; z-index: 10000; box-shadow: 0 20px 60px rgba(0,0,0,0.3), 0 0 30px rgba(77, 166, 255, 0.1); overflow: hidden; animation: fadeIn 0.3s ease-out; }
        .chat-header { background: linear-gradient(to right, rgba(0, 68, 204, 0.9), rgba(51, 153, 255, 0.8)); padding: 18px; display: flex; justify-content: space-between; align-items: center; font-weight: bold; letter-spacing: 1.5px; font-size: 14px; text-transform: uppercase; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: #fff; }
        .chat-body { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; scroll-behavior: smooth; }
        .chat-bubble { padding: 12px 18px; border-radius: 12px; font-size: 14px; line-height: 1.6; max-width: 85%; word-wrap: break-word; font-family: sans-serif; }
        .bubble-user { background: rgba(128,128,128,0.1); align-self: flex-end; border-bottom-right-radius: 2px; color: ${activePalette.fontColor}; }
        .bubble-bot { background: rgba(51, 153, 255, 0.15); align-self: flex-start; border-bottom-left-radius: 2px; border: 1px solid rgba(51, 153, 255, 0.3); color: ${activePalette.fontColor}; }
        .chat-footer { padding: 15px; background: ${activePalette.bgColor}; border-top: 1px solid rgba(128,128,128,0.2); display: flex; gap: 12px; }
        .chat-input { flex: 1; background: rgba(128,128,128,0.05); border: 1px solid rgba(128,128,128,0.2); padding: 12px 15px; border-radius: 8px; color: inherit; font-family: sans-serif; font-size: 14px; outline: none; transition: border-color 0.3s; }
        .chat-input:focus { border-color: #4da6ff; background: rgba(128,128,128,0.1); }
        .chat-send { background: #4da6ff; color: #000; border: none; cursor: pointer; padding: 10px; border-radius: 8px; display: flex; justify-content: center; align-items: center; transition: all 0.2s; }
        .chat-send:hover:not(:disabled) { background: #66b3ff; transform: translateY(-2px); }
        .chat-send:disabled { opacity: 0.5; cursor: not-allowed; background: rgba(128,128,128,0.2); color: ${activePalette.fontColor}; }
        
        @media (max-width: 768px) {
          .chat-window { right: 10px; bottom: 85px; width: calc(100vw - 20px); height: 65vh; }
        }
      `}</style>

      <div className="chat-window">
        <div className="chat-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><Bot size={18} color="#fff"/> Consciência Auxiliar</div>
          <button onClick={onClose} style={{background:'rgba(0,0,0,0.2)', border:'none', color:'inherit', cursor:'pointer', padding: '5px', borderRadius: '50%', display: 'flex', transition: 'background 0.2s'}}><X size={16}/></button>
        </div>
        
        <div className="chat-body">
          {chatMessages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bubble-user' : 'bubble-bot'}`}>{msg.text}</div>
          ))}
          {isChatLoading && (
            <div className="chat-bubble bubble-bot processing-active" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={16} className="animate-spin text-blue-400" /> Processando...
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <form onSubmit={handleSendChatMessage} className="chat-footer">
          <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Digite sua pergunta..." className="chat-input" disabled={isChatLoading} />
          <button type="submit" className="chat-send" disabled={isChatLoading}><Send size={18} /></button>
        </form>
      </div>
    </>
  );
};

export default ChatWidget;