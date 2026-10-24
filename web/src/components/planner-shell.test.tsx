import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { PlanService } from '@/lib/api/plan-service';
import type { PlanResponse } from '@/lib/api/types';
import { INVALID_LINK_MESSAGE, prefillMessage, PlannerShell } from './planner-shell';

const service = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getCampuses: vi.fn(),
  getStations: vi.fn(),
  createPlan: vi.fn(),
  geocode: vi.fn(),
}));

vi.mock('@/lib/api/plan-service', () => ({
  createPlanService: (): PlanService => service as unknown as PlanService,
}));
// Leaflet needs a real browser; the map has its own geometry tests.
vi.mock('./map-panel', () => ({
  MapPanel: ({
    route,
    view,
  }: {
    route: { points: { label: string }[] };
    view?: { active: string; onChange: (view: 'outbound' | 'return') => void };
  }) => (
    <div data-testid="map">
      <p data-testid="map-points">
        {route.points.length} punti: {route.points.map((point) => point.label).join(' → ')}
      </p>
      {view && (
        <p>
          vista {view.active}
          <button type="button" onClick={() => view.onChange('outbound')}>
            Mappa andata
          </button>
          <button type="button" onClick={() => view.onChange('return')}>
            Mappa ritorno
          </button>
        </p>
      )}
    </div>
  ),
}));

const PREFS = 'unimorego.planner.v1';
const SHARED =
  '/?sede=palazzo_dossetti&stazione=modena_fs&data=2026-10-25&ora=09%3A00&mezzo=piedi&verso=andata';
const demo = fixtures.demo.response as PlanResponse;
/** Return trip of the demo: DIEF → Modena FS (bike), train Modena → Reggio Emilia. */
const demoReturn: PlanResponse = {
  ...demo,
  planner: 'depart_after',
  itineraries: [
    {
      ...demo.itineraries[0],
      legs: [
        { ...demo.itineraries[0].legs[2], from: 'DIEF', to: 'Modena FS' },
        { ...demo.itineraries[0].legs[1], from: 'Modena', to: 'Reggio Emilia' },
      ],
    },
  ],
};
const mapPoints = () => screen.getByTestId('map-points').textContent;
const goBack = () => {
  window.history.back();
};

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  service.getHealth.mockResolvedValue(fixtures.health);
  service.getCampuses.mockResolvedValue(fixtures.campuses);
  service.getStations.mockResolvedValue(fixtures.stations);
  service.createPlan.mockResolvedValue(demo);
  service.geocode.mockResolvedValue({ results: [], attribution: '' });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const formReady = () => screen.findByRole('button', { name: /Calcola quando uscire/ });

