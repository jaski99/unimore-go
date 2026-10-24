import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { FESTIVE_BADGE_HELP } from '@/lib/festive-summary';
import { FestiveChip, FestiveNotice } from './festive-notice';

const summary = {
  headline: 'Festivo, servizio ridotto: verifica le corse «Festivo?».',
  details: ['Dom 25 ott 2026: orario festivo, servizio ridotto. Testo lungo.', FESTIVE_BADGE_HELP],
};

describe('FestiveNotice (round 5, punto 4)', () => {
  it('una riga sempre visibile, il testo lungo dentro "Dettagli"', async () => {
    const user = userEvent.setup();
    render(<FestiveNotice summary={summary} />);
    const note = screen.getByRole('note');
    expect(note).toHaveTextContent(summary.headline);
    const long = screen.getByText(summary.details[0]);
    expect(long).not.toBeVisible();
    await user.click(screen.getByText('Dettagli'));
    expect(long).toBeVisible();
    expect(screen.getByText(FESTIVE_BADGE_HELP)).toBeVisible();
  });

  it('senza testi lunghi non mostra "Dettagli"', () => {
    render(<FestiveNotice summary={{ headline: 'Giorno festivo.', details: [] }} />);
    expect(screen.queryByText('Dettagli')).not.toBeInTheDocument();
  });
});

describe('FestiveChip (round 5, punto 4)', () => {
  it('badge breve con tooltip; ai lettori di schermo il testo completo', () => {
    const { container } = render(<FestiveChip />);
    const chip = container.querySelector('.festive-chip')!;
    expect(chip).toHaveAttribute('title', FESTIVE_BADGE_HELP);
    expect(screen.getByText('Festivo?')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Circolazione nei festivi da verificare')).toHaveClass('sr-only');
  });
});
