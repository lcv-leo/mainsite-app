// Módulo: mainsite-frontend/src/components/ChatWidget.jsx
// Versão: v1.0.0
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
          <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}><Bot size={18} color="#fff"/> Assistente Virtual</div>
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