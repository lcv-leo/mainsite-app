// Módulo: mainsite-frontend/src/components/ContactModal.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para utilizar o motor de estilos central (Glassmorphism/MD3), alinhando o visual do modal e seus formulários com o restante da aplicação.

import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, User, Phone, Mail } from 'lucide-react';

const ContactModal = ({ show, onClose, onSubmit, activePalette, isSubmitting, styles }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });

  if (!show || !styles || !activePalette) return null;

  const charsLeft = 500 - formData.message.length;

  const formatPhone = (val) => {
    let v = val.replace(/\D/g, '').substring(0, 11);
    if (v.length === 0) return '';
    if (v.length <= 2) return `(${v}`;
    if (v.length <= 3) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
    if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3)}`;
    return `(${v.slice(0, 2)}) ${v.slice(2, 3)} ${v.slice(3, 7)}-${v.slice(7)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      setFormData({ ...formData, phone: formatPhone(value) });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit('contact', formData, () => setFormData({ name: '', phone: '', email: '', message: '' }), "Mensagem enviada! Verifique seu e-mail.", "Falha ao enviar mensagem.");
  };

  const inputContainerStyle = { position: 'relative' };
  const iconStyle = { position: 'absolute', top: '13px', left: '12px', opacity: 0.5, color: activePalette.fontColor, zIndex: 1 };
  const inputStyle = { ...styles.textInput, paddingLeft: '38px', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ ...styles.modalOverlay, opacity: show ? 1 : 0, transition: 'opacity 0.3s' }}>
      <div style={{...styles.modalContent, animation: 'fadeIn 0.3s ease-out', maxWidth: '550px', width: '100%', textAlign: 'left' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }}>
          <X size={24} />
        </button>

        <h2 style={{ margin: '0 0 25px 0', fontSize: '20px', fontWeight: '600', color: activePalette.titleColor }}>
          Entre em Contato
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
          
          <div style={inputContainerStyle}>
            <User size={18} style={iconStyle} />
            <input type="text" name="name" required placeholder="Seu Nome" value={formData.name} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ ...inputContainerStyle, flex: '1 1 200px' }}>
              <Phone size={18} style={iconStyle} />
              <input type="tel" name="phone" placeholder="Telefone (Opcional)" value={formData.phone} onChange={handleChange} maxLength={16} style={inputStyle} />
            </div>
            
            <div style={{ ...inputContainerStyle, flex: '1 1 200px' }}>
              <Mail size={18} style={iconStyle} />
              <input type="email" name="email" required placeholder="Seu E-mail" value={formData.email} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <textarea name="message" required maxLength={500} placeholder="Sua mensagem..." value={formData.message} onChange={handleChange} style={{ ...inputStyle, padding: '12px', minHeight: '130px', resize: 'vertical' }} />
            <div style={{ position: 'absolute', bottom: '12px', right: '12px', fontSize: '11px', fontWeight: '600', color: charsLeft < 50 ? '#ef4444' : activePalette.fontColor, opacity: charsLeft < 50 ? 1 : 0.6 }}>
              {charsLeft}
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} style={{...styles.adminButton, marginTop: '10px' }}>
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} 
            {isSubmitting ? 'ENVIANDO...' : 'ENVIAR MENSAGEM'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactModal;
