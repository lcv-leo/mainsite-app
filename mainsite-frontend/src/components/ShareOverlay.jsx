// Módulo: mainsite-frontend/src/components/ShareOverlay.jsx
// Versão: v1.2.0
// Descrição: Modal de compartilhamento por e-mail padronizado sob métricas estritas de Glassmorphism.

import React, { useState, useEffect } from 'react';
import { X, Send, Mail } from 'lucide-react';

const ShareOverlay = ({ modalState, setModalState, onSubmit, activePalette }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (modalState.show) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 400);
    }
  }, [modalState.show]);

  if (!isVisible && !modalState.show) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  // Métrica Glassmorphism: Fundo da tela
  const overlayStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDarkBase ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    opacity: modalState.show ? 1 : 0,
    transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    padding: '20px'
  };

  // Métrica Glassmorphism: Container do Modal
  const modalStyle = {
    backgroundColor: activePalette.bgColor,
    color: activePalette.fontColor,
    padding: '35px',
    maxWidth: '450px',
    width: '100%',
    borderRadius: '16px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    transform: modalState.show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(15px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    marginBottom: '20px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '8px',
    color: activePalette.fontColor,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
    textAlign: 'center'
  };

  const buttonStyle = {
    backgroundColor: activePalette.titleColor,
    color: isDarkBase ? '#000' : '#fff',
    border: 'none',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    transition: 'transform 0.2s ease, opacity 0.2s ease',
    boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.1)'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button 
          onClick={() => setModalState({ show: false, email: '' })} 
          style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }}
          onMouseOver={(e) => e.currentTarget.style.opacity = 1}
          onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}
        >
          <X size={20} />
        </button>

        <div style={{ padding: '15px', borderRadius: '50%', backgroundColor: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginBottom: '15px' }}>
          <Mail size={32} strokeWidth={1.5} style={{ opacity: 0.9 }} />
        </div>

        <h2 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '600', color: activePalette.titleColor, letterSpacing: '-0.02em' }}>
          Compartilhar Leitura
        </h2>
        <p style={{ margin: '0 0 25px 0', fontSize: '14px', opacity: 0.8, lineHeight: '1.5' }}>
          Insira o e-mail do destinatário para enviar o link deste fragmento.
        </p>

        <form onSubmit={onSubmit} style={{ width: '100%' }}>
          <input 
            type="email" 
            placeholder="destinatario@exemplo.com" 
            value={modalState.email} 
            onChange={(e) => setModalState({ ...modalState, email: e.target.value })} 
            style={inputStyle} 
            required 
            autoFocus
          />

          <button 
            type="submit" 
            style={buttonStyle}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            onMouseDown={(e) => e.currentTarget.style.transform = 'translateY(1px)'}
          >
            <Send size={18} />
            ENVIAR E-MAIL
          </button>
        </form>
      </div>
    </div>
  );
};

export default ShareOverlay;