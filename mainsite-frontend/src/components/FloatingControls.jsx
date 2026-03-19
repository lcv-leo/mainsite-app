// Módulo: mainsite-frontend/src/components/FloatingControls.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para utilizar o motor de estilos central (Glassmorphism/MD3) do App.jsx.

import React from 'react';
import { ArrowUp, Monitor, Sun, Moon, Bot, X } from 'lucide-react';

const FloatingControls = ({ 
  showBackToTop, 
  scrollToTop, 
  userTheme, 
  cycleTheme, 
  isChatOpen, 
  setIsChatOpen, 
  styles,
  activePalette 
}) => {
  
  if (!activePalette || !styles) return null;

  const fabBaseStyle = {
    backgroundColor: styles.glassBg,
    border: `1px solid ${styles.glassBorder}`,
    color: activePalette.fontColor,
    width: '55px',
    height: '55px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    transition: 'all 0.2s ease-in-out',
    boxShadow: '0 8px 20px rgba(0,0,0,0.1)',
  };

  const chatFabStyle = {
    ...fabBaseStyle,
    background: activePalette.titleColor,
    color: activePalette.bgColor, // Cor de fundo do tema para contraste
    borderColor: 'transparent',
    boxShadow: `0 8px 25px ${activePalette.titleColor}60` // Sombra com a cor do título
  };

  return (
    <div style={{ position: 'fixed', right: '30px', bottom: '30px', display: 'flex', flexDirection: 'column', gap: '15px', zIndex: 2000 }}>
      {showBackToTop && (
        <button onClick={scrollToTop} style={fabBaseStyle} title="Voltar ao Topo">
          <ArrowUp size={20} />
        </button>
      )}
      
      <button onClick={cycleTheme} style={fabBaseStyle} title={`Modo do Tema: ${userTheme.toUpperCase()}`}>
        {userTheme === 'auto' ? <Monitor size={20} /> : userTheme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
      </button>

      <button 
        onClick={() => setIsChatOpen(!isChatOpen)} 
        style={chatFabStyle} 
        title="Busca Semântica / Conversar"
      >
        {isChatOpen ? <X size={24} /> : <Bot size={24} />}
      </button>
    </div>
  );
};

export default FloatingControls;