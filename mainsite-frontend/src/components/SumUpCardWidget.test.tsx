/*
 * Copyright (C) 2026 Leonardo Cardozo Vargas
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SumUpCardWidget from './SumUpCardWidget';

describe('SumUpCardWidget', () => {
  let mountMock: ReturnType<typeof vi.fn>;
  let unmountMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    unmountMock = vi.fn();
    mountMock = vi.fn((config: Record<string, unknown>) => {
      const onLoad = config.onLoad as (() => void) | undefined;
      onLoad?.();
      return {
        submit: vi.fn(),
        unmount: unmountMock,
        update: vi.fn(),
      };
    });

    window.SumUpCard = {
      mount: mountMock,
    };
  });

  afterEach(() => {
    delete window.SumUpCard;
    vi.restoreAllMocks();
  });

  it('filters the widget payment methods to the preferred allowlist', async () => {
    const resolvedMethods = vi.fn();

    render(
      <SumUpCardWidget
        checkoutId="checkout-1"
        preferredPaymentMethods={['card']}
        onPaymentMethodsResolved={resolvedMethods}
      />,
    );

    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));
    const config = mountMock.mock.calls[0]?.[0] as {
      onPaymentMethodsLoad?: (methods: unknown) => string[];
      showAmount?: boolean;
      amount?: unknown;
    };
    const filteredMethods = config.onPaymentMethodsLoad?.([{ id: 'card' }, { id: 'pix' }]) || [];

    expect(filteredMethods).toEqual(['card']);
    expect(resolvedMethods).toHaveBeenCalledWith(['card', 'pix']);
    expect(config.showAmount).toBe(true);
    expect(config.amount).toBeUndefined();
  });

  it('keeps the widget mounted when the preferred allowlist keeps the same values', async () => {
    const { rerender } = render(<SumUpCardWidget checkoutId="checkout-1" preferredPaymentMethods={['card']} />);

    await waitFor(() => expect(mountMock).toHaveBeenCalledTimes(1));

    rerender(<SumUpCardWidget checkoutId="checkout-1" preferredPaymentMethods={['card']} />);

    await Promise.resolve();
    await Promise.resolve();

    expect(mountMock).toHaveBeenCalledTimes(1);
    expect(unmountMock).not.toHaveBeenCalled();
  });
});
