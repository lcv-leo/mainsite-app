// Módulo: mainsite-frontend/src/components/FloatingControls.tsx
// Versão: v1.2.0
// Descrição: Componente MD3 para o Botão de Voltar ao Topo, Troca de Tema e Chat.

import { ArrowUp, ArrowDown, Monitor, Sun, Moon, Bot, X } from 'lucide-react';
import type { ActivePalette } from '../types';

interface FloatingControlsProps {
  showBackToTop: boolean
  showScrollToBottom: boolean
  scrollToTop: () => void
  scrollToBottom: () => void
  userTheme: 'auto' | 'dark' | 'light'
  cycleTheme: () => void
  isChatOpen: boolean
  setIsChatOpen: (open: boolean) => void
  activePalette: ActivePalette | null
}

const FloatingControls = ({
  showBackToTop,
  showScrollToBottom,
  scrollToTop,
  scrollToBottom,
  userTheme,
  cycleTheme,
  isChatOpen,
  setIsChatOpen,
  activePalette
}: FloatingControlsProps) => {

  if (!activePalette) return null;

  return (
    <>
      <style>{`
        .floating-controls { position: fixed; right: 30px; bottom: 30px; display: flex; flex-direction: column; align-items: flex-end; gap: 16px; z-index: 9999; }
        .fab-btn { background-color: ${activePalette.bgColor}; border: 1px solid rgba(128,128,128,0.2); color: ${activePalette.fontColor}; width: 60px; height: 60px; border-radius: 100px; display: flex; justify-content: center; align-items: center; cursor: pointer; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 12px 28px rgba(0,0,0,0.15); }
        .fab-btn:hover { transform: translateY(-4px); border-color: ${activePalette.fontColor}; box-shadow: 0 16px 32px rgba(0,0,0,0.25); }
        
        .fab-btn.chat-trigger { background: linear-gradient(135deg, #0044cc, #3399ff); border: none; box-shadow: 0 12px 32px rgba(51, 153, 255, 0.4); color: #fff;}
        .fab-btn.chat-trigger:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(51, 153, 255, 0.6); }
        .fab-btn.chat-active { background: ${activePalette.bgColor}; color: ${activePalette.titleColor}; border: 1px solid ${activePalette.titleColor}; }

        .fab-bottom-cluster { display: flex; flex-direction: column; align-items: center; gap: 16px; transition: gap 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .fab-bottom-cluster.chat-open { flex-direction: row; align-items: center; }
        .fab-bottom-cluster.chat-open .fab-btn:not(.chat-trigger):hover { transform: translateX(-4px); }
        .fab-bottom-cluster.chat-open .fab-btn.chat-trigger:hover { transform: translateX(0) translateY(-4px); }
        
        @media (max-width: 768px) {
          .floating-controls { right: 20px; bottom: 20px; }
          .fab-btn { width: 54px; height: 54px; }
        }
      `}</style>

      <div className="floating-controls" role="toolbar" aria-label="Controles do leitor">
        <div className={`fab-bottom-cluster${isChatOpen ? ' chat-open' : ''}`}>
          {showBackToTop && (
            <button onClick={scrollToTop} className="fab-btn" title="Voltar ao Topo" aria-label="Voltar ao topo">
              <ArrowUp size={24} />
            </button>
          )}

          {showScrollToBottom && (
            <button onClick={scrollToBottom} className="fab-btn" title="Ir para o Final" aria-label="Ir para o final">
              <ArrowDown size={24} />
            </button>
          )}

          <button onClick={cycleTheme} className="fab-btn" title={`Modo do Tema: ${userTheme.toUpperCase()}`} aria-label={`Alternar tema: modo ${userTheme} ativo`}>
            {userTheme === 'auto' ? <Monitor size={24} /> : userTheme === 'dark' ? <Moon size={24} /> : <Sun size={24} />}
          </button>

          <button onClick={() => setIsChatOpen(!isChatOpen)} className={`fab-btn chat-trigger ${isChatOpen ? 'chat-active' : ''}`} title="Busca Semântica / Conversar" aria-label={isChatOpen ? 'Fechar busca semântica' : 'Abrir busca semântica'}>
            {isChatOpen ? <X size={28} /> : <Bot size={28} />}
          </button>
        </div>
      </div>
    </>
  );
};

export default FloatingControls;
