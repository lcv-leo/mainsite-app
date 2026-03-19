// Módulo: mainsite-frontend/src/components/CommentModal.jsx
// Versão: v1.1.0
// Descrição: MD3 + Glassmorphism

import React, { useState, useEffect } from 'react';
import { X, Send, Loader2, User, Phone, Mail } from 'lucide-react';

const CommentModal = ({ show, onClose, onSubmit, activePalette, isSubmitting, currentPost }) => {
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', message: '' });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (show) setIsVisible(true);
    else setTimeout(() => setIsVisible(false), 400);
  }, [show]);

  if (!isVisible && !show) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');
  const charsLeft = 1000 - formData.message.length;

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
    if (name === 'phone') setFormData({ ...formData, phone: formatPhone(value) });
    else setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, post_title: currentPost?.title }, () => setFormData({ name: '', phone: '', email: '', message: '' }));
  };

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDarkBase ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.5)',
    backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    opacity: show ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: '20px'
  };

  const modalStyle = {
    backgroundColor: isDarkBase ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)', color: activePalette.fontColor,
    padding: '40px', maxWidth: '550px', width: '100%', borderRadius: '28px', border: '1px solid rgba(128, 128, 128, 0.15)',
    boxShadow: isDarkBase ? '0 32px 64px -12px rgba(0, 0, 0, 0.6)' : '0 32px 64px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative', backdropFilter: 'blur(24px)'
  };

  const inputStyle = {
    width: '100%', padding: '14px 16px 14px 44px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)', borderRadius: '16px', color: activePalette.fontColor,
    fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box'
  };

  const iconStyle = { position: 'absolute', top: '15px', left: '16px', opacity: 0.5, color: activePalette.fontColor };

  const buttonStyle = {
    backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none',
    padding: '16px', fontSize: '15px', fontWeight: '800', borderRadius: '100px', cursor: isSubmitting ? 'not-allowed' : 'pointer',
    width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
    transition: 'all 0.2s ease', boxShadow: `0 8px 24px ${activePalette.titleColor}40`,
    opacity: isSubmitting ? 0.7 : 1, marginTop: '10px', letterSpacing: '1px'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(128,128,128,0.1)', padding: '8px', borderRadius: '100px', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.7, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.1)'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.transform = 'scale(1)'; }}>
          <X size={20} />
        </button>

        <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: '800', color: activePalette.titleColor, letterSpacing: '-0.02em' }}>
          Deixar um Comentário
        </h2>
        <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '25px', marginTop: 0, fontWeight: '500' }}>
          Em relação ao fragmento: <strong>{currentPost?.title || 'Geral'}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
          <div style={{ position: 'relative' }}>
            <User size={18} style={iconStyle} />
            <input type="text" name="name" placeholder="Seu Nome (Opcional)" value={formData.name} onChange={handleChange} style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Phone size={18} style={iconStyle} />
              <input type="tel" name="phone" placeholder="Telefone (Opcional)" value={formData.phone} onChange={handleChange} maxLength={16} style={inputStyle} />
            </div>
            <div style={{ position: 'relative', flex: '1 1 200px' }}>
              <Mail size={18} style={iconStyle} />
              <input type="email" name="email" placeholder="Seu E-mail (Opcional)" value={formData.email} onChange={handleChange} style={inputStyle} />
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <textarea name="message" required maxLength={1000} placeholder="Escreva seu comentário aqui (Obrigatório)..." value={formData.message} onChange={handleChange} style={{ ...inputStyle, padding: '16px', minHeight: '140px', resize: 'vertical' }} />
            <div style={{ position: 'absolute', bottom: '16px', right: '16px', fontSize: '11px', fontWeight: '800', color: charsLeft < 50 ? '#ef4444' : activePalette.fontColor, opacity: charsLeft < 50 ? 1 : 0.5 }}>
              {charsLeft} restantes
            </div>
          </div>

          <button type="submit" disabled={isSubmitting} style={buttonStyle} onMouseOver={(e) => !isSubmitting && (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseOut={(e) => !isSubmitting && (e.currentTarget.style.transform = 'translateY(0)')}>
            {isSubmitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {isSubmitting ? 'ENVIANDO...' : 'ENVIAR COMENTÁRIO'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CommentModal;