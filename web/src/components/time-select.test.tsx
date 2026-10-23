import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { minuteOptions, TimeSelect } from './time-select';

describe('TimeSelect', () => {
  it('ore 00–23 e minuti a passi di 5 (più il valore corrente se fuori passo)', () => {
    expect(minuteOptions('30')).toHaveLength(12);
    expect(minuteOptions('07')).toEqual([
      '00',
      '05',
      '07',
      '10',
      '15',
      '20',
      '25',
      '30',
      '35',
      '40',
      '45',
      '50',
      '55',
    ]);
  });

  it('si comporta come un orario a 24 ore etichettato', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TimeSelect id="t" label="Fine lezione" value="13:07" onChange={onChange} />);
    const group = screen.getByRole('group', { name: 'Fine lezione' });
    const hours = within(group).getByRole('combobox', { name: 'Ore' });
    const minutes = within(group).getByRole('combobox', { name: 'Minuti' });
    expect(within(hours).getAllByRole('option')).toHaveLength(24);
    expect(hours).toHaveValue('13');
    expect(minutes).toHaveValue('07');
    await user.selectOptions(hours, '15');
    expect(onChange).toHaveBeenLastCalledWith('15:07');
    await user.selectOptions(minutes, '30');
    expect(onChange).toHaveBeenLastCalledWith('13:30');
  });
});
