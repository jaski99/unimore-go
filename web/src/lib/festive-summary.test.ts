import { describe, expect, it } from 'vitest';
import type { Itinerary, Notice } from '@/lib/api/types';
import { FESTIVE_BADGE_HELP, festiveSummary } from './festive-summary';

const festiveDay: Notice = {
  code: 'festive_day',
  level: 'info',
  message:
    'Dom 25 ott 2026: orario festivo, servizio ridotto. Verifica su Trenitalia prima di partire.',
};
const run = (festive_unverified: boolean) =>
  ({
    legs: [{ type: 'train', train: { number: '3907', festive_unverified } }],
  }) as unknown as Itinerary;

describe('festiveSummary (round 5, punto 4)', () => {
  it('domenica con corse non verificate: una riga + dettagli (avviso API e significato del badge)', () => {
    const summary = festiveSummary([festiveDay], [run(true), run(true), run(true)]);
    expect(summary).toEqual({
      headline: 'Festivo, servizio ridotto: verifica le corse «Festivo?».',
      details: [festiveDay.message, FESTIVE_BADGE_HELP],
    });
    expect(summary!.headline.length).toBeLessThanOrEqual(60); // two lines at 390 px
  });

  it('festivo con corse confermate dal PDF: niente richiamo al badge', () => {
    const summary = festiveSummary([festiveDay], [run(false)]);
    expect(summary).toEqual({
      headline: 'Festivo, servizio ridotto: verifica su Trenitalia.',
      details: [festiveDay.message],
    });
    expect(summary!.headline.length).toBeLessThanOrEqual(60);
  });

  it('giorno feriale: nessun avviso', () => {
    expect(festiveSummary([], [run(false)])).toBeNull();
    expect(festiveSummary([{ ...festiveDay, code: 'same_city' }], [])).toBeNull();
  });

  it('il significato del badge spiega il testo completo', () => {
    expect(FESTIVE_BADGE_HELP).toContain('circolazione nei festivi da verificare');
  });
});
