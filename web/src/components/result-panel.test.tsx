import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { Itinerary, PlanResponse } from '@/lib/api/types';
import { ResultPanel } from './result-panel';

const demo = fixtures.demo.response as PlanResponse;
const context = {
  planner: 'arrive_by' as const,
  date: '2026-10-26',
  time: '08:30',
  campusName: 'DIEF',
};

const withFrecciarossa = (itinerary: Itinerary): Itinerary => ({
  ...itinerary,
  legs: itinerary.legs.map((leg) =>
    leg.type === 'train'
      ? { ...leg, train: { ...leg.train!, code: 'FR', number: '9505', different_ticket: true } }
      : leg,
  ),
});

describe('ResultPanel', () => {
  it('mette in evidenza ora di uscita, treno, attesa in stazione, arrivo e anticipo', () => {
    render(
      <ResultPanel
        status="success"
        result={demo}
        error={null}
        onRetry={vi.fn()}
        context={context}
      />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Esci alle 07:39' })).toBeInTheDocument();
    expect(
      screen.getByText(/RV 3907 alle 07:44 da Reggio Emilia · 5 min in stazione/),
    ).toBeInTheDocument();
    expect(screen.getByText(/lun 26 ott · lezione alle 08:30/i)).toBeInTheDocument();
    expect(screen.getByText('08:18')).toBeInTheDocument();
    expect(screen.getByText('12 min')).toBeInTheDocument();
    expect(screen.getByText('prima dell’inizio')).toBeInTheDocument();
    expect(screen.queryByText('Biglietto diverso / supplemento')).not.toBeInTheDocument();
    // Two alternatives, collapsed.
    expect(screen.getByText(/Esci alle 07:28 · R 17405/)).toBeInTheDocument();
    expect(screen.getByText(demo.warnings[0])).toBeInTheDocument();
  });

  it('il ritorno usa "Parti alle" e "A casa alle"', () => {
    const response: PlanResponse = { ...demo, planner: 'depart_after' };
    render(<ResultPanel status="success" result={response} error={null} onRetry={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Parti alle 07:39' })).toBeInTheDocument();
    expect(screen.getByText('A casa alle')).toBeInTheDocument();
  });

  it('mostra il badge biglietto diverso per FR/IC e gli avvisi critici in evidenza', () => {
    const response: PlanResponse = {
      ...demo,
      itineraries: [withFrecciarossa(demo.itineraries[0])],
      warnings: [
        demo.warnings[0],
        'Attenzione: la data 08/12/2026 è festiva (Immacolata Concezione).',
      ],
    };
    render(<ResultPanel status="success" result={response} error={null} onRetry={vi.fn()} />);
    expect(screen.getAllByText('Biglietto diverso / supplemento').length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('Immacolata');
  });

  it('un percorso senza treno lo dice esplicitamente', () => {
    const bikeOnly: PlanResponse = {
      ...demo,
      itineraries: [{ ...demo.itineraries[0], legs: [demo.itineraries[0].legs[2]] }],
    };
    render(<ResultPanel status="success" result={bikeOnly} error={null} onRetry={vi.fn()} />);
    expect(screen.getByText('Diretto in bici, senza treno')).toBeInTheDocument();
  });

  it('senza treni utili spiega il motivo e propone le soluzioni vicine', async () => {
    const user = userEvent.setup();
    const empty: PlanResponse = {
      planner: 'arrive_by',
      itineraries: [],
      nearby: [{ kind: 'previous', itinerary: { ...demo.itineraries[0], date: '2026-12-12' } }],
      warnings: [
        demo.warnings[0],
        'Nessun treno utile per arrivare in tempo il 14/12/2026 alle 08:30.',
        'Attenzione: la data 14/12/2026 è oltre la validità dell’orario caricato (fino al 12/12/2026).',
      ],
    };
    render(
      <ResultPanel
        status="empty"
        result={empty}
        error={null}
        onRetry={vi.fn()}
        context={{ ...context, date: '2026-12-14' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Nessun treno utile' })).toBeInTheDocument();
    expect(
      screen.getByText(/Nessun treno utile per arrivare in tempo il 14\/12/),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('oltre la validità');
    const card = screen.getByText(/Soluzione precedente · sab 12 dic/).closest('details')!;
    expect(within(card).getByText(/Esci alle 07:39 · RV 3907/)).toBeInTheDocument();
    // No cross-day slack such as "33 h prima dell’inizio".
    expect(within(card).getByText(/^arrivo 08:18$/)).toBeInTheDocument();
    await user.click(within(card).getByText(/Soluzione precedente/));
    expect(card).toHaveAttribute('open');
  });

  it('gestisce idle, caricamento ed errore con retry', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <ResultPanel status="idle" result={null} error={null} onRetry={retry} />,
    );
    expect(screen.getByText('Il tuo tragitto, senza corse')).toBeInTheDocument();
    rerender(<ResultPanel status="loading" result={null} error={null} onRetry={retry} />);
    expect(screen.getByRole('status', { name: /Calcolo del percorso/ })).toBeInTheDocument();
    rerender(
      <ResultPanel status="error" result={null} error="Connessione interrotta" onRetry={retry} />,
    );
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
