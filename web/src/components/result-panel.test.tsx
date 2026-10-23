import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ResultPanel } from './result-panel';

const result = {
  itineraries: [
    {
      leave_at: '07:34',
      arrive_at: '08:18',
      slack_min: 12,
      legs: [
        {
          type: 'bike' as const,
          from: 'Casa',
          to: 'Stazione',
          depart: '07:34',
          arrive: '07:48',
          minutes: 14,
        },
      ],
    },
  ],
  warnings: ['Orari dimostrativi.'],
};

describe('ResultPanel', () => {
  it('mostra il grande orario d’uscita, l’arrivo, il margine e l’avviso', () => {
    render(
      <ResultPanel
        status="success"
        result={result}
        error={null}
        onRetry={vi.fn()}
        lessonDateTime="2026-10-26T08:30:00+01:00"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Esci alle 07:34' })).toBeInTheDocument();
    expect(screen.getByText('08:18')).toBeInTheDocument();
    expect(screen.getByText('12 min')).toBeInTheDocument();
    expect(screen.getByText('Orari dimostrativi.')).toBeInTheDocument();
    expect(screen.getByText(/lunedì 26 ottobre/)).toBeInTheDocument();
  });

  it('espone il retry nello stato di errore e il vuoto senza itinerari', () => {
    const retry = vi.fn();
    const { rerender } = render(
      <ResultPanel status="error" result={null} error="Connessione interrotta" onRetry={retry} />,
    );
    screen.getByRole('button', { name: 'Riprova' }).click();
    expect(retry).toHaveBeenCalledOnce();
    rerender(
      <ResultPanel
        status="empty"
        result={{ itineraries: [], warnings: [] }}
        error={null}
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nessun treno trovato' })).toBeInTheDocument();
  });
});
