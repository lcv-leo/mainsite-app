// Módulo: mainsite-frontend/src/components/DisclaimerModal.jsx
// Versão: v1.0.0
// Descrição: Componente isolado para o aviso de leitura com estética Glassmorphism.

import React from 'react';
import { AlertTriangle } from 'lucide-react';

const DisclaimerModal = ({ show, onClose, activePalette }) => {
  if (!show || !activePalette) return null;

  // Cálculo de contraste isolado (Safeguard)
  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, animation: 'fadeIn 0.4s ease-out' }}>
      
      {/* Fundo escurecido suave */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }} onClick={onClose}></div>
      
      {/* Cartão Vídrico */}
      <div style={{ position: 'relative', width: '90%', maxWidth: '450px', background: isDarkBase ? 'rgba(20, 20, 20, 0.65)' : 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.15)`, borderRadius: '16px', padding: '40px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', color: activePalette.fontColor, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: activePalette.titleColor, opacity: 0.8 }}>
          <AlertTriangle size={40} />
        </div>
        <h3 style={{ margin: 0, fontSize: '18px', color: activePalette.titleColor, textTransform: 'uppercase', letterSpacing: '1px' }}>Aviso ao Leitor</h3>
        <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.8', opacity: 0.85 }}>
          Este texto não busca convencer nem detém a verdade. São apenas abstrações de uma mente em constante autorreflexão. Por ser ensaio pessoal, abdica-se do rigor acadêmico e de referências formais, priorizando-se a livre expressão.
        </p>
        <button onClick={onClose} style={{ marginTop: '10px', padding: '15px 30px', background: activePalette.titleColor, color: activePalette.bgColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px', transition: 'transform 0.2s', textTransform: 'uppercase' }}>
          Concordo
        </button>
      </div>
    </div>
  );
};

export default DisclaimerModal;