import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CAMPUSES, STATIONS } from '@/lib/data/locations';
import { PlanForm } from './plan-form';

describe('PlanForm', () => {
  it('invia la sede, orario Europe/Rome, modalità, margine e origine selezionata', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <PlanForm
        campuses={CAMPUSES}
        stations={STATIONS}
        onSubmit={onSubmit}
        prefill={null}
        loading={false}
        onSelectionChange={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Calcola quando uscire' }));
    expect(onSubmit).toHaveBeenCalledWith({
      origin: { station_id: 'reggio-emilia-fs' },
      campus_id: 'dief',
      arrive_by: '2026-10-26T08:30:00+01:00',
      mode: 'bike',
      margin_min: 10,
      home_to_station_min: 14,
    });
  });

  it('consente ricerca sede, cambio modalità e margine accessibile', async () => {
    const user = userEvent.setup();
    render(
      <PlanForm
        campuses={CAMPUSES}
        stations={STATIONS}
        onSubmit={vi.fn()}
        prefill={null}
        loading={false}
        onSelectionChange={vi.fn()}
      />,
    );
    const campusSearch = screen.getByRole('combobox', { name: /Sede UNIMORE/ });
    await user.click(campusSearch);
    await user.type(campusSearch, 'Marco Biagi');
    await user.click(screen.getByRole('button', { name: /Economia Marco Biagi/ }));
    await user.click(screen.getByRole('button', { name: 'A piedi' }));
    fireEvent.change(screen.getByLabelText('Margine prima della lezione'), {
      target: { value: '15' },
    });
    expect(screen.getByRole('button', { name: 'A piedi' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('15 min')).toBeInTheDocument();
    expect(campusSearch).toHaveValue('Economia Marco Biagi · Modena');
  });
});
