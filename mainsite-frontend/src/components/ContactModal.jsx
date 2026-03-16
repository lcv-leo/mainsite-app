// Módulo: mainsite-frontend/src/components/ContactModal.jsx
// Versão: v1.2.0
// Descrição: Formulário de Contato padronizado sob as métricas de Glassmorphism e Material Design.

import React, { useState, useEffect } from 'react';
import { X, Send, Loader2 } from 'lucide-react';

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

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData, () => setFormData({ name: '', phone: '', email: '', message: '' }));
  };

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  // Métrica Glassmorphism: Fundo da tela
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

  // Métrica Glassmorphism: Container do Modal
  const modalStyle = {
    backgroundColor: activePalette.bgColor,
    color: activePalette.fontColor,
    padding: '35px',
    maxWidth: '500px',
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

  // Métrica Material: Inputs de formulário
  const inputStyle = {
    width: '100%',
    padding: '12px 16px',
    marginBottom: '16px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: '8px',
    color: activePalette.fontColor,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
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
    opacity: isSubmitting ? 0.7 : 1
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

        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input type="text" name="name" placeholder="Seu Nome" value={formData.name} onChange={handleChange} style={inputStyle} required />
          <input type="email" name="email" placeholder="Seu E-mail" value={formData.email} onChange={handleChange} style={inputStyle} required />
          <input type="tel" name="phone" placeholder="Seu Telefone / WhatsApp (Opcional)" value={formData.phone} onChange={handleChange} style={inputStyle} />
          
          <textarea 
            name="message" 
            placeholder="Sua Mensagem..." 
            value={formData.message} 
            onChange={handleChange} 
            style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} 
            required 
          />

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