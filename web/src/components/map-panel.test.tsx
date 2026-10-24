import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Route } from '@/lib/route-geometry';
import { MapLegend, MapPanel } from './map-panel';

// Leaflet needs a real browser: the dynamic map is replaced by a stub.
vi.mock('next/dynamic', () => ({
  default: () =>
    function MapStub() {
      return <div data-testid="leaflet" />;
    },
}));

const stationsOnly: Route = {
  points: [
    {
      role: 'from_station',
      label: 'Stazione partenza · Reggio Emilia FS',
      shortLabel: 'Partenza · Reggio Emilia FS',
      position: [44.69, 10.64],
      labelSide: 'top',
    },
    {
      role: 'to_station',
      label: 'Stazione arrivo · Modena FS',
      shortLabel: 'Arrivo · Modena FS',
      position: [44.65, 10.93],
      labelSide: 'top',
    },
    {
      role: 'campus',
      label: 'Sede · DIEF',
      shortLabel: 'Sede · DIEF',
      position: [44.63, 10.94],
      labelSide: 'bottom',
    },
  ],
  segments: [
    { from: [44.69, 10.64], to: [44.65, 10.93], kind: 'train' },
    { from: [44.65, 10.93], to: [44.63, 10.94], kind: 'active' },
  ],
};

const legendItems = () =>
  within(screen.getByRole('list', { name: 'Legenda della mappa' }))
    .getAllByRole('listitem')
    .map((item) => item.textContent?.trim());

describe('MapLegend (B5)', () => {
  it('elenca solo i marker e le linee presenti: niente "Casa" se si parte da una stazione', () => {
    render(<MapLegend route={stationsOnly} />);
    expect(legendItems()).toEqual([
      'Stazione partenza',
      'Stazione arrivo',
      'Sede',
      'Treno',
      'A piedi / in bici',
    ]);
  });

  it('con la casa la mostra; senza risultato niente linee in legenda', () => {
    render(
      <MapLegend
        route={{
          points: [
            {
              role: 'home',
              label: 'Casa',
              shortLabel: 'Casa',
              position: [44.7, 10.62],
              labelSide: 'top',
            },
            {
              role: 'campus',
              label: 'Sede · DIEF',
              shortLabel: 'Sede · DIEF',
              position: [44.63, 10.94],
              labelSide: 'bottom',
            },
          ],
          segments: [],
        }}
      />,
    );
    expect(legendItems()).toEqual(['Casa', 'Sede']);
  });
});

describe('MapPanel: andata e ritorno (B1)', () => {
  it('senza ritorno non mostra il selettore', () => {
    render(<MapPanel route={stationsOnly} picking={false} onPick={vi.fn()} />);
    expect(screen.queryByRole('group', { name: 'Percorso sulla mappa' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Il percorso' })).toBeInTheDocument();
  });

  it('con il ritorno calcolato si passa da andata a ritorno e il titolo lo dice', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <MapPanel
        route={stationsOnly}
        picking={false}
        onPick={vi.fn()}
        view={{ active: 'return', onChange }}
      />,
    );
    const group = screen.getByRole('group', { name: 'Percorso sulla mappa' });
    expect(within(group).getByRole('button', { name: 'Ritorno' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('heading', { name: 'Il percorso · ritorno' })).toBeInTheDocument();
    await user.click(within(group).getByRole('button', { name: 'Andata' }));
    expect(onChange).toHaveBeenCalledWith('outbound');
    rerender(
      <MapPanel
        route={stationsOnly}
        picking={false}
        onPick={vi.fn()}
        view={{ active: 'outbound', onChange }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Il percorso · andata' })).toBeInTheDocument();
  });
});
