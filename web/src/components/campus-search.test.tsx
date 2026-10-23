import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import { CampusSearch } from './campus-search';

describe('CampusSearch', () => {
  it('si usa da tastiera: frecce, Invio e Tab non passa per ogni opzione', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <CampusSearch campuses={fixtures.campuses} selectedId="dief" onChange={onChange} />
        <button type="button">dopo</button>
      </>,
    );
    const input = screen.getByRole('combobox', { name: 'Sede UNIMORE' });
    await user.click(input);
    expect(input).toHaveAttribute('aria-activedescendant', 'campus-option-dief');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      `campus-option-${fixtures.campuses[1].id}`,
    );
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(fixtures.campuses[1].id);
    await user.click(input);
    await user.tab();
    expect(screen.getByRole('button', { name: 'dopo' })).toHaveFocus();
  });

  it('filtra per nome o città e segnala l’assenza di risultati', async () => {
    const user = userEvent.setup();
    render(<CampusSearch campuses={fixtures.campuses} selectedId="dief" onChange={vi.fn()} />);
    const input = screen.getByRole('combobox', { name: 'Sede UNIMORE' });
    await user.click(input);
    await user.type(input, 'reggio');
    expect(screen.getAllByRole('option')).toHaveLength(
      fixtures.campuses.filter((campus) => campus.city === 'Reggio Emilia').length,
    );
    await user.clear(input);
    await user.type(input, 'zzz');
    expect(screen.getByText('Nessuna sede trovata')).toBeInTheDocument();
  });
});
