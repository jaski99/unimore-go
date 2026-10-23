import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { PlanService } from '@/lib/api/plan-service';
import type { PlanResponse } from '@/lib/api/types';
import { prefillMessage, PlannerShell } from './planner-shell';

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
  MapPanel: ({ route }: { route: { points: unknown[] } }) => (
    <div data-testid="map">{route.points.length} punti</div>
  ),
}));

beforeEach(() => {
  window.localStorage.clear();
  service.getHealth.mockResolvedValue(fixtures.health);
  service.getCampuses.mockResolvedValue(fixtures.campuses);
  service.getStations.mockResolvedValue(fixtures.stations);
  service.createPlan.mockResolvedValue(fixtures.demo.response as PlanResponse);
  service.geocode.mockResolvedValue({ results: [], attribution: '' });
});
afterEach(() => vi.clearAllMocks());

describe('PlannerShell', () => {
  it('al primo accesso calcola subito con i valori predefiniti (zero tocchi)', async () => {
    render(<PlannerShell />);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' }),
    ).toBeInTheDocument();
    expect(service.createPlan).toHaveBeenCalledOnce();
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({
      origin: { station_id: 'reggio_fs' },
      station_buffer_min: 5,
      train_categories: ['regional'],
    });
    // The answer comes before the form in the DOM (mobile order).
    const result = document.getElementById('result')!;
    const form = document.getElementById('plan-form')!;
    expect(result.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('map')).toHaveTextContent('3 punti');
  });

  it('ricorda le preferenze e le usa al ritorno', async () => {
    window.localStorage.setItem(
      'unimorego.planner.v1',
      JSON.stringify({ mode: 'walk', stationBufferMin: 10, regionalOnly: false }),
    );
    render(<PlannerShell />);
    await waitFor(() => expect(service.createPlan).toHaveBeenCalled());
    expect(service.createPlan.mock.calls[0][0]).toMatchObject({
      mode: 'walk',
      station_buffer_min: 10,
      train_categories: ['regional', 'intercity', 'high_speed'],
    });
    expect(screen.getByRole('button', { name: 'A piedi' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('ricalcola il ritorno su richiesta e salva la scelta', async () => {
    const user = userEvent.setup();
    render(<PlannerShell />);
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    service.createPlan.mockResolvedValueOnce({
      ...(fixtures.demo.response as PlanResponse),
      planner: 'depart_after',
    });
    await user.click(screen.getByRole('button', { name: /Ritorno/ }));
    await user.click(screen.getByRole('button', { name: /Calcola quando partire/ }));
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Parti alle 07:39' }),
    ).toBeInTheDocument();
    expect(service.createPlan.mock.calls[1][0]).toHaveProperty('depart_after');
    expect(JSON.parse(window.localStorage.getItem('unimorego.planner.v1')!)).toMatchObject({
      direction: 'return',
    });
  });

  it('su mobile porta in vista il risultato dopo il calcolo', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('max-width') }));
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(<PlannerShell />);
    await screen.findByRole('heading', { level: 2, name: 'Esci alle 07:39' });
    await user.click(screen.getByRole('button', { name: /Calcola quando uscire/ }));
    expect(scroll).toHaveBeenCalled();
    expect(scroll.mock.contexts[0]).toBe(document.getElementById('result'));
    vi.unstubAllGlobals();
  });

  it('mostra un errore recuperabile se il catalogo non si carica', async () => {
    service.getCampuses.mockRejectedValueOnce(new Error('API non raggiungibile'));
    render(<PlannerShell />);
    expect(await screen.findByText('API non raggiungibile', { selector: 'p' })).toBeInTheDocument();
    expect(service.createPlan).not.toHaveBeenCalled();
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
      'Dal tuo orario: prossima lezione mar 27 ott alle 10:30.',
    );
  });
});
