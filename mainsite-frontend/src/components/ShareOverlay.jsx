// Módulo: mainsite-frontend/src/components/ShareOverlay.jsx
// Versão: v1.4.0
// Descrição: MD3 + Glassmorphism.

import React, { useState, useEffect } from 'react';
import { Mail, Send, X } from 'lucide-react';

const ShareOverlay = ({ modalState, setModalState, onSubmit, activePalette }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (modalState.show) {
            setTimeout(() => setIsVisible(true), 0);
        } else {
            setTimeout(() => setIsVisible(false), 400);
        }
    }, [modalState.show]);

    if (!isVisible && !modalState.show) return null;

    const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: isDarkBase ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000,
        opacity: modalState.show ? 1 : 0, transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: '20px'
    };

    const modalStyle = {
        backgroundColor: isDarkBase ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)', color: activePalette.fontColor,
        padding: '40px', maxWidth: '450px', width: '100%', borderRadius: '28px', border: '1px solid rgba(128, 128, 128, 0.15)',
        boxShadow: isDarkBase ? '0 32px 64px -12px rgba(0, 0, 0, 0.6)' : '0 32px 64px -12px rgba(0, 0, 0, 0.15)',
        transform: modalState.show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(20px)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative', display: 'flex', flexDirection: 'column',
        alignItems: 'center', textAlign: 'center', backdropFilter: 'blur(24px)'
    };

    const inputStyle = {
        width: '100%', padding: '16px', marginBottom: '24px',
        backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
        border: '1px solid rgba(128, 128, 128, 0.2)', borderRadius: '16px', color: activePalette.fontColor,
        fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box', textAlign: 'center'
    };

    const buttonStyle = {
        backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none',
        padding: '16px', fontSize: '15px', fontWeight: '800', borderRadius: '100px', cursor: 'pointer',
        width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
        transition: 'all 0.2s ease', boxShadow: `0 8px 24px ${activePalette.titleColor}40`, letterSpacing: '1px'
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <button type="button" onClick={() => setModalState({ show: false, email: '' })} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(128,128,128,0.1)', padding: '8px', borderRadius: '100px', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.7, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'scale(1.1)'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = 0.7; e.currentTarget.style.transform = 'scale(1)'; }}>
                    <X size={20} />
                </button>

                <div style={{ padding: '20px', borderRadius: '100px', backgroundColor: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', marginBottom: '20px' }}>
                    <Mail size={40} strokeWidth={1.5} style={{ opacity: 0.9 }} />
                </div>

                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', fontWeight: '800', color: activePalette.titleColor, letterSpacing: '-0.02em' }}>Compartilhar Leitura</h2>
                <p style={{ margin: '0 0 30px 0', fontSize: '14px', opacity: 0.8, lineHeight: '1.6', fontWeight: '500' }}>Insira o e-mail do destinatário para enviar o link deste fragmento.</p>

                <form onSubmit={onSubmit} style={{ width: '100%' }}>
                    <input type="email" required autoFocus placeholder="destinatario@exemplo.com" value={modalState.email} onChange={(e) => setModalState({ ...modalState, email: e.target.value })} style={inputStyle} />
                    <button type="submit" style={buttonStyle} onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')} onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
                        <Send size={20} /> ENVIAR E-MAIL
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ShareOverlay;