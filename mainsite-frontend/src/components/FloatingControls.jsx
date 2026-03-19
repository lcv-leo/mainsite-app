// Módulo: mainsite-frontend/src/components/FloatingControls.jsx
// Versão: v1.1.0
// Descrição: Componente MD3 para o Botão de Voltar ao Topo, Troca de Tema e Chat.

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
        .floating-controls { position: fixed; right: 30px; bottom: 30px; display: flex; flex-direction: column; gap: 16px; z-index: 9999; }
        .fab-btn { background-color: ${activePalette.bgColor}; border: 1px solid rgba(128,128,128,0.2); color: ${activePalette.fontColor}; width: 60px; height: 60px; border-radius: 100px; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 12px 28px rgba(0,0,0,0.15); }
        .fab-btn:hover { transform: scale(1.1) translateY(-4px); border-color: ${activePalette.fontColor}; box-shadow: 0 16px 32px rgba(0,0,0,0.25); }
        
        .fab-btn.chat-trigger { background: linear-gradient(135deg, #0044cc, #3399ff); border: none; box-shadow: 0 12px 32px rgba(51, 153, 255, 0.4); color: #fff;}
        .fab-btn.chat-trigger:hover { transform: scale(1.15) rotate(5deg) translateY(-4px); box-shadow: 0 16px 40px rgba(51, 153, 255, 0.6); }
        .fab-btn.chat-active { background: ${activePalette.bgColor}; color: #4da6ff; border: 1px solid #4da6ff; }
        
        @media (max-width: 768px) {
          .floating-controls { right: 20px; bottom: 20px; }
          .fab-btn { width: 54px; height: 54px; }
        }
      `}</style>

      <div className="floating-controls">
        {showBackToTop && (
          <button onClick={scrollToTop} className="fab-btn" title="Voltar ao Topo">
            <ArrowUp size={24} />
          </button>
        )}

        <button onClick={cycleTheme} className="fab-btn" title={`Modo do Tema: ${userTheme.toUpperCase()}`}>
          {userTheme === 'auto' ? <Monitor size={24} /> : userTheme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
        </button>

        <button onClick={() => setIsChatOpen(!isChatOpen)} className={`fab-btn chat-trigger ${isChatOpen ? 'chat-active' : ''}`} title="Busca Semântica / Conversar">
          {isChatOpen ? <X size={28} /> : <Bot size={28} />}
        </button>
      </div>
    </>
  );
};

export default FloatingControls;