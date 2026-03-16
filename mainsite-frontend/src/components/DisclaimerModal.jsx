// Módulo: mainsite-frontend/src/components/DisclaimerModal.jsx
// Versão: v1.1.0
// Descrição: Modal de isenção de responsabilidade com sistema de opt-out via localStorage.

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette, config }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Efeito de transição suave
  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [show]);

  if (!isVisible && !show) return null;

  // Garante que não quebre se o banco ainda não enviou a config
  const safeConfig = config || { enabled: false, items: [] };
  if (!safeConfig.enabled || !safeConfig.items || safeConfig.items.length === 0) return null;

  const disclaimerData = safeConfig.items[0]; // Pega o primeiro aviso ativo

  const handleAccept = () => {
    if (dontShowAgain) {
      // Grava o opt-out permanentemente no navegador do usuário
      localStorage.setItem('hide_df_disclaimer', 'true');
    }
    onClose();
  };

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const overlayStyle = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDarkBase ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    opacity: show ? 1 : 0,
    transition: 'opacity 0.3s ease',
    padding: '20px'
  };

  const modalStyle = {
    backgroundColor: activePalette.bgColor,
    border: `2px solid ${activePalette.fontColor}`,
    color: activePalette.fontColor,
    padding: '40px',
    maxWidth: '500px',
    width: '100%',
    boxShadow: isDarkBase ? '15px 15px 0px rgba(255,255,255,0.1)' : '15px 15px 0px rgba(0,0,0,0.1)',
    transform: show ? 'translateY(0)' : 'translateY(20px)',
    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '20px'
  };

  const buttonStyle = {
    backgroundColor: activePalette.fontColor,
    color: activePalette.bgColor,
    border: 'none',
    padding: '12px 30px',
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    cursor: 'pointer',
    marginTop: '10px',
    width: '100%',
    transition: 'opacity 0.2s'
  };

  const checkboxContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '15px',
    cursor: 'pointer',
    fontSize: '13px',
    opacity: 0.8
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <AlertCircle size={40} style={{ opacity: 0.8 }} />
        
        <h2 style={{ margin: 0, fontSize: '18px', textTransform: 'uppercase', letterSpacing: '1px' }}>
          {disclaimerData.title || "Aviso"}
        </h2>
        
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', opacity: 0.9 }}>
          {disclaimerData.text}
        </p>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <label style={checkboxContainerStyle}>
            <input 
              type="checkbox" 
              checked={dontShowAgain} 
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            Não exibir este aviso novamente
          </label>

          <button 
            onClick={handleAccept} 
            style={buttonStyle}
            onMouseOver={(e) => e.target.style.opacity = 0.8}
            onMouseOut={(e) => e.target.style.opacity = 1}
          >
            {disclaimerData.buttonText || "Concordo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;