describe('PlannerShell: niente risultato finché non si preme Calcola (B2)', () => {
  it('all’apertura mostra solo il modulo; il calcolo parte al clic e aggiorna l’URL', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    const submit = await formReady();
    expect(screen.getByText('Il tuo tragitto, senza corse')).toBeInTheDocument();
    expect(service.createPlan).not.toHaveBeenCalled();
    expect(window.location.search).toBe('');
    expect(screen.getByText('Oggi')).toBeInTheDocument();
    expect(screen.getByTestId('map')).toHaveTextContent('2 punti');

    await user.click(submit);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' }),
    ).toBeInTheDocument();
    expect(service.createPlan).toHaveBeenCalledOnce();
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({
      origin: { station_id: 'reggio_fs' },
      station_buffer_min: 5,
      train_categories: ['regional'],
    });
    expect(window.location.search).toMatch(
      /^\?sede=dief&stazione=reggio_fs&data=\d{4}-\d\d-\d\d&ora=08%3A30&mezzo=bici&verso=andata$/,
    );
    // DOM (= mobile) order: form, result, map, schedule (C7, B6).
    const ids = ['plan-form', 'result', 'map'].map(
      (id) => document.getElementById(id) ?? screen.getByTestId(id),
    );
    expect(ids[0].compareDocumentPosition(ids[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ids[1].compareDocumentPosition(ids[2]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('map')).toHaveTextContent('3 punti');
    expect(screen.getByRole('button', { name: 'Copia link' })).toBeInTheDocument();
  });

  it('dopo il ricaricamento ricorda sede, stazione, mezzo e anticipo; la data è oggi', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      PREFS,
      JSON.stringify({
        campusId: 'economia_biagi',
        stationId: 'rubiera',
        mode: 'walk',
        marginMin: 20,
        stationBufferMin: 10,
        regionalOnly: false,
        date: '2020-01-01',
      }),
    );
    render(<PlannerShell />);
    await user.click(await formReady());
    await waitFor(() => expect(service.createPlan).toHaveBeenCalled());
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({
      campus_id: 'economia_biagi',
      origin: { station_id: 'rubiera' },
      mode: 'walk',
      margin_min: 20,
      station_buffer_min: 10,
      train_categories: ['regional', 'intercity', 'high_speed'],
    });
    expect(service.createPlan.mock.calls[0][0].arrive_by).not.toContain('2020-01-01');
    expect(screen.getByRole('button', { name: 'A piedi' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('PlannerShell: ricerca nell’URL (B3)', () => {
  it('un link condiviso calcola subito, senza toccare le preferenze salvate', async () => {
    window.localStorage.setItem(PREFS, JSON.stringify({ campusId: 'dief', mode: 'bike' }));
    window.history.replaceState(null, '', SHARED);
    render(<PlannerShell />);
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledOnce());
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({
      campus_id: 'palazzo_dossetti',
      origin: { station_id: 'modena_fs' },
      arrive_by: '2026-10-25T09:00:00+01:00',
      mode: 'walk',
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' }),
    ).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(PREFS)!)).toMatchObject({
      campusId: 'dief',
      mode: 'bike',
    });
  });

  it('un link con una sede sconosciuta non calcola e lo dice', async () => {
    window.history.replaceState(null, '', '/?sede=inesistente&data=2026-10-26&ora=08%3A30');
    render(<PlannerShell />);
    expect(await screen.findByText(INVALID_LINK_MESSAGE)).toBeInTheDocument();
    expect(service.createPlan).not.toHaveBeenCalled();
  });

  it('Indietro e Avanti ripristinano la ricerca della voce di cronologia', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    await user.click(await formReady());
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    await user.click(screen.getByRole('button', { name: 'A piedi' }));
    await user.click(screen.getByRole('button', { name: /Calcola quando uscire/ }));
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledTimes(2));
    expect(window.location.search).toContain('mezzo=piedi');

    goBack();
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledTimes(3));
    expect(service.createPlan.mock.calls[2][0]).toMatchObject({ mode: 'bike' });
    expect(screen.getByRole('button', { name: 'In bici' })).toHaveAttribute('aria-pressed', 'true');

    goBack();
    await waitFor(() =>
      expect(screen.getByText('Il tuo tragitto, senza corse')).toBeInTheDocument(),
    );
    expect(service.createPlan).toHaveBeenCalledTimes(3);

    window.history.forward();
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledTimes(4));
    expect(service.createPlan.mock.calls[3][0]).toMatchObject({ mode: 'bike' });
  });
});

describe('PlannerShell: andata e ritorno (C3)', () => {
  it('"Calcola il ritorno" usa le stesse impostazioni e una fine lezione modificabile', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    await user.click(await formReady());
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    const returnBox = screen.getByRole('region', { name: 'E per tornare?' });
    const hours = within(returnBox).getByRole('combobox', { name: 'Ore' });
    expect(hours).toHaveValue('10');
    await user.selectOptions(hours, '13');
    service.createPlan.mockResolvedValueOnce({ ...demo, planner: 'depart_after' });
    await user.click(within(returnBox).getByRole('button', { name: 'Calcola il ritorno' }));
    expect(
      await within(returnBox).findByRole('heading', { level: 3, name: 'Parti alle 07:39' }),
    ).toBeInTheDocument();
    const request = service.createPlan.mock.calls[1][0];
    expect(request).toMatchObject({
      campus_id: 'dief',
      origin: { station_id: 'reggio_fs' },
      mode: 'bike',
    });
    expect(request.depart_after).toMatch(/T13:30:00/);
    expect(window.location.search).toContain('ritorno=13%3A30');
    // The outbound result stays on screen above the return.
    expect(screen.getByRole('heading', { level: 2, name: 'Esci alle 07:39' })).toBeInTheDocument();
  });

  it('dopo "Calcola il ritorno" la mappa mostra il ritorno e segue ogni cambio andata/ritorno (B1)', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    await user.click(await formReady());
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    expect(mapPoints()).toBe(
      '3 punti: Stazione partenza · Reggio Emilia FS → Stazione arrivo · Modena FS → Sede · DIEF',
    );
    expect(screen.queryByText(/vista/)).not.toBeInTheDocument();

    service.createPlan.mockResolvedValueOnce(demoReturn);
    const returnBox = screen.getByRole('region', { name: 'E per tornare?' });
    await user.click(within(returnBox).getByRole('button', { name: 'Calcola il ritorno' }));
    await within(returnBox).findByRole('heading', { level: 3, name: 'Parti alle 07:39' });
    expect(mapPoints()).toBe(
      '3 punti: Sede · DIEF → Stazione partenza · Modena FS → Stazione arrivo · Reggio Emilia FS',
    );
    expect(screen.getByText(/vista return/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mappa andata' }));
    expect(mapPoints()).toMatch(/^3 punti: Stazione partenza · Reggio Emilia FS/);
    await user.click(screen.getByRole('button', { name: 'Mappa ritorno' }));
    expect(mapPoints()).toMatch(/^3 punti: Sede · DIEF/);

    // A new outbound search shows the outbound again.
    service.createPlan.mockResolvedValueOnce(demo);
    await user.click(screen.getByRole('button', { name: /Calcola quando uscire/ }));
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    expect(mapPoints()).toMatch(/^3 punti: Stazione partenza · Reggio Emilia FS/);
  });

  it('la fine lezione del ritorno è dichiarata come proposta da modificare (B7)', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    await user.click(await formReady());
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    const returnBox = screen.getByRole('region', { name: 'E per tornare?' });
    const group = within(returnBox).getByRole('group', { name: 'Fine lezione' });
    expect(group).toHaveAccessibleDescription(
      'Proposta: inizio lezione + 2 ore (10:30). Modificala con l’orario reale di fine lezione.',
    );
    await user.selectOptions(within(returnBox).getByRole('combobox', { name: 'Ore' }), '13');
    expect(group).not.toHaveAccessibleDescription(/Proposta/);
  });

  it('il ritorno come ricerca principale si ricorda', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    await formReady();
    service.createPlan.mockResolvedValueOnce({ ...demo, planner: 'depart_after' });
    await user.click(screen.getByRole('button', { name: /Ritorno/ }));
    await user.click(screen.getByRole('button', { name: /Calcola quando partire/ }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Parti alle 07:39' }),
    ).toBeInTheDocument();
    expect(service.createPlan.mock.calls[0][0]).toHaveProperty('depart_after');
    expect(screen.queryByRole('region', { name: 'E per tornare?' })).not.toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(PREFS)!)).toMatchObject({ direction: 'return' });
  });
});

