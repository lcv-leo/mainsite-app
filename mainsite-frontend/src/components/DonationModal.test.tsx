/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DonationModal from './DonationModal';

vi.mock('./SumUpCardWidget', () => ({
  default: ({ preferredPaymentMethods }: { preferredPaymentMethods?: string[] }) => (
    <div data-testid="sumup-widget" data-methods={(preferredPaymentMethods || []).join(',')} />
  ),
}));

const ACTIVE_PALETTE = {
  bgColor: '#ffffff',
  fontColor: '#111111',
  titleColor: '#0066ff',
  buttonColor: '#0066ff',
  accentColor: '#10b981',
  contentBgColor: '#ffffff',
  cardBgColor: '#ffffff',
  glassBgColor: 'rgba(255,255,255,0.8)',
  borderColor: 'rgba(0,0,0,0.1)',
  mutedColor: '#666666',
};

describe('DonationModal', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let scrollToMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    scrollToMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: scrollToMock,
      writable: true,
    });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 480,
      writable: true,
    });
    sessionStorage.clear();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  const renderModal = (resumeCheckoutId?: string | null) => render(
    <DonationModal
      show
      onClose={() => {}}
      activePalette={ACTIVE_PALETTE}
      API_URL="/api"
      resumeCheckoutId={resumeCheckoutId}
    />,
  );

  const fillBaseForm = () => {
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Leonardo' } });
    fireEvent.change(screen.getByLabelText('Sobrenome'), { target: { value: 'Vargas' } });
    fireEvent.change(screen.getByLabelText('Valor da doação'), { target: { value: '1500' } });
    fireEvent.change(screen.getByLabelText('E-mail para recibo e confirmação'), { target: { value: 'leo@example.com' } });
  };

  it('creates a card checkout without redirectUrl to keep 3DS inside the widget', async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sumupRate: 0.0399, sumupFixed: 0.39 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ checkoutId: 'chk-card' }) });

    renderModal();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fillBaseForm();
    fireEvent.click(screen.getByRole('button', { name: /pagar com cartão/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, requestInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));

    expect(body.redirectUrl).toBeUndefined();
    expect(screen.getByTestId('sumup-widget').getAttribute('data-methods')).toBe('card');
  });

  it('creates a PIX checkout with redirectUrl and persists the reader context for the way back', async () => {
    window.history.replaceState({}, '', '/p/42?origem=apoio#leitura');

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sumupRate: 0.0399, sumupFixed: 0.39 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ checkoutId: 'chk-pix' }) });

    renderModal();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fillBaseForm();
    fireEvent.click(screen.getByRole('button', { name: /pagar com pix/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [, requestInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(String(requestInit.body));
    const persisted = JSON.parse(String(sessionStorage.getItem('mainsite:sumup:pending-donation')));

    expect(body.redirectUrl).toContain('/p/42?origem=apoio#leitura');
    expect(persisted.paymentMethod).toBe('pix');
    expect(persisted.scrollY).toBe(480);
    expect(screen.getByTestId('sumup-widget').getAttribute('data-methods')).toBe('pix,qr_code_pix');
  });

  it('resumes by checkout_id, restores the saved viewport context, and lands on the thank-you state', async () => {
    sessionStorage.setItem(
      'mainsite:sumup:pending-donation',
      JSON.stringify({
        checkoutId: 'chk-return',
        firstName: 'Leonardo',
        lastName: 'Vargas',
        email: 'leo@example.com',
        amountDisplay: '15,00',
        coverFees: false,
        paymentMethod: 'pix',
        scrollY: 320,
      }),
    );

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ sumupRate: 0.0399, sumupFixed: 0.39 }) })
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'PAID' }) });

    renderModal('chk-return');

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    await waitFor(() => expect(screen.getByText('Muito Obrigado!')).toBeTruthy());
    expect(scrollToMock).toHaveBeenCalled();
  });
});
