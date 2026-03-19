// Módulo: mainsite-frontend/src/components/DisclaimerModal.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para utilizar o motor de estilos central (Glassmorphism/MD3), alinhando o visual do modal com o restante da aplicação.

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Heart } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette, config, onDonationTrigger, styles }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (show) setCurrentIndex(0);
  }, [show]);

  if (!show || !styles || !activePalette || !config || !config.enabled || !config.items || config.items.length === 0) {
    if (show) onClose(); 
    return null;
  }

  const currentDisclaimer = config.items[currentIndex];
  const isDonationMode = currentDisclaimer.isDonationTrigger;

  const handleAgree = () => {
    if (dontShowAgain) {
      localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
    }
    
    if (isDonationMode && onDonationTrigger) {
       onDonationTrigger();
    }

    if (currentIndex < config.items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setDontShowAgain(false);
    } else {
      onClose();
    }
  };

  const handleSkip = () => {
    if(dontShowAgain) localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
    if (currentIndex < config.items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setDontShowAgain(false);
    } else onClose();
  };

  // Estilos específicos do componente que utilizam o tema
  const modalButton = {
    padding: '15px 30px',
    background: isDonationMode ? '#ec4899' : activePalette.titleColor,
    color: isDonationMode ? '#fff' : (styles.plusButton ? styles.plusButton.color : activePalette.bgColor),
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontWeight: 'bold',
    letterSpacing: '2px',
    transition: 'transform 0.2s, box-shadow 0.2s',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: `0 6px 20px ${isDonationMode ? 'rgba(236, 72, 153, 0.4)' : 'rgba(128,128,128,0.2)'}`
  };

  const modalTitle = {
    margin: 0,
    fontSize: '18px',
    color: activePalette.titleColor,
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 11000 }} key={currentIndex}>
      <div style={{ ...styles.modalContent, animation: 'fadeIn 0.4s ease-out', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {config.items.length > 1 && (
          <div style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '10px', fontWeight: 'bold', opacity: 0.5, letterSpacing: '1px' }}>
            {currentIndex + 1} / {config.items.length}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', color: isDonationMode ? '#ec4899' : activePalette.titleColor, opacity: 0.8 }}>
          {isDonationMode ? <Heart size={40} /> : <AlertTriangle size={40} />}
        </div>
        <h3 style={modalTitle}>
          {currentDisclaimer.title || 'Aviso'}
        </h3>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', opacity: 0.85, whiteSpace: 'pre-wrap' }}>
          {currentDisclaimer.text}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', opacity: 0.8, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={dontShowAgain} 
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: activePalette.titleColor }}
            />
            Não exibir este aviso novamente
          </label>

          <button onClick={handleAgree} style={modalButton}>
            {isDonationMode ? <Heart size={16} fill="#fff" /> : null}
            {currentDisclaimer.buttonText || (isDonationMode ? 'Apoiar Projeto' : 'Concordo')}
          </button>
          
          {isDonationMode && (
             <button onClick={handleSkip} style={{ background: 'transparent', border: 'none', color: activePalette.fontColor, fontSize: '12px', opacity: 0.6, cursor: 'pointer', textDecoration: 'underline' }}>
                Pular e ler os textos
             </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default DisclaimerModal;