describe('PlannerShell: mobile ed errori', () => {
  it('su mobile porta in vista il risultato dopo il calcolo', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width') }));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<PlannerShell />);
    await user.click(await formReady());
    expect(scroll).toHaveBeenCalled();
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('result'));
    // Accessible focus on the result title once it is there (round 3, point 11).
    const title = await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('anche quando non c’è un treno utile il focus va al titolo del risultato', async () => {
    const user = userEvent.setup();
    service.createPlan.mockResolvedValueOnce({ ...demo, itineraries: [], calculation: null });
    render(<PlannerShell />);
    await user.click(await formReady());
    const title = await screen.findByRole('heading', { level: 2, name: 'Nessun treno utile' });
    await waitFor(() => expect(title).toHaveFocus());
  });

  it('mostra un errore recuperabile se il catalogo non si carica', async () => {
    service.getCampuses.mockRejectedValueOnce(new Error('API non raggiungibile'));
    render(<PlannerShell />);
    expect(await screen.findByText('API non raggiungibile', { selector: 'p' })).toBeInTheDocument();
    expect(service.createPlan).not.toHaveBeenCalled();
  });
});

describe('PlannerShell: round 4', () => {
  it('"E per tornare?" compare solo sotto un’andata valida (punto 3)', async () => {
    const user = userEvent.setup();
    service.createPlan.mockResolvedValueOnce({ ...demo, itineraries: [], calculation: null });
    render(<PlannerShell />);
    await user.click(await formReady());
    await screen.findByRole('heading', { level: 2, name: 'Nessun treno utile' });
    expect(screen.queryByRole('region', { name: 'E per tornare?' })).not.toBeInTheDocument();

    // Out of the timetable: an alert, no itinerary, no return either.
    service.createPlan.mockResolvedValueOnce({
      ...demo,
      itineraries: [],
      calculation: null,
      notices: [{ code: 'out_of_validity', level: 'warning', message: 'Data fuori dall’orario.' }],
    });
    await user.click(screen.getByRole('button', { name: /Calcola quando uscire/ }));
    expect(await screen.findByText('Data fuori dall’orario.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'E per tornare?' })).not.toBeInTheDocument();

    service.createPlan.mockResolvedValueOnce(demo);
    await user.click(screen.getByRole('button', { name: /Calcola quando uscire/ }));
    expect(await screen.findByRole('region', { name: 'E per tornare?' })).toBeInTheDocument();
  });

  it('link verso=ritorno senza ritorno: calcola subito con la fine proposta e lo dice (punto 5)', async () => {
    service.createPlan.mockResolvedValue({ ...demo, planner: 'depart_after' });
    window.history.replaceState(
      null,
      '',
      '/?sede=dief&stazione=reggio_fs&data=2026-10-26&ora=09%3A00&mezzo=bici&verso=ritorno',
    );
    render(<PlannerShell />);
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledOnce());
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({
      campus_id: 'dief',
      depart_after: '2026-10-26T11:00:00+01:00',
    });
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Parti alle 07:39' }),
    ).toBeInTheDocument();
    const proposal =
      'Proposta: inizio lezione + 2 ore (11:00). Modificala con l’orario reale di fine lezione.';
    expect(screen.getByText(proposal, { selector: '.proposal-note span' })).toBeVisible();
    expect(screen.getByRole('group', { name: 'Fine lezione' })).toHaveAccessibleDescription(
      proposal,
    );
    expect(screen.queryByText(INVALID_LINK_MESSAGE)).not.toBeInTheDocument();
  });

  it('"Usa la bici" ricalcola lo stesso tragitto in bici (punto 2)', async () => {
    const user = userEvent.setup();
    service.createPlan.mockResolvedValueOnce({
      ...demo,
      suggestion: { mode: 'bike', minutes: 22, message: 'In bici circa 22 min (a piedi 53 min).' },
    });
    window.history.replaceState(null, '', SHARED); // mezzo=piedi
    render(<PlannerShell />);
    const callout = await screen.findByRole('group', { name: 'Suggerimento: bici' });
    expect(callout).toHaveTextContent('In bici circa 22 min');
    // Round 5, point 3: the suggestion never changes the chosen mode by itself.
    expect(screen.getByRole('button', { name: 'A piedi' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Usa la bici' }));
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledTimes(2));
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({ mode: 'walk' });
    expect(service.createPlan.mock.calls[1][0]).toMatchObject({
      mode: 'bike',
      campus_id: 'palazzo_dossetti',
    });
    expect(window.location.search).toContain('mezzo=bici');
    expect(screen.queryByRole('button', { name: 'Usa la bici' })).not.toBeInTheDocument();
  });

  it('su mobile con riduzione del movimento lo scorrimento è immediato (punto 9)', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('max-width') || query.includes('prefers-reduced-motion'),
    }));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<PlannerShell />);
    await user.click(await formReady());
    expect(scroll).toHaveBeenCalledWith({ behavior: 'instant', block: 'start' });
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('result'));
  });
});

