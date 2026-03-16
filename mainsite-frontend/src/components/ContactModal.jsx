// Módulo: mainsite-frontend/src/components/ContactModal.jsx
// Versão: v1.3.0
// Descrição: Casca visual em Glassmorphism fundida com motor funcional (máscara de telefone, limite de caracteres e ícones inline).

import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, User, Phone, Mail } from 'lucide-react';

const ContactModal = ({ show, onClose, onSubmit, activePalette, isSubmitting }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 400);
    }
  }, [show]);

  if (!isVisible && !show) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');
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
    onSubmit(formData, () => setFormData({ name: '', phone: '', email: '', message: '' }));
  };

  // --- MÉTRICAS GLASSMORPHISM & MATERIAL DESIGN ---
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
    padding: '35px',
    maxWidth: '550px',
    width: '100%',
    borderRadius: '16px',
    border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase 
      ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' 
      : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(15px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative'
  };

  // Ajuste do inputStyle para acomodar os ícones (padding-left maior)
  const inputStyle = {
    width: '100%',
    padding: '12px 16px 12px 38px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '8px',
    color: activePalette.fontColor,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  };

  const iconStyle = {
    position: 'absolute',
    top: '13px',
    left: '12px',
    opacity: 0.5,
    color: activePalette.fontColor
  };

  const buttonStyle = {
    backgroundColor: activePalette.titleColor,
    color: isDarkBase ? '#000' : '#fff',
    border: 'none',
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: isSubmitting ? 'not-allowed' : 'pointer',
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    transition: 'transform 0.2s ease, opacity 0.2s ease',
    boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.1)',
    opacity: isSubmitting ? 0.7 : 1,
    marginTop: '10px'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button 
          onClick={onClose} 
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }}
          onMouseOver={(e) => e.currentTarget.style.opacity = 1}
          onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}
        >
          <X size={24} />
        </button>

        <h2 style={{ margin: '0 0 25px 0', fontSize: '22px', fontWeight: '600', color: activePalette.titleColor, letterSpacing: '-0.02em' }}>
          Entre em Contato
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
          
          <div style={{ position: 'relative' }}>
            <User size={18} style={iconStyle} />
            <input type="text" name="name" required placeholder="Seu Nome" value={formData.name} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Phone size={18} style={iconStyle} />
              <input 
                type="tel" 
                name="phone"
                placeholder="Telefone (Opcional)" 
                value={formData.phone} 
                onChange={handleChange} 
                maxLength={16}
                style={inputStyle} 
              />
            </div>
            
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Mail size={18} style={iconStyle} />
              <input type="email" name="email" required placeholder="Seu E-mail" value={formData.email} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <textarea 
              name="message"
              required 
              maxLength={500} 
              placeholder="Escreva sua mensagem aqui..." 
              value={formData.message} 
              onChange={handleChange} 
              style={{ ...inputStyle, padding: '15px', minHeight: '130px', resize: 'vertical' }} 
            />
            <div style={{ position: 'absolute', bottom: '15px', right: '15px', fontSize: '11px', fontWeight: '600', color: charsLeft < 50 ? '#ef4444' : activePalette.fontColor, opacity: charsLeft < 50 ? 1 : 0.5 }}>
              {charsLeft} caracteres restantes
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting} 
            style={buttonStyle}
            onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.transform = 'translateY(-1px)')}
            onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.transform = 'translateY(0)')}
            onMouseDown={(e) => !isSubmitting && (e.currentTarget.style.transform = 'translateY(1px)')}
          >
            {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} 
            {isSubmitting ? 'ENVIANDO...' : 'ENVIAR MENSAGEM'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContactModal;
