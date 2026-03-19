// Módulo: mainsite-frontend/src/components/DisclaimerModal.jsx
// Versão: v1.4.0
// Descrição: Opt-Out independente + Gatilho de Doação em MD3 e Glassmorphism.

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Heart } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette, config, onDonationTrigger }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (show) setTimeout(() => setCurrentIndex(0), 0);
  }, [show]);

  if (!show || !activePalette || !config || !config.enabled || !config.items || config.items.length === 0) {
    if (show) onClose();
    return null;
  }

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));
  const currentDisclaimer = config.items[currentIndex];

  const handleAgree = () => {
    if (dontShowAgain) {
      localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
    }

    if (currentDisclaimer.isDonationTrigger && onDonationTrigger) {
      onDonationTrigger();
    }

    if (currentIndex < config.items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setDontShowAgain(false);
    } else {
      onClose();
    }
  };

  const isDonationMode = currentDisclaimer.isDonationTrigger;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }}>

      <div key={`bg-${currentIndex}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: isDarkBase ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.5)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', animation: 'fadeIn 0.3s ease-out' }}></div>

      <div key={`card-${currentIndex}`} style={{ position: 'relative', width: '90%', maxWidth: '480px', background: isDarkBase ? 'rgba(30, 30, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.15)`, borderRadius: '28px', padding: '40px', boxShadow: '0 32px 64px -12px rgba(0,0,0,0.4)', color: activePalette.fontColor, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease-out' }}>

        {config.items.length > 1 && (
          <div style={{ position: 'absolute', top: '20px', right: '24px', fontSize: '12px', fontWeight: '800', opacity: 0.5, letterSpacing: '1px' }}>
            {currentIndex + 1} / {config.items.length}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', color: isDonationMode ? '#ec4899' : activePalette.titleColor, opacity: 0.9 }}>
          {isDonationMode ? <Heart size={48} /> : <AlertTriangle size={48} />}
        </div>
        <h3 style={{ margin: 0, fontSize: '22px', color: activePalette.titleColor, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '800' }}>
          {currentDisclaimer.title || 'Aviso'}
        </h3>
        <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.8', opacity: 0.85, whiteSpace: 'pre-wrap', fontWeight: '500' }}>
          {currentDisclaimer.text}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontSize: '13px', opacity: 0.8, cursor: 'pointer', fontWeight: '700' }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{ cursor: 'pointer', width: '18px', height: '18px' }}
            />
            Não exibir {config.items.length > 1 ? 'este aviso' : 'este aviso'} novamente
          </label>

          <button onClick={handleAgree} style={{ padding: '16px 32px', background: isDonationMode ? '#ec4899' : activePalette.titleColor, color: isDonationMode ? '#fff' : activePalette.bgColor, border: 'none', borderRadius: '100px', cursor: 'pointer', fontWeight: '800', letterSpacing: '2px', transition: 'all 0.2s', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: `0 8px 24px ${isDonationMode ? 'rgba(236, 72, 153, 0.4)' : activePalette.titleColor + '40'}` }} onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
            {isDonationMode ? <Heart size={18} fill="#fff" /> : null}
            {currentDisclaimer.buttonText || (isDonationMode ? 'Apoiar Projeto' : 'Concordo')}
          </button>

          {isDonationMode && (
            <button onClick={() => {
              if (dontShowAgain) localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
              if (currentIndex < config.items.length - 1) {
                setCurrentIndex(prev => prev + 1);
                setDontShowAgain(false);
              } else onClose();
            }} style={{ background: 'transparent', border: 'none', color: activePalette.fontColor, fontSize: '13px', opacity: 0.6, cursor: 'pointer', textDecoration: 'underline', fontWeight: '700', marginTop: '8px' }}>
              Pular agora e ler os textos
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default DisclaimerModal;