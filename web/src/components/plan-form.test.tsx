import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import { defaultPlannerValues, type PlannerValues } from '@/lib/plan-request';
import { PlanForm } from './plan-form';

const { campuses: CAMPUSES, stations: STATIONS } = fixtures;
const BASE = defaultPlannerValues(new Date('2026-10-26T06:00:00Z'));

function Harness({
  initial = {},
  onSubmit = vi.fn(),
  onValues = vi.fn(),
  validTo = '2026-12-12',
}: {
  initial?: Partial<PlannerValues>;
  onSubmit?: () => void;
  onValues?: (values: PlannerValues) => void;
  validTo?: string;
}) {
  const [values, setValues] = useState<PlannerValues>({ ...BASE, ...initial });
  return (
    <PlanForm
      values={values}
      onChange={(patch) =>
        setValues((current) => {
          const next = { ...current, ...patch };
          onValues(next);
          return next;
        })
      }
      campuses={CAMPUSES}
      stations={STATIONS}
      onSubmit={onSubmit}
      loading={false}
      validTo={validTo}
      onSearchAddress={vi.fn().mockResolvedValue([])}
      onPickOnMap={vi.fn()}
      pickingOnMap={false}
    />
  );
}

describe('PlanForm', () => {
  it('invia con i valori predefiniti: solo regionali attivo e 5 min in stazione', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    expect(screen.getByRole('checkbox', { name: /Solo regionali \(R\/RV\)/ })).toBeChecked();
    expect(screen.getByLabelText('Tempo in stazione')).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: /Calcola quando uscire/ }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('il ritorno cambia etichette e nasconde l’anticipo a lezione', async () => {
    const user = userEvent.setup();
    const onValues = vi.fn();
    render(<Harness onValues={onValues} />);
    await user.click(screen.getByRole('button', { name: /Ritorno/ }));
    expect(onValues).toHaveBeenLastCalledWith(expect.objectContaining({ direction: 'return' }));
    expect(screen.getByRole('button', { name: /Ritorno/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Fine lezione')).toBeInTheDocument();
    expect(screen.queryByLabelText('Anticipo a lezione')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calcola quando partire/ })).toBeInTheDocument();
  });

  it('modifica sede, modalità, buffer e categorie con controlli etichettati', async () => {
    const user = userEvent.setup();
    const onValues = vi.fn();
    render(<Harness onValues={onValues} />);
    const campusSearch = screen.getByRole('combobox', { name: /Sede UNIMORE/ });
    await user.click(campusSearch);
    await user.type(campusSearch, 'Marco Biagi');
    await user.click(screen.getByRole('button', { name: /Marco Biagi/ }));
    await user.click(screen.getByRole('button', { name: 'A piedi' }));
    fireEvent.change(screen.getByLabelText('Tempo in stazione'), { target: { value: '12' } });
    await user.click(screen.getByRole('checkbox', { name: /Solo regionali/ }));
    expect(onValues).toHaveBeenLastCalledWith(
      expect.objectContaining({
        campusId: 'economia_biagi',
        mode: 'walk',
        stationBufferMin: 12,
        regionalOnly: false,
      }),
    );
    expect(screen.getByText(/biglietto\s+diverso o un supplemento/)).toBeInTheDocument();
  });

  it('avvisa quando la data supera la validità dell’orario', () => {
    render(<Harness initial={{ date: '2026-12-14' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('vale fino al 12/12/2026');
  });

  it('da casa chiede indirizzo o minuti; il pulsante resta disattivato finché mancano', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Da casa' }));
    expect(screen.getByLabelText('Indirizzo di casa')).toBeInTheDocument();
    expect(screen.getByLabelText('Stazione che usi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calcola quando uscire/ })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Minuti casa/), { target: { value: '9' } });
    expect(screen.getByRole('button', { name: /Calcola quando uscire/ })).toBeEnabled();
  });

  it('con casa sulla mappa nasconde la scelta della stazione (la stima il server)', () => {
    render(
      <Harness
        initial={{ originKind: 'home', home: { label: 'Via Emilia 1', lat: 44.7, lon: 10.63 } }}
      />,
    );
    expect(screen.getByText('Via Emilia 1')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Stazione/)).not.toBeInTheDocument();
  });
});
