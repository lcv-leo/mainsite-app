// Módulo: mainsite-frontend/src/components/DonationModal.jsx
// Versão: v1.9.2
// Descrição: Resolução do TypeError letal ('reading payer' of undefined) no onSubmit. O CardPayment do SDK do Mercado Pago envia o formData diretamente como argumento (diferente do Payment genérico). Assinatura ajustada para evitar undefined e garantir a injeção do first_name e last_name.

import React, { useState, useEffect, useRef } from 'react';
import { X, Heart, Copy, CheckCircle, Coffee, CreditCard, Smartphone, AlertTriangle, Loader2 } from 'lucide-react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';

const MP_PUBLIC_KEY_FALLBACK = 'APP_USR-6ab7dc5d-ed0a-484b-a569-057740f2f794';
const mpPublicKey = (import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || MP_PUBLIC_KEY_FALLBACK)
  .trim()
  .replace(/^['"]|['"]$/g, '');
if (mpPublicKey) {
  initMercadoPago(mpPublicKey, { locale: 'pt-BR' });
}
// Taxas de processamento por provedor (cartão de crédito online)
const MP_FEE_RATE = 0.0499;   // 4,99% Mercado Pago
const MP_FEE_FIXED = 0.40;    // R$ 0,40 fixo
const SUMUP_FEE_RATE = 0.0267; // 2,67% SumUp
const SUMUP_FEE_FIXED = 0;

const formatBRL = (num) =>
  num.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
const DonationModal = ({ show, onClose, activePalette, API_URL }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const [brickKey, setBrickKey] = useState(0);
  const visibilityTimeoutRef = useRef(null);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [sumupCard, setSumupCard] = useState({ holder: '', number: '', expiry: '', cvv: '' });
  const [sumupEmail, setSumupEmail] = useState('');
  const [sumupDocument, setSumupDocument] = useState('');
  const [sumupDocumentType, setSumupDocumentType] = useState('CPF');
  const [coverFees, setCoverFees] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');

  const [pixPayload, setPixPayload] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [toastTop, setToastTop] = useState(20);
  const lastPointerYRef = useRef(null);

  const showToast = (message, type = 'error') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = Math.max(16, Math.min(baseY - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const trackPointer = (e) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

  useEffect(() => {
    if (visibilityTimeoutRef.current) {
      clearTimeout(visibilityTimeoutRef.current);
      visibilityTimeoutRef.current = null;
    }

    if (show) {
      visibilityTimeoutRef.current = setTimeout(() => {
        setIsVisible(true);
        setStep(1);
        setAmountDisplay('');
        setFirstName('');
        setLastName('');
        setIsCopied(false);
        setSumupCard({ holder: '', number: '', expiry: '', cvv: '' });
        setSumupEmail('');
        setSumupDocument('');
        setSumupDocumentType('CPF');
        setCoverFees(false);
        setIsProcessingCard(false);
      }, 0);
    } else {
      setTimeout(() => setStep(1), 0);
      visibilityTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 400);
    }

    return () => {
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = null;
      }
    };
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

  // Calcula o valor bruto que cobre a taxa do provedor escolhido,
  // garantindo que o criador receba o valor base integralmente.
  const getGrossAmount = (provider) => {
    const base = getNumericAmount();
    if (!coverFees || base <= 0) return base;
    if (provider === 'mercadopago') {
      return parseFloat(((base + MP_FEE_FIXED) / (1 - MP_FEE_RATE)).toFixed(2));
    }
    if (provider === 'sumup') {
      return parseFloat(((base + SUMUP_FEE_FIXED) / (1 - SUMUP_FEE_RATE)).toFixed(2));
    }
    return base;
  };

  const handleSumupCardChange = (field, value) => {
    let normalized = value;
    if (field === 'number') normalized = value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    if (field === 'expiry') normalized = value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
    if (field === 'cvv') normalized = value.replace(/\D/g, '').slice(0, 4);
    setSumupCard(prev => ({ ...prev, [field]: normalized }));
  };

  const handleChooseCardProvider = (provider) => {
    if (provider === 'sumup') {
      setStep(5);
      return;
    }
    if (provider === 'mercadopago') {
      if (!mpPublicKey) {
        showToast("Chave pública do Mercado Pago não configurada. Defina VITE_MERCADOPAGO_PUBLIC_KEY.", "error");
        return;
      }
      setBrickKey(prev => prev + 1);
      setStep(6);
    }
  };

  const handleSubmitSumupCard = async (e) => {
    e.preventDefault();
    if (!validateBaseForm()) return;

    const cardNumber = sumupCard.number.replace(/\s/g, '');
    const [expiryMonth, expiryYearShort] = sumupCard.expiry.split('/');
    const expiryYear = expiryYearShort ? `20${expiryYearShort}` : '';

    const expMonthNum = Number(expiryMonth);
    const expYearNum = Number(expiryYear);
    const currentYear = new Date().getFullYear();
    const validMonth = Number.isInteger(expMonthNum) && expMonthNum >= 1 && expMonthNum <= 12;
    const validYear = Number.isInteger(expYearNum) && expYearNum >= currentYear;

    if (!sumupCard.holder.trim() || cardNumber.length < 13 || !validMonth || !validYear || sumupCard.cvv.length < 3 || !sumupEmail.trim() || !sumupDocument.trim()) {
      showToast('Preencha corretamente todos os dados do cartão.', 'error');
      return;
    }

    setIsProcessingCard(true);
    try {
      const createRes = await fetch(`${API_URL}/sumup/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: getGrossAmount('sumup'),
          baseAmount: getNumericAmount(),
          coverFees,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: sumupEmail.trim(),
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Falha ao iniciar checkout SumUp.');

      const grossAmount = getGrossAmount('sumup');
      const payRes = await fetch(`${API_URL}/sumup/checkout/${createData.checkoutId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: grossAmount,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: sumupEmail.trim(),
          documentType: sumupDocumentType,
          document: sumupDocument.trim(),
          card: {
            name: sumupCard.holder.trim(),
            number: cardNumber,
            expiryMonth,
            expiryYear,
            cvv: sumupCard.cvv,
          }
        })
      });
      const payData = await payRes.json();
      if (!payRes.ok) throw new Error(payData.error || 'Pagamento SumUp não aprovado.');

      setStep(3);
      showToast('Pagamento via SumUp confirmado com sucesso!', 'success');
    } catch (error) {
      showToast(error.message || 'Falha no pagamento com SumUp.', 'error');
    } finally {
      setIsProcessingCard(false);
    }
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

  const validateBaseForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
      showToast("Preencha seu Nome e Sobrenome reais.", "error");
      return false;
    }
    if (getNumericAmount() <= 0) {
      showToast("Por favor, insira um valor de doação válido.", "error");
      return false;
    }
    return true;
  };

  const handleConfirmNativePix = (e) => {
    e.preventDefault();
    if (!validateBaseForm()) return;
    const finalAmount = amountDisplay === '' ? '0,00' : amountDisplay;
    setPixPayload(generatePix(finalAmount));
    setStep(2);
  };

  const handleConfirmCreditCard = (e) => {
    e.preventDefault();
    if (!validateBaseForm()) return;
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
    backgroundColor: isDarkBase ? 'rgba(15, 15, 20, 0.82)' : 'rgba(240, 240, 244, 0.52)',
    backdropFilter: 'blur(var(--glass-blur-subtle))', WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    opacity: show ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: '20px',
    overflowY: 'auto'
  };

  const modalStyle = {
    backgroundColor: isDarkBase ? 'rgba(24,24,28,0.94)' : 'rgba(255,255,255,0.92)', color: activePalette.fontColor,
    padding: '35px', maxWidth: '450px', width: '100%', borderRadius: 'var(--shape-xl)',
    border: '1px solid rgba(128, 128, 128, 0.15)', textAlign: 'center',
    boxShadow: isDarkBase ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(15px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative',
    backdropFilter: 'blur(var(--glass-blur-deep))', WebkitBackdropFilter: 'blur(var(--glass-blur-deep))', textShadow: isDarkBase ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
    margin: 'auto'
  };

  const buttonStyle = {
    backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none',
    padding: '14px', fontSize: '13px', fontWeight: '900', borderRadius: '100px', cursor: 'pointer',
    width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
    boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s',
    letterSpacing: '1px', textTransform: 'uppercase'
  };

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: 'var(--shape-md)', color: activePalette.fontColor,
    fontSize: '14px', boxSizing: 'border-box'
  };

  return (
    <div style={overlayStyle}>
      <div style={{ position: 'fixed', top: `${toastTop}px`, left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? 'var(--semantic-error)' : 'var(--semantic-success)', color: '#fff', padding: '12px 20px', borderRadius: '100px', zIndex: 10005, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: 'bold', fontSize: '13px' }}>
        {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />} {toast.message}
      </div>

      <div style={modalStyle}>
        <button onClick={() => { setStep(1); onClose(); }} style={{ position: 'absolute', top: '15px', right: '15px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.16)', borderRadius: '100px', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.8, transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseOut={(e) => { e.currentTarget.style.opacity = 0.8; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <X size={24} />
        </button>

        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'inline-flex', padding: '15px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', marginBottom: '15px' }}>
              <Heart size={36} />
            </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: 'var(--type-title-md)', fontWeight: '700', color: activePalette.titleColor }}>Apoie este Espaço</h2>
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6', marginBottom: '25px' }}>
              Insira seus dados reais, o valor desejado e escolha a plataforma.
            </p>
            <form>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                <input
                  type="text" required placeholder="Nome"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text" required placeholder="Sobrenome"
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <span style={{ position: 'absolute', left: '20px', fontSize: '18px', fontWeight: 'bold', opacity: 0.5 }}>R$</span>
                <input
                  type="text" required value={amountDisplay} onChange={handleAmountChange} placeholder="0,00"
                  style={{ width: '100%', padding: '15px 15px 15px 50px', backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(128, 128, 128, 0.2)', borderRadius: 'var(--shape-md)', color: activePalette.fontColor, fontSize: '22px', fontWeight: 'bold', boxSizing: 'border-box' }}
                />
              </div>

              {/* Checkbox de repasse de taxa (apenas para cartão de crédito) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', fontSize: '13px', opacity: 0.85, textAlign: 'left', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={coverFees}
                  onChange={(e) => setCoverFees(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: activePalette.titleColor, cursor: 'pointer', flexShrink: 0 }}
                />
                Cobrir as taxas de processamento do cartão
              </label>

              {coverFees && getNumericAmount() > 0 && (() => {
                const base = getNumericAmount();
                const grossMP  = parseFloat(((base + MP_FEE_FIXED) / (1 - MP_FEE_RATE)).toFixed(2));
                const grossSU  = parseFloat(((base + SUMUP_FEE_FIXED) / (1 - SUMUP_FEE_RATE)).toFixed(2));
                return (
                  <div style={{ fontSize: '12px', opacity: 0.65, marginBottom: '12px', textAlign: 'left', lineHeight: '1.7', padding: '8px 12px', borderRadius: '6px', background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                    <strong>Valores com taxa incluída:</strong><br />
                    Mercado Pago: R$ {formatBRL(grossMP)} (+R$ {formatBRL(grossMP - base)})<br />
                    SumUp: R$ {formatBRL(grossSU)} (+R$ {formatBRL(grossSU - base)})
                  </div>
                );
              })()}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button type="button" onClick={handleConfirmNativePix} style={{ ...buttonStyle, background: '#10b981', color: '#fff' }}>
                  <Smartphone size={16} /> PIX
                </button>
                <button type="button" onClick={handleConfirmCreditCard} style={{ ...buttonStyle, background: '#009ee3', color: '#fff' }}>
                  <CreditCard size={16} /> Cartão de Crédito
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 4 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '600', color: activePalette.titleColor }}>Escolha o gateway do cartão</h2>
            <p style={{ fontSize: '13px', opacity: 0.7, marginBottom: '20px' }}>Você pode concluir com Mercado Pago ou SumUp.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" onClick={() => handleChooseCardProvider('mercadopago')} style={{ ...buttonStyle, background: '#009ee3', color: '#fff' }}>
                <CreditCard size={16} /> Mercado Pago
              </button>
              <button type="button" onClick={() => handleChooseCardProvider('sumup')} style={{ ...buttonStyle, background: '#111827', color: '#fff' }}>
                <CreditCard size={16} /> SumUp
              </button>
              <button type="button" onClick={() => setStep(1)} style={{ ...buttonStyle, background: isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', color: activePalette.fontColor }}>
                Voltar
              </button>
            </div>
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

            <button type="button" onClick={() => setStep(3)} style={{ ...buttonStyle, background: '#10b981', color: '#fff' }}>Feito</button>
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
            <button type="button" onClick={() => { setStep(1); onClose(); }} style={buttonStyle}>Fechar</button>
          </div>
        )}

        {step === 5 && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: '0', color: activePalette.titleColor, fontSize: '18px', fontWeight: '600' }}>
                Cartão de crédito ou débito
              </h2>
              <button type="button" onClick={() => setStep(4)} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: 0.7 }}>&larr; Voltar</button>
            </div>

            {/* Ícones de bandeiras */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'flex-start' }}>
              <div style={{ width: '40px', height: '25px', borderRadius: '4px', background: '#EB001B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>MC</div>
              <div style={{ width: '40px', height: '25px', borderRadius: '4px', background: '#1434CB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>VISA</div>
              <div style={{ width: '40px', height: '25px', borderRadius: '4px', background: '#FF5F00', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>ELO</div>
              <div style={{ width: '40px', height: '25px', borderRadius: '4px', background: '#006FCF', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 'bold' }}>AMEX</div>
            </div>

            <form onSubmit={handleSubmitSumupCard} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Número do cartão */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                  Número do cartão
                </label>
                <input
                  type="text"
                  placeholder="1234 1234 1234 1234"
                  value={sumupCard.number}
                  onChange={(e) => handleSumupCardChange('number', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Data de vencimento e CVV */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Data de vencimento
                  </label>
                  <input
                    type="text"
                    placeholder="mm/aa"
                    value={sumupCard.expiry}
                    onChange={(e) => handleSumupCardChange('expiry', e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Código de segurança
                  </label>
                  <input
                    type="text"
                    placeholder="Ex.: 123"
                    value={sumupCard.cvv}
                    onChange={(e) => handleSumupCardChange('cvv', e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Nome do titular */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                  Nome do titular como aparece no cartão
                </label>
                <input
                  type="text"
                  placeholder="Maria Santos Pereira"
                  value={sumupCard.holder}
                  onChange={(e) => handleSumupCardChange('holder', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Documento do titular */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '100px' }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Tipo
                  </label>
                  <select
                    value={sumupDocumentType}
                    onChange={(e) => setSumupDocumentType(e.target.value)}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Documento
                  </label>
                  <input
                    type="text"
                    placeholder={sumupDocumentType === 'CPF' ? '999.999.999-99' : '99.999.999/0000-99'}
                    value={sumupDocument}
                    onChange={(e) => setSumupDocument(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Seção Preencha seus dados */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid rgba(128,128,128,0.2)` }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: activePalette.fontColor }}>
                  Preencha seus dados
                </h3>
                <input
                  type="email"
                  placeholder="E-mail"
                  value={sumupEmail}
                  onChange={(e) => setSumupEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              {/* Botão Pagar */}
              <button
                type="submit"
                disabled={isProcessingCard}
                style={{
                  ...buttonStyle,
                  background: '#0066ff',
                  color: '#fff',
                  marginTop: '8px'
                }}
              >
                {isProcessingCard ? <Loader2 size={16} className="animate-spin" /> : null}
                {isProcessingCard ? 'PROCESSANDO...' : 'PAGAR'}
              </button>
            </form>
          </div>
        )}

        {step === 6 && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'left', minHeight: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <button type="button" onClick={() => setStep(4)} style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>&larr; Voltar</button>
            </div>
            {!mpPublicKey ? (
              <div style={{ padding: '16px', borderRadius: '8px', background: isDarkBase ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: isDarkBase ? '#fecaca' : '#991b1b', fontSize: '13px', lineHeight: '1.5' }}>
                Chave pública do Mercado Pago ausente. Configure <strong>VITE_MERCADOPAGO_PUBLIC_KEY</strong> no ambiente do frontend para habilitar pagamento com cartão.
              </div>
            ) : (
            <CardPayment
              key={`mp-card-brick-${brickKey}`}
              initialization={{ amount: getGrossAmount('mercadopago') }}
              customization={{ visual: { style: { theme: isDarkBase ? 'dark' : 'default' } } }}

              onSubmit={(formData) => {
                return new Promise((resolve, reject) => {
                  const processDonation = async () => {
                    try {
                      const payload = {
                        ...formData,
                        payer: {
                          ...(formData.payer || {}),
                          first_name: firstName.trim(),
                          last_name: lastName.trim()
                        }
                      };

                      const res = await fetch(`${API_URL}/mp-payment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                      });
                      
                      if (res.ok) {
                        resolve(); 
                        setStep(3);
                      } else {
                        const errorData = await res.json();
                        console.error("🔴 MP Backend Rejeitou:", errorData);
                        showToast(`Não aprovado: ${errorData.error || 'Verifique os dados.'}`, "error");
                        reject(); 
                      }
                    } catch (error) {
                      console.error("🔴 Falha Crítica no Frontend (Fetch):", error);
                      showToast("Falha de conexão. Verifique sua rede e tente novamente.", "error");
                      reject(); 
                    }
                  };
                  processDonation(); // Execute the async function inside the standard Promise
                });
              }}
              onError={(error) => {
                console.error("🔴 Erro de Inicialização do SDK MP:", error);
              }}
            />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;