// Módulo: mainsite-frontend/src/components/DonationModal.jsx
// Versão: v1.4.0
// Descrição: Código unificado e auditado. Restrição do Payment Brick exclusivamente para 'creditCard' (redução de taxas), botão renomeado, preservando a inicialização global e a segurança antifraude.

import React, { useState, useEffect } from 'react';
import { X, Heart, Copy, CheckCircle, Coffee, CreditCard, Smartphone } from 'lucide-react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

// INICIALIZAÇÃO GLOBAL (FORA DO CICLO DE VIDA DO COMPONENTE)
// Garante que o SDK está pronto antes do React tentar desenhar o iframe
initMercadoPago("APP_USR-6ab7dc5d-ed0a-484b-a569-057740f2f794", { locale: 'pt-BR' });

const DonationModal = ({ show, onClose, activePalette, API_URL }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1); 
  const [amountDisplay, setAmountDisplay] = useState('');
  const [pixPayload, setPixPayload] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      setStep(1);
      setAmountDisplay('');
      setIsCopied(false);
    } else {
      setTimeout(() => setIsVisible(false), 400);
    }
  }, [show]);

  if (!isVisible && !show) return null;

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

    const formatField = (id, value) => {
      const len = value.length.toString().padStart(2, '0');
      return `${id}${len}${value}`;
    };

    let payload = "";
    payload += formatField("00", "01"); 
    const merchantAccountInfo = formatField("00", "BR.GOV.BCB.PIX") + formatField("01", key);
    payload += formatField("26", merchantAccountInfo);
    payload += formatField("52", "0000");
    payload += formatField("53", "986"); 
    if (parseFloat(amount) > 0) payload += formatField("54", amount);
    payload += formatField("58", "BR");
    payload += formatField("59", name);
    payload += formatField("60", city);
    payload += formatField("62", formatField("05", "***"));
    payload += "6304";

    const calcCRC16 = (str) => {
      let crc = 0xFFFF;
      for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
          if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
          else crc = crc << 1;
        }
      }
      return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    };

    return payload + calcCRC16(payload);
  };

  const handleConfirmNativePix = (e) => {
    e.preventDefault();
    const finalAmount = amountDisplay === '' ? '0,00' : amountDisplay;
    setPixPayload(generatePix(finalAmount));
    setStep(2);
  };

  const handleConfirmMercadoPago = (e) => {
    e.preventDefault();
    setStep(4);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error("Falha ao copiar PIX", err);
    }
  };

  const overlayStyle = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDarkBase ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.45)',
    backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    opacity: show ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: '20px',
    overflowY: 'auto'
  };

  const modalStyle = {
    backgroundColor: activePalette.bgColor, color: activePalette.fontColor,
    padding: '35px', maxWidth: '450px', width: '100%', borderRadius: '16px',
    border: '1px solid rgba(128, 128, 128, 0.15)', textAlign: 'center',
    boxShadow: isDarkBase ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(15px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative',
    margin: 'auto'
  };

  const buttonStyle = {
    backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none',
    padding: '14px', fontSize: '13px', fontWeight: '900', borderRadius: '8px', cursor: 'pointer',
    width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
    boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s',
    letterSpacing: '1px', textTransform: 'uppercase'
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.6 }} onMouseOver={(e) => e.currentTarget.style.opacity = 1} onMouseOut={(e) => e.currentTarget.style.opacity = 0.6}>
          <X size={24} />
        </button>

        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'inline-flex', padding: '15px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', marginBottom: '15px' }}>
              <Heart size={36} />
            </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '20px', fontWeight: '600', color: activePalette.titleColor }}>Apoie este Espaço</h2>
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6', marginBottom: '25px' }}>
              A manutenção da infraestrutura, dos bancos de dados e da Inteligência Artificial que alimentam este site possui custos. Insira o valor desejado e escolha a plataforma.
            </p>
            <form>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <span style={{ position: 'absolute', left: '20px', fontSize: '18px', fontWeight: 'bold', opacity: 0.5 }}>R$</span>
                <input 
                  type="text" required value={amountDisplay} onChange={handleAmountChange} placeholder="0,00"
                  style={{ width: '100%', padding: '15px 15px 15px 50px', backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(128, 128, 128, 0.2)', borderRadius: '8px', color: activePalette.fontColor, fontSize: '22px', fontWeight: 'bold', outline: 'none', boxSizing: 'border-box' }} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button type="button" onClick={handleConfirmNativePix} style={{...buttonStyle, background: '#10b981', color: '#fff'}}>
                  <Smartphone size={16} /> PIX Direto (Sem Taxas)
                </button>
                <button type="button" onClick={handleConfirmMercadoPago} style={{...buttonStyle, background: '#009ee3', color: '#fff'}}>
                  <CreditCard size={16} /> Cartão de Crédito
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: '600', color: activePalette.titleColor }}>Código PIX Gerado</h2>
            <p style={{ fontSize: '12px', opacity: 0.6, marginBottom: '20px' }}>Escaneie o QR Code ou use o Copia e Cola.</p>
            
            <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px', border: '1px solid #ccc' }}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pixPayload)}`} alt="QR Code PIX" style={{ width: '180px', height: '180px', display: 'block' }} />
            </div>

            <button type="button" onClick={handleCopy} style={{ width: '100%', padding: '12px', background: isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: activePalette.fontColor, border: '1px solid rgba(128,128,128,0.2)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', transition: 'background 0.2s' }}>
              {isCopied ? <CheckCircle size={18} color="#10b981" /> : <Copy size={18} />}
              {isCopied ? 'Copiado!' : 'Copiar Código PIX'}
            </button>

            <button type="button" onClick={() => setStep(3)} style={{...buttonStyle, background: '#10b981', color: '#fff'}}>Feito</button>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.3s', padding: '20px 0' }}>
            <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '20px' }}>
              <Coffee size={40} />
            </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: activePalette.titleColor }}>Muito Obrigado!</h2>
            <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: '1.6', marginBottom: '30px' }}>
              Sua contribuição aquece os servidores e incentiva a continuidade destas divagações. Agradeço imensamente pelo apoio ao meu trabalho.
            </p>
            <button type="button" onClick={onClose} style={buttonStyle}>Fechar</button>
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'left', minHeight: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button type="button" onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>&larr; Voltar</button>
            </div>
            <Payment
              initialization={{ amount: getNumericAmount() }}
              customization={{
                paymentMethods: { 
                  // Exclusão deliberada de ticket, bankTransfer e debitCard para evitar taxas desnecessárias
                  creditCard: "all" 
                },
                visual: { style: { theme: isDarkBase ? 'dark' : 'default' } }
              }}
              onSubmit={async (param) => {
                const res = await fetch(`${API_URL}/mp-payment`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(param.formData)
                });
                
                if (res.ok) {
                  setStep(3);
                } else {
                  const errorData = await res.json();
                  console.error("Falha detalhada Mercado Pago:", errorData);
                  alert(`Não foi possível aprovar. Verifique os dados ou tente outra forma.`);
                  setStep(1);
                }
              }}
              onError={(error) => {
                console.error("Erro no Mercado Pago:", error);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;