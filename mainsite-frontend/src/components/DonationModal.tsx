/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
const formatCpf = (digits: string): string => {
  const d = digits.slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

const formatCnpj = (digits: string): string => {
  const d = digits.slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const maskBrazilianDocument = (type: string, raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  return type === 'CNPJ' ? formatCnpj(digits) : formatCpf(digits);
};
// Módulo: mainsite-frontend/src/components/DonationModal.tsx
// Versão: v3.0.0
// Descrição: Unified SumUp-only payment flow. 3 steps: form (card + PIX buttons), PIX QR / 3DS, success.

import { type FormEvent, useState, useEffect, useRef } from 'react';
import { X, Heart, Copy, CheckCircle, Coffee, CreditCard, Smartphone, AlertTriangle, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import type { ActivePalette } from '../types';

const brandIconsBaseUrl = (import.meta.env.VITE_BRAND_ICONS_BASE_URL || '/api/uploads/brands')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');
const getBrandIconSrc = (fileName: string, _fallbackUrl = '') => (brandIconsBaseUrl ? `${brandIconsBaseUrl}/${fileName}` : _fallbackUrl);
const getSafeHttpsOrigin = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

// Taxas de processamento são SEMPRE buscadas em GET /api/sumup/fees
// (fonte: D1 mainsite_settings — configurada no admin-app). Sem fallback
// hardcoded: enquanto a configuração não chega, a opção "Cobrir as taxas"
// fica desabilitada para evitar divergência entre preview e cobrança real.

interface SumupCardState {
  holder: string
  number: string
  expiry: string
  cvv: string
}

type SumupCardField = keyof SumupCardState;

interface SumupNextStep {
  url: string
  method?: string
  payload?: Record<string, string>
}

interface ToastLocal {
  show: boolean
  message: string
  type: 'info' | 'success' | 'error'
}

interface BrandIcon {
  key: string
  label: string
  src: string
}

interface DonationModalProps {
  show: boolean
  onClose: () => void
  activePalette: ActivePalette
  API_URL: string
}

const formatBRL = (num: number): string =>
  num.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');

const DonationModal = ({ show, onClose, activePalette, API_URL }: DonationModalProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [isProcessingPix, setIsProcessingPix] = useState(false);
  const [sumupCard, setSumupCard] = useState<SumupCardState>({ holder: '', number: '', expiry: '', cvv: '' });
  const [sumupEmail, setSumupEmail] = useState('');
  const [sumupDocument, setSumupDocument] = useState('');
  const [sumupDocumentType, setSumupDocumentType] = useState('CPF');
  const [coverFees, setCoverFees] = useState(false);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeFixed, setFeeFixed] = useState<number | null>(null);
  const [feesError, setFeesError] = useState(false);
  const [sumupNextStep, setSumupNextStep] = useState<SumupNextStep | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const trusted3dsOrigin = getSafeHttpsOrigin(API_URL);

  // Listen for redirect_url postMessage from 3DS iframe
  useEffect(() => {
    const handleFrameMessage = (e: MessageEvent) => {
      if (!e.data || e.data.type !== 'sumup-3ds-success') {
        return;
      }

      if (!trusted3dsOrigin || e.origin !== trusted3dsOrigin) {
        return;
      }

      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      setStep(3);
      showToast('Pagamento aprovado com sucesso!', 'success');
    };
    window.addEventListener('message', handleFrameMessage);
    return () => window.removeEventListener('message', handleFrameMessage);
  }, [trusted3dsOrigin]);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');

  const [pixPayload, setPixPayload] = useState('');
  const [pixQrDataUri, setPixQrDataUri] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [toast, setToast] = useState<ToastLocal>({ show: false, message: '', type: 'info' });
  const [toastTop, setToastTop] = useState(20);
  const [brandImageFailed, setBrandImageFailed] = useState<Record<string, boolean>>({});
  const lastPointerYRef = useRef<number | null>(null);

  const showToast = (message: string, type: ToastLocal['type'] = 'error') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = Math.max(16, Math.min(baseY - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const trackPointer = (e: PointerEvent) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

  useEffect(() => {
    if (!pixPayload) { setPixQrDataUri(''); return; }
    QRCode.toDataURL(pixPayload, { width: 200, margin: 1 })
      .then((url: string) => setPixQrDataUri(url))
      .catch(() => setPixQrDataUri(''));
  }, [pixPayload]);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    setFeesError(false);
    (async () => {
      try {
        const res = await fetch(`${API_URL}/sumup/fees`, { credentials: 'omit' });
        if (!res.ok) throw new Error(`fees ${res.status}`);
        const data = await res.json() as { sumupRate?: number; sumupFixed?: number };
        if (cancelled) return;
        const okRate = typeof data.sumupRate === 'number' && data.sumupRate >= 0 && data.sumupRate < 1;
        const okFixed = typeof data.sumupFixed === 'number' && data.sumupFixed >= 0;
        if (!okRate || !okFixed) throw new Error('fees payload inválido');
        setFeeRate(data.sumupRate as number);
        setFeeFixed(data.sumupFixed as number);
      } catch {
        if (cancelled) return;
        setFeeRate(null);
        setFeeFixed(null);
        setFeesError(true);
        setCoverFees(false);
      }
    })();
    return () => { cancelled = true; };
  }, [show, API_URL]);

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
        setIsProcessingPix(false);
        setBrandImageFailed({});

        setSumupNextStep(null);
        setCheckoutId(null);
        setPixPayload('');
        setPixQrDataUri('');
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }, 0);
    } else {
      setTimeout(() => setStep(1), 0);
      visibilityTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 400);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }

    return () => {
      if (visibilityTimeoutRef.current) {
        clearTimeout(visibilityTimeoutRef.current);
        visibilityTimeoutRef.current = null;
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [show]);

  if (!isVisible && !show) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value === '') { setAmountDisplay(''); return; }
    value = (parseInt(value, 10) / 100).toFixed(2);
    value = value.replace('.', ',');
    value = value.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
    setAmountDisplay(value);
  };

  const getNumericAmount = (): number => {
    if (amountDisplay === '') return 0;
    return parseFloat(amountDisplay.replace(/\./g, '').replace(',', '.'));
  };

  const feesLoaded = feeRate !== null && feeFixed !== null;

  const getGrossAmount = (): number => {
    const base = getNumericAmount();
    if (!coverFees || base <= 0 || !feesLoaded) return base;
    return parseFloat((((base + (feeFixed as number)) / (1 - (feeRate as number)))).toFixed(2));
  };

  const handleSumupCardChange = (field: SumupCardField, value: string) => {
    let normalized = value;
    if (field === 'number') normalized = value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    if (field === 'expiry') normalized = value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
    if (field === 'cvv') normalized = value.replace(/\D/g, '').slice(0, 4);
    setSumupCard(prev => ({ ...prev, [field]: normalized }));
  };

  const validateBaseForm = (): boolean => {
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

  const getStandardPaymentError = (rawMessage?: string): string => {
    const msg = String(rawMessage || '').trim();
    if (!msg) return 'Pagamento não aprovado. Revise os dados e tente novamente.';
    return `Pagamento não aprovado: ${msg}`;
  };

  const handleSubmitCard = async (e: FormEvent<HTMLFormElement>) => {
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
    const sumupDocumentDigits = sumupDocument.replace(/\D/g, '');
    const expectedLength = sumupDocumentType === 'CNPJ' ? 14 : 11;
    const hasValidDocument = sumupDocumentDigits.length === expectedLength;

    if (!sumupCard.holder.trim() || cardNumber.length < 13 || !validMonth || !validYear || sumupCard.cvv.length < 3 || !sumupEmail.trim() || !hasValidDocument) {
      showToast('Preencha corretamente todos os dados do cartão.', 'error');
      return;
    }

    setIsProcessingCard(true);
    try {
      const createRes = await fetch(`${API_URL}/sumup/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseAmount: getNumericAmount(),
          coverFees,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: sumupEmail.trim(),
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Falha ao iniciar checkout.');

      const payRes = await fetch(`${API_URL}/sumup/checkout/${createData.checkoutId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseAmount: getNumericAmount(),
          coverFees,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: sumupEmail.trim(),
          documentType: sumupDocumentType,
          document: sumupDocumentDigits,
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
      if (!payRes.ok) throw new Error(payData.error || 'Pagamento não aprovado.');

      if (payData.next_step) {
        setSumupNextStep(payData.next_step);
        setCheckoutId(payData.id || createData.checkoutId);
        setStep(23); // 3DS step
      } else {
        setStep(3);
        showToast('Pagamento aprovado com sucesso!', 'success');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast(getStandardPaymentError(msg), 'error');
    } finally {
      setIsProcessingCard(false);
    }
  };

  const handleSubmitPix = async () => {
    if (!validateBaseForm()) return;

    setIsProcessingPix(true);
    try {
      // Step 1: Create checkout
      const createRes = await fetch(`${API_URL}/sumup/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseAmount: getNumericAmount(),
          coverFees,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: sumupEmail.trim() || undefined,
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Falha ao iniciar checkout.');

      const pixCheckoutId = createData.checkoutId;

      // Step 2: Process with PIX
      const pixRes = await fetch(`${API_URL}/sumup/checkout/${pixCheckoutId}/pix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseAmount: getNumericAmount(),
          coverFees,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
        })
      });
      const pixData = await pixRes.json();
      if (!pixRes.ok) throw new Error(pixData.error || 'Falha ao gerar PIX.');

      // Extract QR code data: try barcode URL first, then code string
      const barcodeUrl = pixData.barcode_url || pixData.barcode;
      const pixCode = pixData.pix_code || pixData.qr_code || pixData.code || '';

      if (barcodeUrl) {
        // Use the barcode image URL directly
        setPixQrDataUri(barcodeUrl);
        setPixPayload(pixCode || barcodeUrl);
      } else if (pixCode) {
        // Generate QR from code string (QRCode library will handle via useEffect)
        setPixPayload(pixCode);
      } else {
        throw new Error('Nenhum código PIX retornado.');
      }

      setCheckoutId(pixCheckoutId);
      setStep(2);

      // Start polling for payment status
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/sumup/checkout/${pixCheckoutId}/status`);
          if (res.ok) {
            const data = await res.json();
            const st = (data.status || '').toUpperCase();
            if (st === 'SUCCESSFUL' || st === 'PAID') {
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              setStep(3);
              showToast('Pagamento aprovado com sucesso!', 'success');
            } else if (st === 'FAILED' || st === 'EXPIRED') {
              clearInterval(pollingIntervalRef.current!);
              pollingIntervalRef.current = null;
              setStep(1);
              showToast('O PIX expirou ou falhou. Tente novamente.', 'error');
            }
          }
        } catch (err) {
          console.error('PIX polling error', err);
        }
      }, 5000);

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      showToast(msg, 'error');
    } finally {
      setIsProcessingPix(false);
    }
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

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: isDarkBase ? 'rgba(15, 15, 20, 0.82)' : 'rgba(240, 240, 244, 0.52)',
    backdropFilter: 'blur(var(--glass-blur-subtle))', WebkitBackdropFilter: 'blur(var(--glass-blur-subtle))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    opacity: show ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)', padding: '20px',
    overflowY: 'auto'
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: isDarkBase ? 'rgba(24,24,28,0.94)' : 'rgba(255,255,255,0.92)', color: activePalette.fontColor,
    padding: '35px', maxWidth: '450px', width: '100%', borderRadius: 'var(--shape-xl)',
    border: '1px solid rgba(128, 128, 128, 0.15)', textAlign: 'center',
    boxShadow: isDarkBase ? '0 25px 50px -12px rgba(0, 0, 0, 0.7)' : '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
    transform: show ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(15px)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', position: 'relative',
    backdropFilter: 'blur(var(--glass-blur-deep))', WebkitBackdropFilter: 'blur(var(--glass-blur-deep))', textShadow: isDarkBase ? '0 1px 3px rgba(0,0,0,0.35)' : 'none',
    margin: 'auto'
  };

  const buttonStyle: React.CSSProperties = {
    backgroundColor: activePalette.titleColor, color: isDarkBase ? '#000' : '#fff', border: 'none',
    padding: '14px', fontSize: '13px', fontWeight: '900', borderRadius: '100px', cursor: 'pointer',
    width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
    boxShadow: '0 4px 14px 0 rgba(0, 0, 0, 0.1)', transition: 'transform 0.2s',
    letterSpacing: '1px', textTransform: 'uppercase'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px 16px',
    backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    border: '1px solid rgba(128, 128, 128, 0.2)',
    borderRadius: 'var(--shape-md)', color: activePalette.fontColor,
    fontSize: '14px', boxSizing: 'border-box'
  };

  const donationBase = getNumericAmount();
  const donationGross = getGrossAmount();
  const brandIcons: BrandIcon[] = [
    { key: 'mastercard', label: 'Mastercard', src: getBrandIconSrc('mastercard.svg') },
    { key: 'visa', label: 'Visa', src: getBrandIconSrc('visa.svg') },
    { key: 'elo', label: 'Elo', src: getBrandIconSrc('elo.svg') },
    { key: 'amex', label: 'American Express', src: getBrandIconSrc('amex.svg') },
  ];

  return (
    <div style={overlayStyle}>
      <div role="alert" aria-live="assertive" aria-atomic="true" style={{ position: 'fixed', top: `${toastTop}px`, left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: toast.show ? 1 : 0, pointerEvents: toast.show ? 'auto' : 'none', backgroundColor: toast.type === 'error' ? 'var(--semantic-error)' : 'var(--semantic-success)', color: '#fff', padding: '12px 20px', borderRadius: '100px', zIndex: 10005, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: 'bold', fontSize: '13px' }}>
        {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />} {toast.message}
      </div>

      <div role="dialog" aria-modal="true" aria-labelledby="donation-title" style={modalStyle}>
        <button type="button" onClick={() => { setStep(1); onClose(); }} aria-label="Fechar" style={{ position: 'absolute', top: '15px', right: '15px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.16)', borderRadius: '100px', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.8, transition: 'all 0.2s' }} onMouseOver={(e) => { (e.currentTarget.style as CSSStyleDeclaration).opacity = '1'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseOut={(e) => { (e.currentTarget.style as CSSStyleDeclaration).opacity = '0.8'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <X size={24} />
        </button>

        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'left' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'inline-flex', padding: '15px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', marginBottom: '15px' }}>
                <Heart size={36} />
              </div>
              <h2 id="donation-title" style={{ margin: '0 0 15px 0', fontSize: 'var(--type-title-md)', fontWeight: '700', color: activePalette.titleColor }}>Apoie este Espaço</h2>
              <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6', marginBottom: '25px' }}>
                Insira seus dados reais e o valor desejado.
              </p>
            </div>

            <form onSubmit={handleSubmitCard} autoComplete="on" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <label htmlFor="donation-first-name" className="sr-only">Nome</label>
                <input
                  id="donation-first-name" name="firstName"
                  type="text" required placeholder="Nome"
                  autoComplete="given-name"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  style={inputStyle}
                />
                <label htmlFor="donation-last-name" className="sr-only">Sobrenome</label>
                <input
                  id="donation-last-name" name="lastName"
                  type="text" required placeholder="Sobrenome"
                  autoComplete="family-name"
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ position: 'absolute', left: '20px', fontSize: '18px', fontWeight: 'bold', opacity: 0.5 }}>R$</span>
                <label htmlFor="donation-amount" className="sr-only">Valor da doação</label>
                <input
                  id="donation-amount" name="donationAmount"
                  type="text" required value={amountDisplay} onChange={handleAmountChange} placeholder="0,00"
                  autoComplete="transaction-amount"
                  inputMode="decimal"
                  style={{ width: '100%', padding: '15px 15px 15px 50px', backgroundColor: isDarkBase ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(128, 128, 128, 0.2)', borderRadius: 'var(--shape-md)', color: activePalette.fontColor, fontSize: '22px', fontWeight: 'bold', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                {brandIcons.map((brand) => (
                  <span
                    key={brand.key}
                    title={brand.label}
                    style={{
                      width: '42px',
                      height: '26px',
                      borderRadius: '6px',
                      border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}`,
                      background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.75)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      padding: '4px',
                    }}
                  >
                    {brand.src && !brandImageFailed[brand.key] ? (
                      <img
                        src={brand.src}
                        alt={brand.label}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => setBrandImageFailed((prev) => ({ ...prev, [brand.key]: true }))}
                        style={{ width: '18px', height: '18px', objectFit: 'contain' }}
                      />
                    ) : (
                      <span style={{ fontSize: '9px', fontWeight: 800, opacity: 0.85 }}>
                        {brand.label.slice(0, 4).toUpperCase()}
                      </span>
                    )}
                  </span>
                ))}
              </div>

              <div>
                <label htmlFor="sumup-card-number" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                  Número do cartão
                </label>
                <input
                  id="sumup-card-number"
                  name="cardNumber"
                  type="text"
                  placeholder="1234 1234 1234 1234"
                  autoComplete="cc-number"
                  inputMode="numeric"
                  value={sumupCard.number}
                  onChange={(e) => handleSumupCardChange('number', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="sumup-card-expiry" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Data de vencimento
                  </label>
                  <input
                    id="sumup-card-expiry"
                    name="cardExpiry"
                    type="text"
                    placeholder="mm/aa"
                    autoComplete="cc-exp"
                    inputMode="numeric"
                    value={sumupCard.expiry}
                    onChange={(e) => handleSumupCardChange('expiry', e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="sumup-card-cvv" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Código de segurança
                  </label>
                  <input
                    id="sumup-card-cvv"
                    name="cardCvv"
                    type="text"
                    placeholder="Ex.: 123"
                    autoComplete="cc-csc"
                    inputMode="numeric"
                    value={sumupCard.cvv}
                    onChange={(e) => handleSumupCardChange('cvv', e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="sumup-card-holder" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                  Nome do titular como aparece no cartão
                </label>
                <input
                  id="sumup-card-holder"
                  name="cardholderName"
                  type="text"
                  placeholder="Maria Santos Pereira"
                  autoComplete="cc-name"
                  value={sumupCard.holder}
                  onChange={(e) => handleSumupCardChange('holder', e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div>
                <label htmlFor="sumup-email" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                  E-mail
                </label>
                <input
                  id="sumup-email"
                  name="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  autoComplete="email"
                  value={sumupEmail}
                  onChange={(e) => setSumupEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <div style={{ width: '100px' }}>
                  <label htmlFor="sumup-document-type" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Tipo
                  </label>
                  <select
                    id="sumup-document-type"
                    name="documentType"
                    autoComplete="off"
                    value={sumupDocumentType}
                    onChange={(e) => {
                      const nextType = e.target.value;
                      setSumupDocumentType(nextType);
                      setSumupDocument((prev) => maskBrazilianDocument(nextType, prev));
                    }}
                    style={{ ...inputStyle, width: '100%' }}
                  >
                    <option value="CPF">CPF</option>
                    <option value="CNPJ">CNPJ</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label htmlFor="sumup-document" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                    Documento
                  </label>
                  <input
                    id="sumup-document"
                    name="documentNumber"
                    type="text"
                    placeholder={sumupDocumentType === 'CPF' ? '999.999.999-99' : '99.999.999/0000-99'}
                    autoComplete="off"
                    inputMode="numeric"
                    value={sumupDocument}
                    onChange={(e) => setSumupDocument(maskBrazilianDocument(sumupDocumentType, e.target.value))}
                    maxLength={sumupDocumentType === 'CPF' ? 14 : 18}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  cursor: feesLoaded ? 'pointer' : 'not-allowed',
                  fontSize: '13px',
                  opacity: feesLoaded ? 0.85 : 0.5,
                  textAlign: 'left',
                  userSelect: 'none',
                }}
                title={feesError ? 'Configuração de taxas indisponível no momento.' : (feesLoaded ? '' : 'Carregando configuração de taxas...')}
              >
                <input
                  id="donation-cover-fees" name="donationCoverFees"
                  type="checkbox"
                  checked={coverFees}
                  disabled={!feesLoaded}
                  onChange={(e) => setCoverFees(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: activePalette.titleColor, cursor: feesLoaded ? 'pointer' : 'not-allowed', flexShrink: 0 }}
                />
                Cobrir as taxas de processamento do cartão
              </label>

              {coverFees && feesLoaded && donationBase > 0 && (
                <div style={{ fontSize: '12px', opacity: 0.65, textAlign: 'left', lineHeight: '1.7', padding: '8px 12px', borderRadius: '6px', background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                  <strong>Valor com taxa incluída:</strong><br />
                  R$ {formatBRL(donationGross)} (+R$ {formatBRL(donationGross - donationBase)})
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <button
                  type="button"
                  onClick={handleSubmitPix}
                  disabled={isProcessingPix || isProcessingCard}
                  style={{ ...buttonStyle, background: '#10b981', color: '#fff', cursor: (isProcessingPix || isProcessingCard) ? 'not-allowed' : 'pointer', opacity: (isProcessingPix || isProcessingCard) ? 0.7 : 1 }}
                >
                  {isProcessingPix ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                  {isProcessingPix ? 'GERANDO PIX...' : 'PIX'}
                </button>
                <button
                  type="submit"
                  disabled={isProcessingCard || isProcessingPix}
                  style={{ ...buttonStyle, background: '#0066ff', color: '#fff', cursor: (isProcessingCard || isProcessingPix) ? 'not-allowed' : 'pointer', opacity: (isProcessingCard || isProcessingPix) ? 0.7 : 1 }}
                >
                  {isProcessingCard ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {isProcessingCard ? 'PROCESSANDO...' : 'CARTÃO DE CRÉDITO'}
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
              {pixQrDataUri ? (
                <img src={pixQrDataUri} alt="QR Code PIX" style={{ width: '180px', height: '180px', display: 'block' }} />
              ) : (
                <div style={{ width: '180px', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', opacity: 0.5 }}>Gerando QR...</div>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <button type="button" onClick={handleCopy} style={{ width: '100%', padding: '12px', background: isDarkBase ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: activePalette.fontColor, border: '1px solid rgba(128,128,128,0.2)', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontWeight: 'bold', transition: 'background 0.2s' }}>
                {isCopied ? <CheckCircle size={18} color="#10b981" /> : <Copy size={18} />}
                {isCopied ? 'Copiado!' : 'Copiar Código PIX'}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px', opacity: 0.7, marginBottom: '16px' }}>
              <Loader2 size={14} className="animate-spin" />
              Aguardando confirmação do pagamento...
            </div>

            <button
              type="button"
              onClick={() => {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                setStep(1);
              }}
              style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: 0.6, textDecoration: 'underline' }}
            >
              Cancelar e Voltar
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.3s', padding: '20px 0' }}>
            <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '20px' }}>
              <Coffee size={40} />
            </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: activePalette.titleColor }}>Muito Obrigado!</h2>
            <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: '1.6', marginBottom: '30px' }}>
              Sua contribuição aquece os servidores e incentiva a continuidade destas Reflexos. Agradeço imensamente pelo apoio ao meu trabalho.
            </p>
            <button type="button" onClick={() => { setStep(1); onClose(); }} style={buttonStyle}>Fechar</button>
          </div>
        )}

        {step === 23 && sumupNextStep && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'center', minHeight: '350px' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '18px', fontWeight: '700', color: activePalette.titleColor }}>Autenticação Segura (3DS)</h2>
            <p style={{ fontSize: '13px', opacity: 0.8, marginBottom: '20px' }}>
              Finalize a verificação diretamente com o banco emissor do seu cartão.
            </p>

            <div style={{ position: 'relative', width: '100%', height: '400px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(128,128,128,0.2)', backgroundColor: '#fff' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#000' }}>
                <Loader2 size={32} className="animate-spin" color={activePalette.titleColor} />
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>Carregando ambiente seguro...</span>
              </div>

              <iframe
                name="sumup-3ds-frame"
                title="Autenticação 3D Secure"
                style={{ width: '100%', height: '100%', border: 'none', position: 'relative', zIndex: 10 }}
                onLoad={() => {
                  if (!pollingIntervalRef.current && checkoutId) {
                    pollingIntervalRef.current = setInterval(async () => {
                      try {
                        const res = await fetch(`${API_URL}/sumup/checkout/${checkoutId}/status`);
                        if (res.ok) {
                          const data = await res.json();
                          const st = (data.status || '').toUpperCase();
                          if (st === 'SUCCESSFUL' || st === 'PAID') {
                            clearInterval(pollingIntervalRef.current!);
                            pollingIntervalRef.current = null;
                            setStep(3);
                            showToast('Pagamento aprovado com sucesso!', 'success');
                          } else if (st === 'FAILED') {
                            clearInterval(pollingIntervalRef.current!);
                            pollingIntervalRef.current = null;
                            setStep(1);
                            setIsProcessingCard(false);
                            showToast('A transação foi recusada ou falhou.', 'error');
                          }
                        }
                      } catch (err) {
                        console.error('Polling error', err);
                      }
                    }, 4000);
                  }
                }}
              />
              <form
                method={(sumupNextStep.method || "POST") as "get" | "post"}
                action={sumupNextStep.url}
                target="sumup-3ds-frame"
                ref={(el: HTMLFormElement | null) => {
                  if (el && !el.dataset.submitted) {
                    el.dataset.submitted = 'true';
                    setTimeout(() => el.submit(), 100);
                  }
                }}
                style={{ display: 'none' }}
              >
                {sumupNextStep.payload && Object.entries(sumupNextStep.payload).map(([k, v]) => (
                  <input key={k} type="hidden" name={k} value={v} />
                ))}
              </form>
            </div>

            <button
              type="button"
              onClick={() => {
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                setStep(1);
                setIsProcessingCard(false);
              }}
              style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: 0.6, marginTop: '20px', textDecoration: 'underline' }}
            >
              Cancelar e Voltar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;
