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
    expect(screen.getByText(/lun 26 ott 2026 · lezione alle 08:30/i)).toBeInTheDocument();
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
    const realtime = screen.getByRole('heading', {
      name: 'Controlla ritardi e scioperi',
    }).parentElement!;
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

  it('il ritorno usa "Parti alle"; annidato sotto l’andata usa un h3', async () => {
    const user = userEvent.setup();
    const response: PlanResponse = { ...demo, planner: 'depart_after' };
    const { rerender } = render(
      <ResultPanel status="success" result={response} error={null} onRetry={vi.fn()} />,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Parti alle 07:39' })).toBeInTheDocument();
    // Round 4, point 7: self-explaining name plus a one-line tooltip.
    expect(screen.queryByText('Tempo per uscire dall’aula')).not.toBeInTheDocument();
    expect(screen.getByText('Minuti per lasciare la sede dopo la lezione')).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Che cos’è: Minuti per lasciare la sede dopo la lezione',
      }),
    );
    expect(
      screen.getByText(
        'Tempo tra la fine della lezione e l’uscita dalla sede per prendere questo treno.',
      ),
    ).toBeVisible();
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
    expect(
      screen.getByRole('heading', { name: 'Controlla ritardi e scioperi' }).parentElement!,
    ).toHaveTextContent(demo.warnings[0]);
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
    // B2/B3: no result for the date, so no calculation box: the formula is
    // explained once, inside the no-service notice (from the API).
    expect(screen.queryByRole('note', { name: /Come abbiamo calcolato/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/arrivo a Modena FS entro le 08:31/)).not.toBeInTheDocument();
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

describe('ResultPanel: round 3', () => {
  const outOfValidity: PlanResponse = {
    planner: 'arrive_by',
    itineraries: [],
    calculation: {
      station: 'Reggio Emilia FS',
      time: '08:31',
      summary: 'Calcolo: … = arrivo in stazione entro le 08:31.',
    },
    nearby: [
      {
        kind: 'previous',
        itinerary: { ...demo.itineraries[0], date: '2026-12-12' },
        label: 'Stessa ora di lezione, sab 12 dic 2026 (giorno feriale precedente).',
      },
    ],
    notices: [
      {
        code: 'out_of_validity',
        level: 'warning',
        message:
          'Dom 20 dic 2026 è dopo la fine di validità dell’orario caricato (valido dal sab 17 ott 2026 al sab 12 dic 2026).',
      },
    ],
    warnings: [],
  };

  it('fuori validità (20/12): solo l’avviso unico e la soluzione vicina, nessun riquadro di calcolo (B2)', () => {
    render(
      <ResultPanel
        status="empty"
        result={outOfValidity}
        error={null}
        onRetry={vi.fn()}
        context={{ ...context, date: '2026-12-20' }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('dopo la fine di validità');
    expect(screen.queryByText(/entro le 08:31/)).not.toBeInTheDocument();
    expect(screen.queryByRole('note', { name: /Come abbiamo calcolato/ })).not.toBeInTheDocument();
    // No generic "prova un altro orario" next to the precise notice.
    expect(screen.queryByText(/Prova un altro orario/)).not.toBeInTheDocument();
    expect(screen.getByText(/Soluzione precedente · sab 12 dic 2026/)).toBeInTheDocument();
  });

  it('primo treno dopo: un solo testo coerente, senza "4 min prima" ripetuto (B4)', () => {
    const late: PlanResponse = {
      planner: 'arrive_by',
      itineraries: [],
      nearby: [
        {
          kind: 'next',
          itinerary: { ...demo.itineraries[0], date: '2026-10-25', slack_min: 4 },
          label:
            'Primo treno dopo: arrivi in sede 4 min prima dell’inizio della lezione, meno dei 10 min di anticipo che hai scelto.',
        },
      ],
      notices: [],
      warnings: [],
    };
    render(
      <ResultPanel
        status="empty"
        result={late}
        error={null}
        onRetry={vi.fn()}
        context={{ ...context, date: '2026-10-25' }}
      />,
    );
    const card = screen.getByText(/Soluzione successiva/).closest('details')!;
    expect(within(card).getByText(/^arrivo 08:18$/)).toBeInTheDocument();
    expect(within(card).getAllByText(/4 min prima/)).toHaveLength(1);
    expect(card).not.toHaveTextContent(/ritardo/);
  });

  it('domenica: etichetta festivi accanto al treno e nelle alternative (round 4, punto 4)', () => {
    const flag = (itinerary: Itinerary): Itinerary => ({
      ...itinerary,
      legs: itinerary.legs.map((leg) =>
        leg.type === 'train' ? { ...leg, train: { ...leg.train!, festive_unverified: true } } : leg,
      ),
    });
    const sunday: PlanResponse = {
      ...demo,
      itineraries: [flag(demo.itineraries[0]), flag(demo.itineraries[0])],
    };
    render(
      <ResultPanel
        status="success"
        result={sunday}
        error={null}
        onRetry={vi.fn()}
        context={context}
      />,
    );
    const banner = document.querySelector('.result-banner')!;
    expect(
      within(banner as HTMLElement).getByText('Circolazione nei festivi da verificare'),
    ).toBeVisible();
    expect(
      screen.getByText(/circolazione nei festivi da verificare/, { selector: 'summary span' }),
    ).toBeInTheDocument();
  });

  it('senza flag nessuna etichetta festivi; attese lunghe in ore e minuti', () => {
    const longWait: PlanResponse = {
      ...demo,
      itineraries: [
        {
          ...demo.itineraries[0],
          legs: demo.itineraries[0].legs.map((leg) =>
            leg.type === 'wait' ? { ...leg, minutes: 65 } : leg,
          ),
        },
      ],
    };
    render(<ResultPanel status="success" result={longWait} error={null} onRetry={vi.fn()} />);
    expect(screen.queryByText(/festivi da verificare/i)).not.toBeInTheDocument();
    expect(screen.getByText(/· 1 h 5 min in stazione/)).toBeInTheDocument();
  });

  it('suggerimento bici: messaggio e pulsante "Usa la bici" (round 4, punto 2)', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    const suggestion = {
      mode: 'bike' as const,
      minutes: 22,
      message: 'In bici circa 22 min (a piedi 53 min).',
    };
    const { rerender } = render(
      <ResultPanel
        status="success"
        result={{ ...demo, suggestion }}
        error={null}
        onRetry={vi.fn()}
        onUseSuggestion={onUse}
      />,
    );
    expect(screen.getByText(suggestion.message)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Usa la bici' }));
    expect(onUse).toHaveBeenCalledWith(suggestion);
    rerender(
      <ResultPanel
        status="success"
        result={{ ...demo, suggestion: null }}
        error={null}
        onRetry={vi.fn()}
        onUseSuggestion={onUse}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Usa la bici' })).not.toBeInTheDocument();
  });

  it('una fine lezione proposta è sempre dichiarata, anche senza treni (round 4, punto 5)', () => {
    const proposal =
      'Proposta: inizio lezione + 2 ore (11:00). Modificala con l’orario reale di fine lezione.';
    render(
      <ResultPanel
        status="empty"
        result={{ ...demo, itineraries: [], calculation: null }}
        error={null}
        onRetry={vi.fn()}
        context={{ ...context, planner: 'depart_after', time: '11:00', proposal }}
      />,
    );
    expect(screen.getByText(proposal)).toBeVisible();
  });
});
