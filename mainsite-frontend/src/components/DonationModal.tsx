/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
// Módulo: mainsite-frontend/src/components/DonationModal.tsx
// Versão: v3.0.0
// Descrição: Fluxo unificado de doação via Payment Widget da SumUp, incluindo cartão e PIX/APMs quando habilitados.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Heart, CheckCircle, CreditCard, AlertTriangle, Loader2 } from 'lucide-react';
import type { ActivePalette } from '../types';
import SumUpCardWidget from './SumUpCardWidget';

const brandIconsBaseUrl = (import.meta.env.VITE_BRAND_ICONS_BASE_URL || '/api/uploads/brands')
  .trim()
  .replace(/^['"]|['"]$/g, '')
  .replace(/\/+$/, '');
const getBrandIconSrc = (fileName: string, _fallbackUrl = '') => (brandIconsBaseUrl ? `${brandIconsBaseUrl}/${fileName}` : _fallbackUrl);

// Taxas de processamento são SEMPRE buscadas em GET /api/sumup/fees
// (fonte: D1 mainsite_settings — configurada no admin-app). Sem fallback
// hardcoded: enquanto a configuração não chega, a opção "Cobrir as taxas"
// fica desabilitada para evitar divergência entre preview e cobrança real.

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

type DonationPaymentMethod = 'card' | 'pix';

interface DonationResumePayload {
  checkoutId: string
  firstName: string
  lastName: string
  email: string
  amountDisplay: string
  coverFees: boolean
  paymentMethod: DonationPaymentMethod
  scrollY: number | null
}

interface DonationModalProps {
  show: boolean
  onClose: () => void
  activePalette: ActivePalette
  API_URL: string
  resumeCheckoutId?: string | null
}

const formatBRL = (num: number): string =>
  num.toFixed(2).replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');

const SUMUP_PENDING_DONATION_STORAGE_KEY = 'mainsite:sumup:pending-donation';
const SUMUP_CARD_METHODS = ['card'] as const;
const SUMUP_PIX_METHODS = ['pix', 'qr_code_pix'] as const;

const getSumUpWidgetErrorMessage = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  const candidate = body as { message?: unknown; error?: unknown; error_message?: unknown };
  if (typeof candidate.message === 'string' && candidate.message.trim()) return candidate.message.trim();
  if (typeof candidate.error_message === 'string' && candidate.error_message.trim()) return candidate.error_message.trim();
  if (typeof candidate.error === 'string' && candidate.error.trim()) return candidate.error.trim();
  return null;
};

const DonationModal = ({ show, onClose, activePalette, API_URL, resumeCheckoutId = null }: DonationModalProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [step, setStep] = useState(1);
  const visibilityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPreparingCard, setIsPreparingCard] = useState(false);
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [sumupEmail, setSumupEmail] = useState('');
  const [coverFees, setCoverFees] = useState(false);
  const [feeRate, setFeeRate] = useState<number | null>(null);
  const [feeFixed, setFeeFixed] = useState<number | null>(null);
  const [feesError, setFeesError] = useState(false);
  const [cardCheckoutId, setCardCheckoutId] = useState<string | null>(null);
  const [cardFlowMessage, setCardFlowMessage] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<DonationPaymentMethod>('card');
  const [isResumingCheckout, setIsResumingCheckout] = useState(false);

  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRestoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [amountDisplay, setAmountDisplay] = useState('');
  const [toast, setToast] = useState<ToastLocal>({ show: false, message: '', type: 'info' });
  const [toastTop, setToastTop] = useState(20);
  const [brandImageFailed, setBrandImageFailed] = useState<Record<string, boolean>>({});
  const lastPointerYRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastLocal['type'] = 'error') => {
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
    const pointerY = lastPointerYRef.current;
    const baseY = pointerY != null ? pointerY : (viewportH * 0.5);
    const nextTop = Math.max(16, Math.min(baseY - 36, Math.max(16, viewportH - 90)));
    setToastTop(nextTop);
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  }, []);

  const persistPendingCheckout = useCallback((payload: DonationResumePayload) => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(SUMUP_PENDING_DONATION_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore session storage failures; the checkout can still complete normally.
    }
  }, []);

  const clearPendingCheckout = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.removeItem(SUMUP_PENDING_DONATION_STORAGE_KEY);
    } catch {
      // Ignore session storage failures.
    }
  }, []);

  const restoreViewportContext = useCallback((scrollY: number | null | undefined) => {
    if (typeof window === 'undefined' || typeof scrollY !== 'number' || Number.isNaN(scrollY)) return;

    if (scrollRestoreTimeoutRef.current) {
      clearTimeout(scrollRestoreTimeoutRef.current);
      scrollRestoreTimeoutRef.current = null;
    }

    let attempts = 0;
    const maxAttempts = 12;
    const restore = () => {
      const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      const nextTop = Math.max(0, Math.min(scrollY, maxScroll));
      window.scrollTo({ top: nextTop, behavior: 'auto' });

      attempts += 1;
      if (attempts >= maxAttempts || maxScroll >= scrollY - 8) {
        scrollRestoreTimeoutRef.current = null;
        return;
      }

      scrollRestoreTimeoutRef.current = setTimeout(restore, 150);
    };

    window.requestAnimationFrame(restore);
  }, []);

  const restorePendingCheckout = useCallback((expectedCheckoutId: string): DonationResumePayload | null => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(SUMUP_PENDING_DONATION_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<DonationResumePayload>;
      if (!parsed || parsed.checkoutId !== expectedCheckoutId) return null;
      if (
        typeof parsed.firstName !== 'string' ||
        typeof parsed.lastName !== 'string' ||
        typeof parsed.email !== 'string' ||
        typeof parsed.amountDisplay !== 'string' ||
        typeof parsed.coverFees !== 'boolean' ||
        (parsed.paymentMethod !== 'card' && parsed.paymentMethod !== 'pix') ||
        (parsed.scrollY !== null && parsed.scrollY !== undefined && typeof parsed.scrollY !== 'number')
      ) {
        return null;
      }
      return parsed as DonationResumePayload;
    } catch {
      return null;
    }
  }, []);

  const getReturnUrl = useCallback((): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout_id');
      return url.toString();
    } catch {
      return window.location.href;
    }
  }, []);

  useEffect(() => {
    const trackPointer = (e: PointerEvent) => {
      if (typeof e?.clientY === 'number') lastPointerYRef.current = e.clientY;
    };
    window.addEventListener('pointerdown', trackPointer, { passive: true });
    return () => window.removeEventListener('pointerdown', trackPointer);
  }, []);

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
      setIsVisible(true);
      if (!resumeCheckoutId) {
        setStep(1);
        setAmountDisplay('');
        setFirstName('');
        setLastName('');
        setSumupEmail('');
        setCoverFees(false);
        setIsPreparingCard(false);
        setIsSubmittingCard(false);
        setBrandImageFailed({});
        setCardCheckoutId(null);
        setCardFlowMessage('');
        setSelectedPaymentMethod('card');
        setIsResumingCheckout(false);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      }
    } else {
      setTimeout(() => setStep(1), 0);
      visibilityTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 400);
      setIsResumingCheckout(false);
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
      if (scrollRestoreTimeoutRef.current) {
        clearTimeout(scrollRestoreTimeoutRef.current);
        scrollRestoreTimeoutRef.current = null;
      }
    };
  }, [show, resumeCheckoutId]);

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

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const pollCheckoutStatus = useCallback((targetCheckoutId: string) => {
    stopPolling();

    const checkStatus = async () => {
      try {
        const res = await fetch(`${API_URL}/sumup/checkout/${targetCheckoutId}/status`);
        if (!res.ok) return;

        const data = await res.json();
        const status = String(data.status || '').toUpperCase();

        if (status === 'SUCCESSFUL' || status === 'PAID') {
          stopPolling();
          clearPendingCheckout();
          setIsPreparingCard(false);
          setIsSubmittingCard(false);
          setIsResumingCheckout(false);
          setCardFlowMessage('');
          setStep(3);
          showToast('Pagamento aprovado com sucesso!', 'success');
          return;
        }

        if (status === 'FAILED' || status === 'EXPIRED' || status === 'CANCELLED') {
          stopPolling();
          clearPendingCheckout();
          setIsPreparingCard(false);
          setIsSubmittingCard(false);
          setIsResumingCheckout(false);
          setCardCheckoutId(null);
          setCardFlowMessage('');
          setStep(1);
          showToast(
            selectedPaymentMethod === 'pix'
              ? 'O pagamento por PIX não foi concluído. Tente novamente.'
              : 'O pagamento com cartão não foi concluído. Tente novamente.',
            'error',
          );
        }
      } catch (err) {
        console.error('SumUp card polling error', err);
      }
    };

    void checkStatus();
    pollingIntervalRef.current = setInterval(checkStatus, 4000);
  }, [API_URL, clearPendingCheckout, selectedPaymentMethod, showToast, stopPolling]);

  useEffect(() => {
    if (!show || !resumeCheckoutId) return;

    const restored = restorePendingCheckout(resumeCheckoutId);
    if (restored) {
      setFirstName(restored.firstName);
      setLastName(restored.lastName);
      setSumupEmail(restored.email);
      setAmountDisplay(restored.amountDisplay);
      setCoverFees(restored.coverFees);
      setSelectedPaymentMethod(restored.paymentMethod);
      restoreViewportContext(restored.scrollY);
    }

    setCardCheckoutId(resumeCheckoutId);
    setIsPreparingCard(false);
    setIsSubmittingCard(true);
    setIsResumingCheckout(true);
    setCardFlowMessage('Retomando o pagamento seguro na SumUp e confirmando o resultado final...');
    setStep(4);
    pollCheckoutStatus(resumeCheckoutId);
  }, [show, resumeCheckoutId, restorePendingCheckout, restoreViewportContext, pollCheckoutStatus]);

  const selectedWidgetPaymentMethods = useMemo(
    () => (selectedPaymentMethod === 'pix' ? [...SUMUP_PIX_METHODS] : [...SUMUP_CARD_METHODS]),
    [selectedPaymentMethod],
  );

  if (!isVisible && !show) return null;

  const isDarkBase = activePalette.bgColor.startsWith('#0') || activePalette.bgColor.startsWith('#1');

  const handleStartCheckout = async (paymentMethod: DonationPaymentMethod) => {
    if (!validateBaseForm()) return;
    if (!sumupEmail.trim()) {
      showToast('Informe seu e-mail para continuar com a doação.', 'error');
      return;
    }

    setSelectedPaymentMethod(paymentMethod);
    setIsResumingCheckout(false);
    setIsPreparingCard(true);
    setIsSubmittingCard(false);
    setCardFlowMessage(
      paymentMethod === 'pix'
        ? 'Preparando o ambiente seguro da SumUp para concluir sua doação por PIX...'
        : 'Preparando o formulário seguro da SumUp para concluir sua doação com cartão...',
    );

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
          redirectUrl: getReturnUrl(),
        })
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Falha ao iniciar checkout.');

      setCardCheckoutId(createData.checkoutId);
      persistPendingCheckout({
        checkoutId: createData.checkoutId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: sumupEmail.trim(),
        amountDisplay,
        coverFees,
        paymentMethod,
        scrollY: typeof window !== 'undefined' ? window.scrollY : null,
      });
      setIsPreparingCard(false);
      setCardFlowMessage(
        paymentMethod === 'pix'
          ? 'Conclua a sua doação por PIX no ambiente seguro da SumUp.'
          : 'Conclua a sua doação com cartão no formulário seguro da SumUp.',
      );
      setStep(4);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      setIsPreparingCard(false);
      setCardFlowMessage('');
      showToast(getStandardPaymentError(msg), 'error');
    }
  };

  const handleCardWidgetResponse = (type: string, body: unknown) => {
    if (type === 'sent') {
      setIsSubmittingCard(true);
      setIsResumingCheckout(false);
      setCardFlowMessage('Processando o pagamento com a SumUp...');
      return;
    }

    if (type === 'auth-screen') {
      setIsSubmittingCard(true);
      setIsResumingCheckout(false);
      setCardFlowMessage('Siga as instruções exibidas abaixo para concluir o pagamento.');
      if (cardCheckoutId) {
        pollCheckoutStatus(cardCheckoutId);
      }
      return;
    }

    if (type === 'invalid') {
      setIsSubmittingCard(false);
      setIsResumingCheckout(false);
      setCardFlowMessage('Revise os campos do cartão no formulário seguro e tente novamente.');
      showToast('Revise os dados informados e tente novamente.', 'error');
      return;
    }

    if (type === 'error') {
      setIsPreparingCard(false);
      setIsSubmittingCard(false);
      setIsResumingCheckout(false);
      const widgetMessage = getSumUpWidgetErrorMessage(body);
      setCardFlowMessage(widgetMessage || 'A SumUp sinalizou um problema ao processar o pagamento.');
      showToast(getStandardPaymentError(widgetMessage || undefined), 'error');
      return;
    }

    if (type === 'fail') {
      setIsPreparingCard(false);
      setIsSubmittingCard(false);
      setIsResumingCheckout(false);
      setCardFlowMessage('O pagamento não foi concluído. Você pode tentar novamente.');
      showToast('Pagamento não concluído. Você pode tentar novamente.', 'error');
      return;
    }

    if (type === 'success' && cardCheckoutId) {
      setCardFlowMessage(
        selectedPaymentMethod === 'pix'
          ? 'Pagamento enviado. Aguarde a confirmação final para concluir a doação.'
          : 'Pagamento enviado. Confirmando status final com a SumUp...',
      );
      pollCheckoutStatus(cardCheckoutId);
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

  const accentCloseButton = (button: HTMLButtonElement, opacity: string, transform: string) => {
    button.style.opacity = opacity;
    button.style.transform = transform;
  };

  return (
    <div style={overlayStyle}>
      <div role="alert" aria-live="assertive" aria-atomic="true" style={{ position: 'fixed', top: `${toastTop}px`, left: '50%', transform: toast.show ? 'translate(-50%, 0)' : 'translate(-50%, -28px)', opacity: toast.show ? 1 : 0, pointerEvents: toast.show ? 'auto' : 'none', backgroundColor: toast.type === 'error' ? 'var(--semantic-error)' : 'var(--semantic-success)', color: '#fff', padding: '12px 20px', borderRadius: '100px', zIndex: 10005, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)', fontWeight: 'bold', fontSize: '13px' }}>
        {toast.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle size={16} />} {toast.message}
      </div>

      <div role="dialog" aria-modal="true" aria-labelledby="donation-title" style={modalStyle}>
        <button
          type="button"
          onClick={() => { stopPolling(); clearPendingCheckout(); setIsResumingCheckout(false); setSelectedPaymentMethod('card'); setStep(1); onClose(); }}
          aria-label="Fechar"
          style={{ position: 'absolute', top: '15px', right: '15px', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.16)', borderRadius: '100px', color: activePalette.fontColor, cursor: 'pointer', opacity: 0.8, transition: 'all 0.2s' }}
          onMouseOver={(e) => { accentCloseButton(e.currentTarget, '1', 'translateY(-2px)'); }}
          onMouseOut={(e) => { accentCloseButton(e.currentTarget, '0.8', 'translateY(0)'); }}
          onFocus={(e) => { accentCloseButton(e.currentTarget, '1', 'translateY(-2px)'); }}
          onBlur={(e) => { accentCloseButton(e.currentTarget, '0.8', 'translateY(0)'); }}
        >
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

            <form onSubmit={(e) => { e.preventDefault(); void handleStartCheckout('card'); }} autoComplete="on" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                <label htmlFor="sumup-email" style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: activePalette.fontColor, opacity: 0.8 }}>
                  E-mail para recibo e confirmação
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

              <div style={{ fontSize: '12px', opacity: 0.72, lineHeight: '1.7', textAlign: 'left', padding: '10px 12px', borderRadius: '10px', background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                O pagamento será concluído em um ambiente seguro da <strong>SumUp</strong>. Você poderá escolher a forma disponível para finalizar a sua doação.
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
                  type="submit"
                  disabled={isPreparingCard || isSubmittingCard}
                  style={{ ...buttonStyle, background: '#0066ff', color: '#fff', cursor: (isPreparingCard || isSubmittingCard) ? 'not-allowed' : 'pointer', opacity: (isPreparingCard || isSubmittingCard) ? 0.7 : 1 }}
                >
                  {isPreparingCard && selectedPaymentMethod === 'card' ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
                  {isPreparingCard && selectedPaymentMethod === 'card' ? 'PREPARANDO CARTÃO...' : 'PAGAR COM CARTÃO'}
                </button>
                <button
                  type="button"
                  disabled={isPreparingCard || isSubmittingCard}
                  onClick={() => { void handleStartCheckout('pix'); }}
                  style={{ ...buttonStyle, background: '#10b981', color: '#fff', cursor: (isPreparingCard || isSubmittingCard) ? 'not-allowed' : 'pointer', opacity: (isPreparingCard || isSubmittingCard) ? 0.7 : 1 }}
                >
                  {isPreparingCard && selectedPaymentMethod === 'pix' ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
                  {isPreparingCard && selectedPaymentMethod === 'pix' ? 'PREPARANDO PIX...' : 'PAGAR COM PIX'}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.3s', padding: '20px 0' }}>
            <div style={{ display: 'inline-flex', padding: '20px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', marginBottom: '20px' }}>
              <CheckCircle size={40} />
            </div>
            <h2 style={{ margin: '0 0 15px 0', fontSize: '24px', fontWeight: '600', color: activePalette.titleColor }}>Muito Obrigado!</h2>
            <p style={{ fontSize: '15px', opacity: 0.8, lineHeight: '1.6', marginBottom: '30px' }}>
              Sua contribuição aquece os servidores e incentiva a continuidade destas Reflexos. Agradeço imensamente pelo apoio ao meu trabalho.
            </p>
            <button type="button" onClick={() => { stopPolling(); clearPendingCheckout(); setIsResumingCheckout(false); setSelectedPaymentMethod('card'); setStep(1); onClose(); }} style={buttonStyle}>Fechar</button>
          </div>
        )}

        {step === 4 && cardCheckoutId && (
          <div style={{ animation: 'fadeIn 0.3s', textAlign: 'left' }}>
            <div style={{ textAlign: 'center', marginBottom: '18px' }}>
              <div style={{ display: 'inline-flex', padding: '15px', borderRadius: '50%', backgroundColor: 'rgba(0, 102, 255, 0.12)', color: '#0066ff', marginBottom: '15px' }}>
                <CreditCard size={34} />
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: '700', color: activePalette.titleColor }}>Pagamento Seguro com SumUp</h2>
              <p style={{ fontSize: '13px', opacity: 0.78, lineHeight: '1.7', marginBottom: '10px' }}>
                {isResumingCheckout
                  ? 'Estamos trazendo você de volta ao mesmo ponto da leitura e confirmando a sua doação.'
                  : selectedPaymentMethod === 'pix'
                    ? 'Conclua a sua doação por PIX no ambiente seguro exibido abaixo.'
                    : 'Conclua a sua doação com cartão no formulário seguro exibido abaixo.'}
              </p>
              {cardFlowMessage && (
                <div style={{ fontSize: '12px', opacity: 0.72, padding: '8px 12px', borderRadius: '10px', background: isDarkBase ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
                  {cardFlowMessage}
                </div>
              )}
            </div>

            {isResumingCheckout ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '18px 12px', borderRadius: '16px', background: isDarkBase ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.035)' }}>
                <Loader2 size={22} className="animate-spin" />
                <div style={{ fontSize: '13px', lineHeight: '1.7', textAlign: 'center', opacity: 0.78 }}>
                  Confirmando o pagamento final para levar você diretamente à tela de agradecimento.
                </div>
              </div>
            ) : (
              <SumUpCardWidget
                checkoutId={cardCheckoutId}
                email={sumupEmail.trim()}
                preferredPaymentMethods={selectedWidgetPaymentMethods}
                onPaymentMethodsResolved={(methods) => {
                  const expectedMethods = new Set<string>(selectedWidgetPaymentMethods);
                  const hasExpectedMethod = methods.some((method) => expectedMethods.has(method));
                  if (methods.length > 0 && !hasExpectedMethod) {
                    stopPolling();
                    clearPendingCheckout();
                    setCardCheckoutId(null);
                    setIsPreparingCard(false);
                    setIsSubmittingCard(false);
                    setIsResumingCheckout(false);
                    setCardFlowMessage('');
                    setStep(1);
                    showToast(
                      selectedPaymentMethod === 'pix'
                        ? 'O PIX não está disponível agora para esta doação. Você pode concluir com cartão.'
                        : 'O cartão não está disponível agora para esta doação. Tente novamente.',
                      'error',
                    );
                  }
                }}
                onError={(message) => {
                  setIsPreparingCard(false);
                  setIsSubmittingCard(false);
                  setIsResumingCheckout(false);
                  setCardFlowMessage(message);
                  showToast(message, 'error');
                }}
                onResponse={handleCardWidgetResponse}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
              {isSubmittingCard && (
                <div style={{ fontSize: '12px', opacity: 0.72, textAlign: 'center', lineHeight: '1.7' }}>
                  Estamos confirmando o pagamento. Se a SumUp abrir uma nova etapa, você voltará para o mesmo ponto e seguirá direto para a confirmação da doação.
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  stopPolling();
                  clearPendingCheckout();
                  setCardCheckoutId(null);
                  setIsPreparingCard(false);
                  setIsSubmittingCard(false);
                  setIsResumingCheckout(false);
                  setCardFlowMessage('');
                  setSelectedPaymentMethod('card');
                  setStep(1);
                }}
                style={{ background: 'none', border: 'none', color: activePalette.fontColor, cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', opacity: 0.6, textDecoration: 'underline' }}
              >
                Voltar e revisar dados
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationModal;
