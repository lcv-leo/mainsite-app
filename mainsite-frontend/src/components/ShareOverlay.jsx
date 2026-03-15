// Módulo: mainsite-frontend/src/components/ShareOverlay.jsx
// Versão: v1.0.0
// Descrição: Componente isolado para o modal responsivo de envio de E-mail.

import React from 'react';
import { Mail, Send } from 'lucide-react';

const ShareOverlay = ({ modalState, setModalState, onSubmit, activePalette }) => {
  if (!modalState.show || !activePalette) return null;

  // Cálculo de contraste isolado (Safeguard)
  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000, backdropFilter: 'blur(5px)', animation: 'fadeIn 0.3s' }}>
      <form onSubmit={onSubmit} style={{ background: activePalette.bgColor, padding: '40px', borderRadius: '12px', border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, width: '90%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: activePalette.titleColor, fontWeight: 'bold', fontSize: '18px' }}>
          <Mail size={24}/> Enviar Leitura
        </div>
        <p style={{ fontSize: '13px', color: activePalette.fontColor, opacity: 0.8, margin: 0 }}>
          Digite o e-mail do destinatário que receberá o link para este texto.
        </p>
        <input 
          type="email" required autoFocus placeholder="exemplo@email.com" 
          value={modalState.email} 
          onChange={e => setModalState({...modalState, email: e.target.value})} 
          style={{ width: '100%', boxSizing: 'border-box', padding: '15px', borderRadius: '6px', border: `2px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, background: isDarkBase ? 'rgba(0,0,0,0.5)' : '#f9f9f9', color: activePalette.fontColor, outline: 'none', fontSize: '14px' }} 
        />
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
          <button type="button" onClick={() => setModalState({show: false, email: ''})} style={{ padding: '12px 20px', border: 'none', background: 'transparent', color: activePalette.fontColor, cursor: 'pointer', fontWeight: 'bold' }}>
            CANCELAR
          </button>
          <button type="submit" style={{ padding: '12px 25px', border: 'none', background: '#0ea5e9', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Send size={16}/> ENVIAR
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShareOverlay;