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
    // v0.5: door-to-door duration, changes and the visible arithmetic (B1).
    expect(screen.getByText('Porta a porta').nextElementSibling).toHaveTextContent('39 min');
    expect(screen.getByText('Cambi').nextElementSibling).toHaveTextContent('Nessuno');
    expect(screen.getByRole('note', { name: /Come abbiamo calcolato/ })).toHaveTextContent(
      'In stazione a Modena FS entro le 07:58lezione alle 08:30 − 10 min di anticipo − 22 min in bici',
    );
    // C2: real-time check links + "non in tempo reale".
    const realtime = screen.getByRole('region', { name: 'Controlla ritardi e scioperi' });
    expect(realtime).toHaveTextContent('non in tempo reale');
    expect(within(realtime).getByRole('link', { name: /ViaggiaTreno/ })).toHaveAttribute(
      'href',
      'http://www.viaggiatreno.it/infomobilita/index.jsp',
    );
    expect(realtime).toHaveTextContent('Cerca il treno 3907');
  });

  it('spiega l’anticipo con un aiuto al tocco', async () => {
    const user = userEvent.setup();
    render(
      <ResultPanel
        status="success"
        result={demo}
        error={null}
        onRetry={vi.fn()}
        context={{ ...context, marginMin: 10 }}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Che cos’è: Anticipo' }));
    expect(screen.getByText(/Comprende l’anticipo minimo che hai scelto \(10 min\)/)).toBeVisible();
  });

  it('il ritorno usa "Parti alle"; annidato sotto l’andata usa un h3', () => {
    const response: PlanResponse = { ...demo, planner: 'depart_after' };
    const { rerender } = render(
      <ResultPanel status="success" result={response} error={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Parti alle 07:39' })).toBeInTheDocument();
    expect(screen.getByText('Tempo dopo la lezione')).toBeInTheDocument();
    rerender(
      <ResultPanel status="success" result={response} error={null} onRetry={vi.fn()} nested />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Parti alle 07:39' })).toBeInTheDocument();
    rerender(<ResultPanel status="idle" result={null} error={null} onRetry={vi.fn()} nested />);
    expect(screen.queryByText('Il tuo tragitto, senza corse')).not.toBeInTheDocument();
  });

  it('mostra gli spazi per azioni e piè di pagina', () => {
    render(
      <ResultPanel
        status="success"
        result={demo}
        error={null}
        onRetry={vi.fn()}
        actions={<button type="button">Azione</button>}
        footer={<p>Ritorno qui</p>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Azione' })).toBeInTheDocument();
    expect(screen.getByText('Ritorno qui')).toBeInTheDocument();
  });

  it('badge biglietto diverso; avvisi (warning) in evidenza, informazioni nella nota', () => {
    const response: PlanResponse = {
      ...demo,
      itineraries: [withFrecciarossa(demo.itineraries[0])],
      notices: [
        { code: 'calendar_note', level: 'warning', message: 'RV 3907: circola solo dal 17/11.' },
        { code: 'festive_day', level: 'info', message: 'L’8/12/2026 è festivo (Immacolata).' },
        demo.notices![0],
      ],
    };
    render(<ResultPanel status="success" result={response} error={null} onRetry={vi.fn()} />);
    expect(screen.getAllByText('Biglietto diverso / supplemento').length).toBeGreaterThan(0);
    expect(screen.getByRole('alert')).toHaveTextContent('circola solo dal 17/11');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(
      screen.getByText('L’8/12/2026 è festivo (Immacolata).').closest('[role="note"]'),
    ).not.toBeNull();
  });

  it('con una risposta v0.4 (solo warnings) ricava gli avvisi dal testo', () => {
    const legacy: PlanResponse = {
      itineraries: demo.itineraries,
      warnings: [demo.warnings[0], 'La data è oltre la validità dell’orario caricato.'],
    };
    render(<ResultPanel status="success" result={legacy} error={null} onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('oltre la validità');
    expect(screen.getByRole('region', { name: 'Controlla ritardi e scioperi' })).toHaveTextContent(
      demo.warnings[0],
    );
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

  it('domenica senza treno utile (B1/C4): titolo chiaro, calcolo, un solo avviso e il treno del giorno feriale', () => {
    const sunday: PlanResponse = {
      planner: 'arrive_by',
      itineraries: [],
      calculation: {
        station: 'Modena FS',
        time: '08:31',
        summary:
          'Calcolo: lezione alle 09:00 − 10 min di anticipo − 19 min a piedi dalla stazione alla sede = arrivo a Modena FS entro le 08:31.',
      },
      nearby: [
        {
          kind: 'next',
          itinerary: { ...demo.itineraries[0], date: '2026-10-26' },
          label: 'Primo giorno feriale con treni: lunedì 26/10/2026, stessa ora di lezione.',
        },
        { kind: 'next', itinerary: { ...demo.itineraries[1], date: '2026-10-27' } },
      ],
      notices: [
        {
          code: 'no_service',
          level: 'warning',
          message: 'Domenica 25/10/2026: nessun treno arriva a Modena FS tra le 06:31 e le 08:31.',
        },
        demo.notices![0],
      ],
      warnings: [],
    };
    render(
      <ResultPanel
        status="empty"
        result={sunday}
        error={null}
        onRetry={vi.fn()}
        context={{ ...context, date: '2026-10-25', time: '09:00' }}
      />,
    );
    expect(
      screen.getByText(/nessun treno arriva a Modena FS tra le 06:31 e le 08:31/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('note', { name: /Come abbiamo calcolato/ })).toHaveTextContent(
      'lezione alle 09:00 − 10 min di anticipo − 19 min a piedi',
    );
    expect(screen.getByText(/Primo giorno feriale con treni: lunedì 26\/10/)).toBeInTheDocument();
    expect(screen.getAllByText(/Soluzione successiva/)).toHaveLength(2);
  });

  it('gestisce idle, caricamento ed errore con retry', async () => {
    const user = userEvent.setup();
    const retry = vi.fn();
    const { rerender } = render(
      <ResultPanel status="idle" result={null} error={null} onRetry={retry} />,
    );
    expect(screen.getByText('Il tuo tragitto, senza corse')).toBeInTheDocument();
    expect(screen.getByText(/premi/)).toHaveTextContent('premi Calcola');
    rerender(<ResultPanel status="loading" result={null} error={null} onRetry={retry} />);
    expect(screen.getByRole('status', { name: /Calcolo del percorso/ })).toBeInTheDocument();
    rerender(
      <ResultPanel status="error" result={null} error="Connessione interrotta" onRetry={retry} />,
    );
    await user.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
