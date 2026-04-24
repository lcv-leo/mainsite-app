import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage from './AboutPage';

describe('AboutPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders an empty state without throwing when content is absent', () => {
    render(<AboutPage about={null} onBack={() => {}} zoomLevel={1} />);

    expect(screen.getByRole('article', { name: 'Sobre Este Site' })).toBeTruthy();
    expect(screen.getByText('Ainda não há conteúdo.')).toBeTruthy();
  });

  it('sanitizes unsafe html and keeps the back action wired', () => {
    const onBack = vi.fn();
    const { container } = render(
      <AboutPage
        about={{
          id: 1,
          title: 'Sobre Este Site',
          content: '<p>Texto</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
        }}
        onBack={onBack}
        zoomLevel={1}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Sobre Este Site' })).toBeTruthy();
    expect(container.innerHTML).toContain('<p>Texto</p>');
    expect(container.innerHTML).not.toContain('<script');
    expect(container.innerHTML).not.toContain('javascript:');

    fireEvent.click(screen.getByRole('button', { name: /home page/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
