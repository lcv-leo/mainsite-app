// Módulo: mainsite-frontend/src/components/DonationModal.jsx
// Versão: v2.0.0
// Descrição: Componente refatorado para utilizar o motor de estilos central (Glassmorphism/MD3) e o sistema de notificações global, alinhando completamente a experiência de doação com a UI da aplicação.

import React, { useState, useEffect } from 'react';
import { X, Heart, Copy, CheckCircle, Coffee, CreditCard, Smartphone } from 'lucide-react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

initMercadoPago("APP_USR-6ab7dc5d-ed0a-484b-a569-057740f2f794", { locale: 'pt-BR' });

const DonationModal = ({ show, onClose, activePalette, API_URL, styles, showNotification }) => {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (show) {
      setStep(1);
      setAmountDisplay('');
      setFirstName('');
      setLastName('');
      setIsCopied(false);
    }
  }, [show]);

  if (!show || !styles || !activePalette) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const handleAmountChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') { setAmountDisplay(''); return; }
    value = (parseInt(value, 10) / 100).toFixed(2);
    value = value.replace('.', ',');
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    setAmountDisplay(value);
  };

  const getNumericAmount = () => {
    if (amountDisplay === '') return 0;
    return parseFloat(amountDisplay.replace(/\./g, '').replace(',', '.'));
  };

  const generatePix = (amountStr) => {
    const key = "c9328705-fa51-44c0-b972-bca71e2d06bd";
    const name = "LEONARDO VARGAS";
    const city = "RIO DE JANEIRO";
    const amount = amountStr.replace(/\./g, '').replace(',', '.');
    const formatField = (id, value) => `${id}${value.length.toString().padStart(2, '0')}${value}`;
    let payload = formatField("00", "01") + formatField("26", formatField("00", "BR.GOV.BCB.PIX") + formatField("01", key)) + formatField("52", "0000") + formatField("53", "986");
    if (parseFloat(amount) > 0) payload += formatField("54", amount);
    payload += formatField("58", "BR") + formatField("59", name) + formatField("60", city) + formatField("62", formatField("05", "***")) + "6304";
    const calcCRC16 = (str) => {
      let crc = 0xFFFF;
      for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
          crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        }
      }
      return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    };
    return payload + calcCRC16(payload);
  };

  const validateBaseForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      showNotification("Preencha seu Nome e Sobrenome reais.", "error");
      return false;
    }
    if (getNumericAmount() <= 0) {
      showNotification("Por favor, insira um valor de doação válido.", "error");
      return false;
    }
    return true;
  };

  const handleConfirmNativePix = (e) => { e.preventDefault(); if (validateBaseForm()) { setPixPayload(generatePix(amountDisplay === '' ? '0,00' : amountDisplay)); setStep(2); }};
  const handleConfirmMercadoPago = (e) => { e.preventDefault(); if (validateBaseForm()) setStep(4); };
  const handleCopy = async () => { try { await navigator.clipboard.writeText(pixPayload); setIsCopied(true); setTimeout(() => setIsCopied(false), 3000); } catch (err) { console.error("Falha ao copiar PIX", err); }};

  const buttonStyle = (bgColor, color) => ({ ...styles.adminButton, backgroundColor: bgColor, color: color, width: '100%' });
  const inputStyle = { ...styles.textInput, width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ ...styles.modalOverlay, zIndex: 10001, overflowY: 'auto' }}>
      <div style={{ ...styles.modalContent, animation: 'fadeIn 0.3s ease-out', maxWidth: '450px', margin: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }}>
          <X size={24} />
        </button>

        {step === 1 && (
          <>
            <div style={{ display: 'inline-flex', padding: '15px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', marginBottom: '15px' }}> <Heart size={36} /> </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: '600', color: activePalette.titleColor }}>Apoie este Espaço</h2>
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6', marginBottom: '25px' }}> Insira seus dados reais, o valor desejado e escolha a plataforma. </p>
            <form style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input type="text" required placeholder="Nome" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
                <input type="text" required placeholder="Sobrenome" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', fontWeight: 'bold', opacity: 0.5 }}>R$</span>
                <input type="text" required value={amountDisplay} onChange={handleAmountChange} placeholder="0,00" style={{ ...inputStyle, padding: '15px 15px 15px 50px', fontSize: '22px', fontWeight: 'bold', textAlign: 'center' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button type="button" onClick={handleConfirmNativePix} style={buttonStyle('#10b981', '#fff')}> <Smartphone size={16} /> PIX </button>
                <button type="button" onClick={handleConfirmMercadoPago} style={buttonStyle('#009ee3', '#fff')}> <CreditCard size={16} /> Cartão de Crédito </button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: '600', color: activePalette.titleColor }}>Código PIX Gerado</h2>
            <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '20px' }}>Escaneie o QR Code ou use o Copia e Cola.</p>
            <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px', border: '1px solid #ccc' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>
            <button type="button" onClick={handleCopy} style={{ ...styles.headerBtn, width: '100%', justifyContent: 'center' }}>
              {isCopied ? <CheckCircle size={18} color="#10b981" /> : <Copy size={18} />} {isCopied ? 'Copiado!' : 'Copiar Código PIX'}
            </button>
            <button type="button" onClick={() => setStep(3)} style={buttonStyle('#10b981', '#fff')}>Feito</button>
          </>
        )}

        {step === 3 && (
          <div style={{ padding: '20px 0' }}>
            <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '20px' }}> <Coffee size={40} /> </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: activePalette.titleColor }}>Muito Obrigado!</h2>
            <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: '1.6', marginBottom: '30px' }}> Sua contribuição aquece os servidores e incentiva a continuidade destas divagações. Agradeço imensamente pelo apoio ao meu trabalho. </p>
            <button type="button" onClick={onClose} style={{...styles.adminButton, width: '100%'}}>Fechar</button>
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'left', minHeight: '300px' }}>
            <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginBottom: '15px' }}>&larr; Voltar</button>
            <CardPayment
              key="mp-card-brick" 
              initialization={{ amount: getNumericAmount() }}
              customization={{ visual: { style: { theme: isDarkBase ? 'dark' : 'default' } } }}
              onSubmit={(formData) => new Promise(async (resolve, reject) => {
                try {
                  const payload = { ...formData, payer: { ...(formData.payer || {}), first_name: firstName.trim(), last_name: lastName.trim() } };
                  const res = await fetch(`${API_URL}/mp-payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                  if (res.ok) { resolve(); setStep(3); } 
                  else { const err = await res.json(); showNotification(`Não aprovado: ${err.error || 'Verifique os dados.'}`, "error"); reject(); }
                } catch (error) { showNotification("Falha de conexão. Tente novamente.", "error"); reject(); }
              })}
              onError={(error) => console.error("🔴 Erro de Inicialização do SDK MP:", error)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;