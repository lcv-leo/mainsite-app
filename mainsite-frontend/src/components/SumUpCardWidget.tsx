import { Loader2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './SumUpCardWidget.css';

const SUMUP_CARD_SDK_URL = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';

type SumUpResponseType = 'sent' | 'invalid' | 'auth-screen' | 'error' | 'success' | 'fail';

type SumUpCardResponseHandler = (type: SumUpResponseType | string, body: unknown) => void;

interface SumUpCardWidgetProps {
  checkoutId: string
  email?: string
  preferredPaymentMethods?: string[]
  onPaymentMethodsResolved?: (methods: string[]) => void
  onError?: (message: string) => void
  onResponse?: SumUpCardResponseHandler
}

interface SumUpCardMountInstance {
  submit: () => void
  unmount: () => void
  update: (config: Record<string, unknown>) => void
}

interface SumUpCardNamespace {
  mount: (config: Record<string, unknown>) => SumUpCardMountInstance
}

declare global {
  interface Window {
    SumUpCard?: SumUpCardNamespace
  }
}

let sumUpCardSdkPromise: Promise<void> | null = null;

const loadSumUpCardSdk = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SumUp SDK só pode ser carregado no navegador.'));
  }

  if (window.SumUpCard) {
    return Promise.resolve();
  }

  if (sumUpCardSdkPromise) {
    return sumUpCardSdkPromise;
  }

  sumUpCardSdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SUMUP_CARD_SDK_URL}"]`);

    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Falha ao carregar o SDK da SumUp.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = SUMUP_CARD_SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar o SDK da SumUp.'));
    document.head.appendChild(script);
  });

  return sumUpCardSdkPromise;
};

const normalizePaymentMethodId = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim().toLowerCase();
  }

  if (value && typeof value === 'object') {
    const maybeId = (value as { id?: unknown }).id;
    if (typeof maybeId === 'string' && maybeId.trim()) {
      return maybeId.trim().toLowerCase();
    }
  }

  return null;
};

const extractPaymentMethodIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const methods: string[] = [];

  for (const item of value) {
    const normalized = normalizePaymentMethodId(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    methods.push(normalized);
  }

  return methods;
};

const SumUpCardWidget = ({
  checkoutId,
  email,
  preferredPaymentMethods,
  onPaymentMethodsResolved,
  onError,
  onResponse,
}: SumUpCardWidgetProps) => {
  const mountId = useId().replace(/[:]/g, '');
  const widgetRef = useRef<SumUpCardMountInstance | null>(null);
  const onErrorRef = useRef(onError);
  const onResponseRef = useRef(onResponse);
  const onPaymentMethodsResolvedRef = useRef(onPaymentMethodsResolved);
  const [isLoading, setIsLoading] = useState(true);
  const normalizedPreferredPaymentMethods = useMemo(() => {
    if (!preferredPaymentMethods?.length) return [];

    return preferredPaymentMethods
      .map((method) => method.trim().toLowerCase())
      .filter(Boolean);
  }, [preferredPaymentMethods]);
  const preferredPaymentMethodsKey = normalizedPreferredPaymentMethods.join('|');

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onResponseRef.current = onResponse;
  }, [onResponse]);

  useEffect(() => {
    onPaymentMethodsResolvedRef.current = onPaymentMethodsResolved;
  }, [onPaymentMethodsResolved]);

  useEffect(() => {
    let cancelled = false;

    const mountWidget = async () => {
      setIsLoading(true);

      try {
        await loadSumUpCardSdk();

        if (cancelled) {
          return;
        }

        if (!window.SumUpCard) {
          throw new Error('SDK da SumUp carregado sem expor a API do widget.');
        }

        if (widgetRef.current) {
          widgetRef.current.unmount();
          widgetRef.current = null;
        }

        widgetRef.current = window.SumUpCard.mount({
          id: mountId,
          checkoutId,
          email,
          currency: 'BRL',
          locale: 'pt-BR',
          country: 'BR',
          donateSubmitButton: true,
          showAmount: true,
          showFooter: true,
          showSubmitButton: true,
          onPaymentMethodsLoad: (methods: unknown) => {
            const availableMethods = extractPaymentMethodIds(methods);
            onPaymentMethodsResolvedRef.current?.(availableMethods);

            if (!normalizedPreferredPaymentMethods.length) {
              return availableMethods;
            }

            const preferredSet = new Set(normalizedPreferredPaymentMethods);
            const filteredMethods = availableMethods.filter((method) => preferredSet.has(method));
            return filteredMethods.length ? filteredMethods : availableMethods;
          },
          onLoad: () => {
            if (!cancelled) {
              setIsLoading(false);
            }
          },
          onResponse: (type: string, body: unknown) => {
            onResponseRef.current?.(type, body);
          },
        });
      } catch (error) {
        if (!cancelled) {
          setIsLoading(false);
          onErrorRef.current?.(error instanceof Error ? error.message : 'Falha ao preparar o pagamento seguro.');
        }
      }
    };

    void mountWidget();

    return () => {
      cancelled = true;
      if (widgetRef.current) {
        widgetRef.current.unmount();
        widgetRef.current = null;
      }
    };
  }, [checkoutId, email, mountId, normalizedPreferredPaymentMethods, preferredPaymentMethodsKey]);

  return (
    <div className="sumup-card-widget">
      <div className="sumup-card-widget__loading" hidden={!isLoading}>
        <Loader2 size={20} className="animate-spin" />
        Preparando checkout seguro...
      </div>
      <div id={mountId} className="sumup-card-widget__mount" />
    </div>
  );
};

export default SumUpCardWidget;
