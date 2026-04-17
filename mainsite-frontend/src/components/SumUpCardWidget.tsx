import { Loader2 } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import './SumUpCardWidget.css';

const SUMUP_CARD_SDK_URL = 'https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js';

type SumUpResponseType = 'sent' | 'invalid' | 'auth-screen' | 'error' | 'success' | 'fail';

type SumUpCardResponseHandler = (type: SumUpResponseType | string, body: unknown) => void;

interface SumUpCardWidgetProps {
  checkoutId: string
  email?: string
  amount?: string
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

const SumUpCardWidget = ({
  checkoutId,
  email,
  amount,
  onError,
  onResponse,
}: SumUpCardWidgetProps) => {
  const mountId = useId().replace(/[:]/g, '');
  const widgetRef = useRef<SumUpCardMountInstance | null>(null);
  const onErrorRef = useRef(onError);
  const onResponseRef = useRef(onResponse);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    onResponseRef.current = onResponse;
  }, [onResponse]);

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
          amount,
          currency: 'BRL',
          locale: 'pt-BR',
          country: 'BR',
          donateSubmitButton: true,
          showFooter: true,
          showSubmitButton: true,
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
  }, [checkoutId, email, amount, mountId]);

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
