import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import { CampusSearch } from './campus-search';

const { campuses } = fixtures;
const dief = campuses.find((campus) => campus.id === 'dief')!;
const SHORT = 'DIEF · Modena';
const FULL = `${dief.name} · ${dief.city}`;
const setup = (selectedId = 'dief') => {
  const onChange = vi.fn();
  render(
    <>
      <CampusSearch campuses={campuses} selectedId={selectedId} onChange={onChange} />
      <button type="button">dopo</button>
    </>,
  );
  return { onChange, input: screen.getByRole('combobox', { name: 'Sede UNIMORE' }) };
};

describe('CampusSearch', () => {
  it('al focus mostra TUTTE le sedi anche con un valore già scelto, che resta visibile', async () => {
    const user = userEvent.setup();
    const { input } = setup();
    expect(input).toHaveValue(SHORT);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.click(input);
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveValue(SHORT);
    expect(screen.getAllByRole('option')).toHaveLength(campuses.length);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(dief.name);
    expect(input).toHaveAttribute('aria-activedescendant', 'campus-option-dief');
  });

  it('si usa da tastiera: frecce, Invio, Esc; Tab esce senza passare per le opzioni', async () => {
    const user = userEvent.setup();
    const { input, onChange } = setup();
    const start = campuses.findIndex((campus) => campus.id === 'dief');
    const next = campuses[(start + 1) % campuses.length];
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-activedescendant', `campus-option-${next.id}`);
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(next.id);
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowDown}');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Escape}');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await user.tab();
    expect(screen.getByRole('button', { name: 'dopo' })).toHaveFocus();
  });

  it('clic e poi scrittura sostituiscono il testo (non lo accodano)', async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.keyboard('Biagi');
    expect(input).toHaveValue('Biagi');
  });

  it('scrivendo si filtra per nome o città; uscendo torna l’etichetta scelta', async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    await user.keyboard('reggio');
    expect(screen.getAllByRole('option')).toHaveLength(
      campuses.filter((campus) => `${campus.name} ${campus.city}`.toLowerCase().includes('reggio'))
        .length,
    );
    await user.clear(input);
    await user.keyboard('zzz');
    expect(screen.getByRole('status')).toHaveTextContent('Nessuna sede trovata');
    await user.tab();
    expect(input).toHaveValue(SHORT);
  });

  it('il pulsante freccia apre e chiude l’elenco completo; il clic sceglie', async () => {
    const user = userEvent.setup();
    const { input, onChange } = setup();
    const toggle = screen.getByRole('button', { name: 'Mostra tutte le sedi' });
    await user.click(toggle);
    expect(input).toHaveFocus();
    expect(screen.getAllByRole('option')).toHaveLength(campuses.length);
    await user.click(screen.getAllByRole('option')[0]);
    expect(onChange).toHaveBeenCalledWith(campuses[0].id);
    await user.click(toggle);
    await user.click(toggle);
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('al focus (tastiera o tocco) seleziona tutto il testo, anche dopo il rendering (punto 10)', async () => {
    const user = userEvent.setup();
    const { input } = setup();
    const label = SHORT;
    await user.tab();
    expect(input).toHaveFocus();
    await waitFor(() => {
      expect((input as HTMLInputElement).selectionStart).toBe(0);
      expect((input as HTMLInputElement).selectionEnd).toBe(label.length);
    });
  });

  it('dopo la scelta mostra il nome breve; nome completo in elenco, tooltip e descrizione (round 4)', async () => {
    const user = userEvent.setup();
    const { input } = setup();
    expect(input).toHaveValue(SHORT);
    expect(input).toHaveAttribute('title', FULL);
    expect(input).toHaveAccessibleDescription(expect.stringContaining(`Sede scelta: ${FULL}`));
    // No visible duplicate under the field any more: the readout is for screen readers.
    expect(document.getElementById('campus-selected')).toHaveClass('sr-only');
    await user.click(input);
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(dief.name);
  });

  it('scegliendo un’altra sede il campo mostra il suo nome breve', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <CampusSearch campuses={campuses} selectedId="dief" onChange={onChange} />,
    );
    const input = screen.getByRole('combobox', { name: 'Sede UNIMORE' });
    await user.click(input);
    await user.keyboard('Dossetti');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('palazzo_dossetti');
    rerender(
      <CampusSearch campuses={campuses} selectedId="palazzo_dossetti" onChange={onChange} />,
    );
    expect(input).toHaveValue('Palazzo Dossetti · Reggio Emilia');
  });
});
