import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReturnTrip } from './return-trip';

describe('ReturnTrip', () => {
  it('sceglie la fine lezione e calcola il ritorno', async () => {
    const user = userEvent.setup();
    const onEndTimeChange = vi.fn();
    const onCalculate = vi.fn();
    const { rerender } = render(
      <ReturnTrip
        endTime="10:30"
        onEndTimeChange={onEndTimeChange}
        onCalculate={onCalculate}
        loading={false}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Ore' }), '13');
    expect(onEndTimeChange).toHaveBeenCalledWith('13:30');
    await user.click(screen.getByRole('button', { name: 'Calcola il ritorno' }));
    expect(onCalculate).toHaveBeenCalledOnce();
    rerender(
      <ReturnTrip
        endTime="10:30"
        onEndTimeChange={onEndTimeChange}
        onCalculate={onCalculate}
        loading
      >
        <p>risultato</p>
      </ReturnTrip>,
    );
    expect(screen.getByRole('button', { name: 'Calcolo…' })).toBeDisabled();
    expect(screen.getByText('risultato')).toBeInTheDocument();
  });
});
