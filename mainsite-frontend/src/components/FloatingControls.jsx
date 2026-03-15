// Módulo: mainsite-frontend/src/components/FloatingControls.jsx
// Versão: v1.0.0
// Descrição: Componente isolado para gestão do botão de voltar ao topo, troca de temas e acionamento do Chat.

import React from 'react';
import { ArrowUp, Monitor, Sun, Moon, Bot, X } from 'lucide-react';

const FloatingControls = ({ 
  showBackToTop, 
  scrollToTop, 
  userTheme, 
  cycleTheme, 
  isChatOpen, 
  setIsChatOpen, 
  activePalette 
}) => {
  
  if (!activePalette) return null;

  return (
    <>
      <style>{`
        .floating-controls { position: fixed; right: 30px; bottom: 30px; display: flex; flex-direction: column; gap: 15px; z-index: 9999; }
        .fab-btn { background-color: ${activePalette.bgColor}; border: 1px solid rgba(128,128,128,0.3); color: ${activePalette.fontColor}; width: 55px; height: 55px; border-radius: 50%; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(8px); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
        .fab-btn:hover { transform: scale(1.1); border-color: ${activePalette.fontColor}; }
        
        .fab-btn.chat-trigger { background: linear-gradient(135deg, #0044cc, #3399ff); border: none; box-shadow: 0 6px 20px rgba(51, 153, 255, 0.4); color: #fff;}
        .fab-btn.chat-trigger:hover { transform: scale(1.15) rotate(5deg); box-shadow: 0 8px 25px rgba(51, 153, 255, 0.6); }
        .fab-btn.chat-active { background: ${activePalette.bgColor}; color: #4da6ff; border: 1px solid #4da6ff; }
        
        @media (max-width: 768px) {
          .floating-controls { right: 15px; bottom: 15px; }
        }
      `}</style>

      <div className="floating-controls">
        {showBackToTop && (
          <button onClick={scrollToTop} className="fab-btn" title="Voltar ao Topo">
            <ArrowUp size={20} />
          </button>
        )}
        
        <button onClick={cycleTheme} className="fab-btn" title={`Modo do Tema: ${userTheme.toUpperCase()}`}>
          {userTheme === 'auto' ? <Monitor size={20} /> : userTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
        </button>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className={`fab-btn chat-trigger ${isChatOpen ? 'chat-active' : ''}`} title="Busca Semântica / Conversar">
          {isChatOpen ? <X size={24} /> : <Bot size={24} />}
        </button>
      </div>
    </>
  );
};

export default FloatingControls;