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
      headline:
        'Giorno festivo, servizio ridotto: le corse «Festivo?» vanno verificate su Trenitalia.',
      details: [festiveDay.message, FESTIVE_BADGE_HELP],
    });
    expect(summary!.headline.length).toBeLessThan(100); // one or two lines on a phone
  });

  it('festivo con corse confermate dal PDF: niente richiamo al badge', () => {
    expect(festiveSummary([festiveDay], [run(false)])).toEqual({
      headline: 'Giorno festivo, servizio ridotto: verifica su Trenitalia prima di partire.',
      details: [festiveDay.message],
    });
  });

  it('giorno feriale: nessun avviso', () => {
    expect(festiveSummary([], [run(false)])).toBeNull();
    expect(festiveSummary([{ ...festiveDay, code: 'same_city' }], [])).toBeNull();
  });

  it('il significato del badge spiega il testo completo', () => {
    expect(FESTIVE_BADGE_HELP).toContain('circolazione nei festivi da verificare');
  });
});
