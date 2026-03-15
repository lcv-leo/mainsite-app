// Módulo: mainsite-frontend/src/components/ContactModal.jsx
// Versão: v1.0.0
// Descrição: Modal de contato com estética Glassmorphism e limite de caracteres.

import React, { useState } from 'react';
import { Send, User, Phone, Mail, MessageSquare, Loader2, X } from 'lucide-react';

const ContactModal = ({ show, onClose, onSubmit, activePalette, isSubmitting }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });

  if (!show || !activePalette) return null;

  const isDarkBase = activePalette.bgColor && (activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1'));
  const charsLeft = 500 - formData.message.length;

  // Motor de Máscara em Tempo Real para padrão (NN) N NNNN-NNNN
  const formatPhone = (val) => {
    let v = val.replace(/\D/g, '').substring(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData, () => setFormData({ name: '', phone: '', email: '', message: '' }));
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box', padding: '12px 12px 12px 35px', borderRadius: '6px', 
    border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'},0.2)`, 
    background: isDarkBase ? 'rgba(0,0,0,0.5)' : '#f9f9f9', 
    color: activePalette.fontColor, outline: 'none', fontSize: '13px', fontFamily: 'inherit'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 12000 }}>
      
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(5px)', animation: 'fadeIn 0.3s' }} onClick={onClose}></div>
      
      <div style={{ position: 'relative', width: '90%', maxWidth: '450px', background: isDarkBase ? 'rgba(20, 20, 20, 0.75)' : 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: `1px solid rgba(${isDarkBase ? '255,255,255' : '0,0,0'}, 0.2)`, borderRadius: '16px', padding: '30px', boxShadow: '0 25px 50px rgba(0,0,0,0.3)', color: activePalette.fontColor, animation: 'fadeIn 0.4s ease-out' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }}><X size={20}/></button>

        <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: activePalette.titleColor, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={20} /> Fale com o Autor
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ position: 'relative' }}>
            <User size={16} style={{ position: 'absolute', top: '13px', left: '12px', opacity: 0.5 }} />
            <input type="text" required placeholder="Seu Nome" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Phone size={16} style={{ position: 'absolute', top: '13px', left: '12px', opacity: 0.5 }} />
              <input type="tel" placeholder="Telefone (Opcional)" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Phone size={16} style={{ position: 'absolute', top: '13px', left: '12px', opacity: 0.5 }} />
              <input 
                type="tel" 
                placeholder="Telefone (Opcional)" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})} 
                maxLength={16}
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <textarea required maxLength={500} placeholder="Escreva sua mensagem aqui..." value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} style={{ ...inputStyle, padding: '15px', minHeight: '120px', resize: 'none' }} />
            <div style={{ position: 'absolute', bottom: '10px', right: '15px', fontSize: '10px', fontWeight: 'bold', color: charsLeft < 50 ? '#ef4444' : activePalette.fontColor, opacity: 0.6 }}>
              {charsLeft} caracteres restantes
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} style={{ marginTop: '10px', padding: '15px', background: activePalette.titleColor, color: activePalette.bgColor, border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', letterSpacing: '2px', transition: 'transform 0.2s', textTransform: 'uppercase', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} 
            {isSubmitting ? 'ENVIANDO...' : 'ENVIAR MENSAGEM'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactModal;