// Módulo: mainsite-frontend/src/components/DisclaimerModal.jsx
// Versão: v1.3.0
// Descrição: Alteração profunda no motor de Opt-Out (agora independente por ID do aviso, em vez de global) e injeção do suporte à flag 'isDonationTrigger' para atuar como Call to Action de doações.

import React, { useState, useEffect } from 'react';
import { AlertTriangle, Heart } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette, config, onDonationTrigger }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (show) setCurrentIndex(0);
  }, [show]);

  if (!show || !activePalette || !config || !config.enabled || !config.items || config.items.length === 0) {
    if (show) onClose(); 
    return null;
  }

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));
  const currentDisclaimer = config.items[currentIndex];

  const handleAgree = () => {
    // Novo Sistema: Salva Opt-Out INDIVIDUALMENTE por ID do aviso (mesmo no meio da fila)
    if (dontShowAgain) {
      localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
    }
    
    // Gatilho de Doação: se configurado, aciona a abertura do DonationModal via propriedade do App.jsx
    if (currentDisclaimer.isDonationTrigger && onDonationTrigger) {
       onDonationTrigger();
    }

    if (currentIndex < config.items.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setDontShowAgain(false); // Reseta a checkbox para o próximo aviso
    } else {
      onClose();
    }
  };

  const isDonationMode = currentDisclaimer.isDonationTrigger;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }}>
      
      <div key={`bg-${currentIndex}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', animation: 'fadeIn 0.3s ease-out' }}></div>
      
      <div key={`card-${currentIndex}`} style={{ position: 'relative', width: '90%', maxWidth: '450px', background: isDarkBase ? 'rgba(20, 20, 20, 0.65)' : 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.15)`, borderRadius: '16px', padding: '40px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', color: activePalette.fontColor, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.4s ease-out' }}>
        
        {config.items.length > 1 && (
          <div style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '10px', fontWeight: 'bold', opacity: 0.5, letterSpacing: '1px' }}>
            {currentIndex + 1} / {config.items.length}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', color: isDonationMode ? '#ec4899' : activePalette.titleColor, opacity: 0.8 }}>
          {isDonationMode ? <Heart size={40} /> : <AlertTriangle size={40} />}
        </div>
        <h3 style={{ margin: 0, fontSize: '18px', color: activePalette.titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
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
              style={{ cursor: 'pointer' }}
            />
            Não exibir {config.items.length > 1 ? 'este aviso' : 'este aviso'} novamente
          </label>

          <button onClick={handleAgree} style={{ padding: '15px 30px', background: isDonationMode ? '#ec4899' : activePalette.titleColor, color: isDonationMode ? '#fff' : activePalette.bgColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px', transition: 'transform 0.2s', textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {isDonationMode ? <Heart size={16} fill="#fff" /> : null}
            {currentDisclaimer.buttonText || (isDonationMode ? 'Apoiar Projeto' : 'Concordo')}
          </button>
          
          {/* Se for doação, adiciona o botão de pular elegantemente */}
          {isDonationMode && (
             <button onClick={() => {
                if(dontShowAgain) localStorage.setItem(`hide_disclaimer_${currentDisclaimer.id}`, 'true');
                if (currentIndex < config.items.length - 1) {
                  setCurrentIndex(prev => prev + 1);
                  setDontShowAgain(false);
                } else onClose();
             }} style={{ background: 'transparent', border: 'none', color: activePalette.fontColor, fontSize: '12px', opacity: 0.6, cursor: 'pointer', textDecoration: 'underline' }}>
                Pular agora e ler os textos
             </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default DisclaimerModal;