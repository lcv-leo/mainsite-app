// Módulo: mainsite-frontend/src/components/DisclaimerModal.jsx
// Versão: v1.2.0
// Descrição: Restauração da identidade visual (Glassmorphism e Elegância) integrada ao motor de Opt-Out (localStorage) do frontend público.

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette, config }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 400); // Sincronizado com a transição CSS
    }
  }, [show]);

  if (!isVisible && !show) return null;

  const safeConfig = config || { enabled: false, items: [] };
  if (!safeConfig.enabled || !safeConfig.items || safeConfig.items.length === 0) return null;

  const disclaimerData = safeConfig.items[0];

  const handleAccept = () => {
    if (dontShowAgain) {
      localStorage.setItem('hide_df_disclaimer', 'true');
    }
    onClose();
  };

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  // Estética Glassmorphism e Sombras Suaves (Frontend Público)
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
    opacity: show ? 1 : 0,
    transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    padding: '20px'
  };

  const modalStyle = {
    backgroundColor: activePalette.bgColor,
    color: activePalette.fontColor,
    padding: '40px 35px',
    maxWidth: '520px',
    width: '100%',
    borderRadius: '16px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(15px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '24px'
  };

  const buttonStyle = {
    backgroundColor: activePalette.fontColor,
    color: activePalette.bgColor,
    border: 'none',
    padding: '14px 35px',
    fontSize: '15px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    marginTop: '10px',
    width: '100%',
    transition: 'transform 0.2s ease, opacity 0.2s ease',
    boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.1)'
  };

  const checkboxContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '5px',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: 0.85,
    transition: 'opacity 0.2s ease'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ padding: '15px', borderRadius: '50%', backgroundColor: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}>
          <AlertCircle size={36} strokeWidth={1.5} style={{ opacity: 0.9 }} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', letterSpacing: '-0.02em' }}>
            {disclaimerData.title || "Aviso"}
          </h2>
          
          <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.6', opacity: 0.8 }}>
            {disclaimerData.text}
          </p>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
          <label 
            style={checkboxContainerStyle}
            onMouseOver={(e) => e.currentTarget.style.opacity = 1}
            onMouseOut={(e) => e.currentTarget.style.opacity = 0.85}
          >
            <input 
              type="checkbox" 
              checked={dontShowAgain} 
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer', width: '18px', height: '18px', accentColor: activePalette.fontColor }}
            />
            Não exibir este aviso novamente
          </label>

          <button 
            onClick={handleAccept} 
            style={buttonStyle}
            onMouseOver={(e) => e.target.style.transform = 'translateY(-1px)'}
            onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
            onMouseDown={(e) => e.target.style.transform = 'translateY(1px)'}
          >
            {disclaimerData.buttonText || "Concordo"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DisclaimerModal;