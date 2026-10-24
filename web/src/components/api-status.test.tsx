import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiStatus, CONNECTING_DELAY_MS } from './api-status';

describe('ApiStatus (round 5, punto 5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('avvio veloce: nessun "Connessione…" visibile, poi "API collegata" nello stesso spazio', () => {
    const { rerender } = render(<ApiStatus demoMode={false} online={false} loading />);
    const pill = screen.getByTestId('api-status');
    // Present in the layout (no shift) but invisible and hidden from screen readers.
    expect(pill).toHaveClass('invisible');
    expect(pill).toHaveAttribute('aria-hidden', 'true');
    act(() => vi.advanceTimersByTime(CONNECTING_DELAY_MS - 100));
    expect(pill).toHaveClass('invisible');
    rerender(<ApiStatus demoMode={false} online loading={false} />);
    expect(screen.getByTestId('api-status')).toBe(pill);
    expect(pill).not.toHaveClass('invisible');
    expect(pill).not.toHaveAttribute('aria-hidden');
    expect(pill).toHaveTextContent('API collegata');
    expect(pill).toHaveClass('status-online');
  });

  it('attesa lunga: "Connessione…" solo dopo 500 ms', () => {
    render(<ApiStatus demoMode={false} online={false} loading />);
    const pill = screen.getByTestId('api-status');
    act(() => vi.advanceTimersByTime(CONNECTING_DELAY_MS));
    expect(pill).not.toHaveClass('invisible');
    expect(pill).toHaveTextContent('Connessione…');
  });

  it('errore e modalità mock si vedono subito', () => {
    const { rerender } = render(<ApiStatus demoMode={false} online={false} loading={false} />);
    expect(screen.getByTestId('api-status')).toHaveTextContent('API non raggiungibile');
    expect(screen.getByTestId('api-status')).not.toHaveClass('invisible');
    rerender(<ApiStatus demoMode online={false} loading />);
    expect(screen.getByTestId('api-status')).toHaveTextContent('Dati registrati');
    expect(screen.getByTestId('api-status')).not.toHaveClass('invisible');
  });
});
