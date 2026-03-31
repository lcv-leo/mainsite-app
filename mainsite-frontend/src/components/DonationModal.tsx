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
// Versão: v2.0.0
// Descrição: TypeScript migration. Resolução do TypeError letal ('reading payer' of undefined) no onSubmit preservada. Tipagem completa para estados, refs e payloads.

import { type FormEvent, useState, useEffect, useRef } from 'react';
import { X, Heart, Copy, CheckCircle, Coffee, CreditCard, Smartphone, AlertTriangle, Loader2 } from 'lucide-react';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import type { ActivePalette } from '../types';

// ✅ Carrega chave pública do Mercado Pago via variável de ambiente
// Injetada pelo GitHub Actions durante o build (build-time env injection)
// NÃO há fallback hardcoded; se undefined, will show error to user
const mpPublicKey = (import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '')
  .trim()
  .replace(/^['"]|['"]$/g, '');
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
if (mpPublicKey) {
  initMercadoPago(mpPublicKey, { locale: 'pt-BR' });
}

// Taxas de processamento por provedor (cartão de crédito online)
const MP_FEE_RATE = 0.0499;   // 4,99% Mercado Pago
const MP_FEE_FIXED = 0.40;    // R$ 0,40 fixo
const SUMUP_FEE_RATE = 0.0267; // 2,67% SumUp
const SUMUP_FEE_FIXED = 0;

type PaymentProvider = 'mercadopago' | 'sumup';

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
  const [brickKey, setBrickKey] = useState(0);
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isProcessingCard, setIsProcessingCard] = useState(false);
  const [isProcessingMpCard, setIsProcessingMpCard] = useState(false);
  const [sumupCard, setSumupCard] = useState<SumupCardState>({ holder: '', number: '', expiry: '', cvv: '' });
  const [sumupEmail, setSumupEmail] = useState('');
  const [sumupDocument, setSumupDocument] = useState('');
  const [sumupDocumentType, setSumupDocumentType] = useState('CPF');
  const [coverFees, setCoverFees] = useState(false);
  const [sumupNextStep, setSumupNextStep] = useState<SumupNextStep | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);

  const trusted3dsOrigin = getSafeHttpsOrigin(API_URL);

  // Escuta o redirect_url do iframe para bypass final
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
        setIsProcessingMpCard(false);
        setBrandImageFailed({});

        setSumupNextStep(null);
        setCheckoutId(null);
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

  // Calcula o valor bruto que cobre a taxa do provedor escolhido,
  // garantindo que o criador receba o valor base integralmente.
  const getGrossAmount = (provider: PaymentProvider): number => {
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

  const handleSumupCardChange = (field: SumupCardField, value: string) => {
    let normalized = value;
    if (field === 'number') normalized = value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
    if (field === 'expiry') normalized = value.replace(/\D/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2');
    if (field === 'cvv') normalized = value.replace(/\D/g, '').slice(0, 4);
    setSumupCard(prev => ({ ...prev, [field]: normalized }));
  };

  const handleChooseCardProvider = (provider: PaymentProvider) => {
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

  const handleSubmitSumupCard = async (e: FormEvent<HTMLFormElement>) => {
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
      if (!createRes.ok) throw new Error(createData.error || 'Falha ao iniciar checkout SumUp.');

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
      if (!payRes.ok) throw new Error(payData.error || 'Pagamento SumUp não aprovado.');

      if (payData.next_step) {
        setSumupNextStep(payData.next_step);
        // Usa o ID canônico retornado no pay (pode ser transaction UUID); fallback para checkoutId.
        setCheckoutId(payData.id || createData.checkoutId);
        setStep(7);
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

  const generatePix = async (amountStr: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/pix/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountStr }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Erro ao gerar PIX');
      return data.payload;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Falha ao gerar código PIX.';
      showToast(msg, 'error');
      return null;
    }
  };

  const handleConfirmNativePix = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!validateBaseForm()) return;
    const finalAmount = amountDisplay === '' ? '0,00' : amountDisplay;
    const payload = await generatePix(finalAmount);
    if (payload) {
      setPixPayload(payload);
      setStep(2);
    }
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


  const handleConfirmCreditCard = (e: React.MouseEvent<HTMLButtonElement>) => {
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

  const cardHeaderTitleStyle: React.CSSProperties = {
    margin: '0',
    color: activePalette.titleColor,
    fontSize: '18px',
    fontWeight: '700',
    textAlign: 'right',
  };

  const cardSectionStyle: React.CSSProperties = {
    marginBottom: '12px',
    padding: '12px',
    borderRadius: '10px',
    border: `1px solid ${isDarkBase ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
    background: isDarkBase ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  };

  const cardProviderBadgeStyle = (provider: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: 800,
    padding: '4px 8px',
    borderRadius: '999px',
    border: provider === 'sumup' ? '1px solid rgba(17,24,39,0.35)' : '1px solid rgba(0,158,227,0.35)',
    color: provider === 'sumup' ? (isDarkBase ? '#e5e7eb' : '#111827') : '#009ee3',
    background: provider === 'sumup' ? (isDarkBase ? 'rgba(229,231,235,0.12)' : 'rgba(17,24,39,0.06)') : 'rgba(0,158,227,0.10)',
  });

  const donationBase = getNumericAmount();
  const donationGrossSumup = getGrossAmount('sumup');
  const donationGrossMp = getGrossAmount('mercadopago');
  const sumupBrandIcons: BrandIcon[] = [
    { key: 'mastercard', label: 'Mastercard', src: getBrandIconSrc('mastercard.svg') },
    { key: 'visa', label: 'Visa', src: getBrandIconSrc('visa.svg') },
    { key: 'elo', label: 'Elo', src: getBrandIconSrc('elo.svg') },
    { key: 'amex', label: 'American Express', src: getBrandIconSrc('amex.svg') },
  ];

  return (
    <div style={overlayStyle}>
      <div role="alert" aria-live="assertive" aria-atomic="true" style={{ position: 'fixed', top: `${toastTop}px`, left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: toast.show ? 1 : 0, backgroundColor: toast.type === 'error' ? 'var(--semantic-error)' : 'var(--semantic-success)', color: '#fff', padding: '12px 20px', borderRadius: '100px', zIndex: 10005, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: 'bold', fontSize: '13px' }}>
        {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />} {toast.message}
      </div>

      <div role="dialog" aria-modal="true" aria-labelledby="donation-title" style={modalStyle}>
        <button type="button" onClick={() => { setStep(1); onClose(); }} aria-label="Fechar" style={{ position: 'absolute', top: '15px', right: '15px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.16)', borderRadius: '100px', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.8, transition: 'all 0.2s' }} onMouseOver={(e) => { (e.currentTarget.style as CSSStyleDeclaration).opacity = '1'; e.currentTarget.style.transform = 'translateY(-2px)'; }} onMouseOut={(e) => { (e.currentTarget.style as CSSStyleDeclaration).opacity = '0.8'; e.currentTarget.style.transform = 'translateY(0)'; }}>
          <X size={24} />
        </button>

        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <div style={{ display: 'inline-flex', padding: '15px', borderRadius: '50%', backgroundColor: 'rgba(236, 72, 153, 0.1)', color: '#ec4899', marginBottom: '15px' }}>
              <Heart size={36} />
            </div>
            <h2 id="donation-title" style={{ margin: '0 0 15px 0', fontSize: 'var(--type-title-md)', fontWeight: '700', color: activePalette.titleColor }}>Apoie este Espaço</h2>
            <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6', marginBottom: '25px' }}>
              Insira seus dados reais, o valor desejado e escolha a plataforma.
            </p>
            <form autoComplete="on">
              <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
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

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
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

              {/* Checkbox de repasse de taxa (apenas para cartão de crédito) */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', cursor: 'pointer', fontSize: '13px', opacity: 0.85, textAlign: 'left', userSelect: 'none' }}>
                <input
                  id="donation-cover-fees" name="donationCoverFees"
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
            <h2 style={{ margin: '0 0 12px 0', fontSize: '20px', fontWeight: '600', color: activePalette.titleColor }}>Escolha a Processadora de Pagamentos</h2>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '20px', paddingRight: '54px' }}>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isProcessingCard}
                style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: isProcessingCard ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: isProcessingCard ? 0.45 : 0.7, padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                &larr; Voltar
              </button>
              <h2 style={cardHeaderTitleStyle}>Cartão de crédito ou débito</h2>
            </div>

            <div style={cardSectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={cardProviderBadgeStyle('sumup')}><CreditCard size={13} /> SUMUP</span>
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.6', opacity: 0.85 }}>
                Valor base: <strong>R$ {formatBRL(donationBase || 0)}</strong><br />
                Valor final na processadora: <strong>R$ {formatBRL(donationGrossSumup || 0)}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
              {sumupBrandIcons.map((brand) => (
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

            <form onSubmit={handleSubmitSumupCard} autoComplete="on" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid rgba(128,128,128,0.2)' }}>
                <label htmlFor="sumup-email" style={{ display: 'block', margin: '0 0 12px 0', fontSize: '13px', fontWeight: '600', color: activePalette.fontColor }}>
                  Preencha seus dados
                </label>
                <input
                  id="sumup-email"
                  name="email"
                  type="email"
                  placeholder="E-mail"
                  autoComplete="email"
                  value={sumupEmail}
                  onChange={(e) => setSumupEmail(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isProcessingCard}
                style={{ ...buttonStyle, background: '#0066ff', color: '#fff', marginTop: '8px' }}
              >
                {isProcessingCard ? <Loader2 size={16} className="animate-spin" /> : null}
                {isProcessingCard ? 'PROCESSANDO...' : 'PAGAR COM SUMUP'}
              </button>
            </form>
          </div>
        )}

        {step === 7 && sumupNextStep && (
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
                  // The iframe loaded either the bank page, or the final redirect step
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
                            setStep(3); // Success
                            showToast('Pagamento aprovado com sucesso!', 'success');
                          } else if (st === 'FAILED') {
                            clearInterval(pollingIntervalRef.current!);
                            pollingIntervalRef.current = null;
                            setStep(5); // Go back to payment form
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
                setStep(5);
                setIsProcessingCard(false);
              }}
              style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: 0.6, marginTop: '20px', textDecoration: 'underline' }}
            >
              Cancelar e Voltar
            </button>
          </div>
        )}

        {step === 6 && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'left', minHeight: '300px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '20px', paddingRight: '54px' }}>
              <button
                type="button"
                onClick={() => setStep(4)}
                disabled={isProcessingMpCard}
                style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: isProcessingMpCard ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: isProcessingMpCard ? 0.45 : 0.7, padding: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                &larr; Voltar
              </button>
              <h2 style={cardHeaderTitleStyle}>Cartão de crédito ou débito</h2>
            </div>

            <div style={cardSectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span style={cardProviderBadgeStyle('mercadopago')}><CreditCard size={13} /> MERCADO PAGO</span>
              </div>
              <div style={{ fontSize: '12px', lineHeight: '1.6', opacity: 0.85 }}>
                Valor base: <strong>R$ {formatBRL(donationBase || 0)}</strong><br />
                Valor final na processadora: <strong>R$ {formatBRL(donationGrossMp || 0)}</strong>
              </div>
            </div>

            {!mpPublicKey ? (
              <div style={{ padding: '16px', borderRadius: '8px', background: isDarkBase ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', color: isDarkBase ? '#fecaca' : '#991b1b', fontSize: '13px', lineHeight: '1.5' }}>
                Chave pública do Mercado Pago ausente. Configure <strong>VITE_MERCADOPAGO_PUBLIC_KEY</strong> no ambiente do frontend para habilitar pagamento com cartão.
              </div>
            ) : (
              <div style={{ ...cardSectionStyle, marginBottom: 0 }}>
                <CardPayment
                  key={`mp-card-brick-${brickKey}`}
                  initialization={{ amount: donationGrossMp }}
                  customization={{ visual: { style: { theme: isDarkBase ? 'dark' : 'default' } } }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onSubmit={async (formData: any) => {
                    setIsProcessingMpCard(true);
                    return new Promise<void>((resolve, reject) => {
                      const processDonation = async () => {
                        try {
                          const payer = (formData.payer && typeof formData.payer === 'object' ? formData.payer : {}) as Record<string, unknown>;
                          const payload = {
                            ...formData,
                            baseAmount: getNumericAmount(),
                            coverFees,
                            payer: {
                              ...payer,
                              first_name: firstName.trim(),
                              last_name: lastName.trim(),
                            },
                          };

                          const res = await fetch(`${API_URL}/mp-payment`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload),
                          });

                          if (res.ok) {
                            resolve();
                            setStep(3);
                            showToast('Pagamento aprovado com sucesso!', 'success');
                          } else {
                            const errorData = await res.json();
                            console.error('🔴 MP Backend Rejeitou:', errorData);
                            showToast(getStandardPaymentError(errorData?.error), 'error');
                            reject();
                          }
                        } catch (error) {
                          console.error('🔴 Falha Crítica no Frontend (Fetch):', error);
                          showToast('Falha de conexão. Verifique sua rede e tente novamente.', 'error');
                          reject();
                        } finally {
                          setIsProcessingMpCard(false);
                        }
                      };
                      processDonation();
                    });
                  }}
                  onError={(error: unknown) => {
                    setIsProcessingMpCard(false);
                    console.error('🔴 Erro de Inicialização do SDK MP:', error);
                    showToast('Não foi possível iniciar o formulário de cartão. Atualize a página e tente novamente.', 'error');
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;