describe('prefillMessage', () => {
  const lesson = { id: 'x', weekday: 1 as const, time: '10:30', campusId: 'dief' };
  it('descrive la lezione precompilata dall’orario', () => {
    expect(prefillMessage(null)).toBeUndefined();
    expect(prefillMessage({ lesson, date: '2026-10-26', today: true })).toBe(
      'Dal tuo orario: lezione di oggi alle 10:30.',
    );
    expect(prefillMessage({ lesson, date: '2026-10-27', today: false })).toBe(
      'Dal tuo orario: prossima lezione mar 27 ott 2026 alle 10:30.',
    );
  });
});

describe('PlannerShell: round 5', () => {
  // Same city out of the timetable (repro of point 1): the API still returns the
  // direct walk, together with the out_of_validity notice.
  const walkOnly = { ...demo.itineraries[0], legs: [demo.itineraries[0].legs[2]] };
  const sameCityOutOfRange = {
    ...demo,
    itineraries: [walkOnly],
    calculation: null,
    notices: [
      { code: 'out_of_validity', level: 'warning' as const, message: 'Data fuori dall’orario.' },
      { code: 'same_city', level: 'info' as const, message: 'Stessa città: a piedi.' },
    ],
  };

  it('stessa città fuori validità: niente "E per tornare?" (punto 1)', async () => {
    service.createPlan.mockResolvedValue(sameCityOutOfRange);
    window.history.replaceState(
      null,
      '',
      '/?sede=dief&stazione=modena_fs&data=2026-12-20&ora=08%3A30&mezzo=piedi&verso=andata',
    );
    render(<PlannerShell />);
    expect(await screen.findByText('Data fuori dall’orario.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'E per tornare?' })).not.toBeInTheDocument();
  });

  it('link con ritorno= fuori validità: niente vista ritorno, nemmeno sulla mappa (punto 1)', async () => {
    service.createPlan.mockResolvedValue(sameCityOutOfRange);
    window.history.replaceState(
      null,
      '',
      '/?sede=dief&stazione=modena_fs&data=2026-12-20&ora=08%3A30&mezzo=piedi&verso=andata&ritorno=13%3A00',
    );
    render(<PlannerShell />);
    await waitFor(() => expect(service.createPlan).toHaveBeenCalledTimes(2));
    expect(await screen.findAllByText('Data fuori dall’orario.')).toHaveLength(1);
    expect(screen.queryByRole('region', { name: 'E per tornare?' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mappa ritorno' })).not.toBeInTheDocument();
  });
});
