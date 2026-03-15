// ==========================================
// PATCH 5: mainsite-frontend/src/components/DisclaimerModal.jsx
// ==========================================

import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette, config }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reinicia o índice sempre que o modal for aberto para um novo post
  useEffect(() => {
    if (show) setCurrentIndex(0);
  }, [show]);

  // Se estiver desativado, se não houver itens, ou se não deve mostrar, aborta silenciosamente.
  if (!show || !activePalette || !config || !config.enabled || !config.items || config.items.length === 0) {
    if (show) onClose(); // Força o fechamento se não houver nada a exibir
    return null;
  }

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));
  const currentDisclaimer = config.items[currentIndex];

  const handleAgree = () => {
    if (currentIndex < config.items.length - 1) {
      // Se há mais um aviso na fila, avança.
      setCurrentIndex(prev => prev + 1);
    } else {
      // Se era o último, fecha o modal e libera a leitura.
      onClose();
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }}>
      
      {/* Fundo escurecido suave (Animação reinicia a cada troca de índice para dar feedback visual) */}
      <div key={`bg-${currentIndex}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', animation: 'fadeIn 0.3s ease-out' }}></div>
      
      {/* Cartão Vídrico Sequencial */}
      <div key={`card-${currentIndex}`} style={{ position: 'relative', width: '90%', maxWidth: '450px', background: isDarkBase ? 'rgba(20, 20, 20, 0.65)' : 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.15)`, borderRadius: '16px', padding: '40px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', color: activePalette.fontColor, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.4s ease-out' }}>
        
        {/* Indicador de Paginação (se houver mais de um) */}
        {config.items.length > 1 && (
          <div style={{ position: 'absolute', top: '15px', right: '20px', fontSize: '10px', fontWeight: 'bold', opacity: 0.5, letterSpacing: '1px' }}>
            {currentIndex + 1} / {config.items.length}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', color: activePalette.titleColor, opacity: 0.8 }}>
          <AlertTriangle size={40} />
        </div>
        <h3 style={{ margin: 0, fontSize: '18px', color: activePalette.titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
          {currentDisclaimer.title || 'Aviso'}
        </h3>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', opacity: 0.85, whiteSpace: 'pre-wrap' }}>
          {currentDisclaimer.text}
        </p>
        <button onClick={handleAgree} style={{ marginTop: '10px', padding: '15px 30px', background: activePalette.titleColor, color: activePalette.bgColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px', transition: 'transform 0.2s', textTransform: 'uppercase' }}>
          {currentDisclaimer.buttonText || 'Concordo'}
        </button>
      </div>
    </div>
  );
};

export default DisclaimerModal;
// ==========================================