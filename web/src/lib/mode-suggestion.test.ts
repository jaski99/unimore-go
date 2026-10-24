import { describe, expect, it } from 'vitest';
import type { Itinerary, ModeSuggestion } from '@/lib/api/types';
import { suggestionText, walkMinutes } from './mode-suggestion';

const suggestion: ModeSuggestion = {
  mode: 'bike',
  minutes: 22,
  message: 'In bici circa 22 min (a piedi 53 min).',
};
const walk = (minutes: number) => ({
  type: 'walk' as const,
  from: 'Modena FS',
  to: 'DIEF',
  depart: '07:27',
  arrive: '08:20',
  minutes,
});
const itinerary = (legs: Itinerary['legs']) =>
  ({ leave_at: '07:27', arrive_at: '08:20', slack_min: 10, legs }) as unknown as Itinerary;

describe('mode suggestion text (round 5, punto 3)', () => {
  it('Modena FS → DIEF: prima la bici, poi il tragitto a piedi scelto', () => {
    expect(suggestionText(suggestion, itinerary([walk(53)]))).toEqual({
      headline: 'In bici circa 22 min',
      detail: 'A piedi 53 min, il mezzo che hai scelto.',
    });
  });

  it('usa il formato ore e minuti oltre i 59 minuti', () => {
    const long = { ...suggestion, minutes: 64 };
    expect(suggestionText(long, itinerary([walk(150)]))).toEqual({
      headline: 'In bici circa 1 h 4 min',
      detail: 'A piedi 2 h 30 min, il mezzo che hai scelto.',
    });
  });

  it('somma solo i tratti a piedi; senza tratti a piedi niente dettaglio', () => {
    const bike = { ...walk(20), type: 'bike' as const };
    expect(walkMinutes(itinerary([walk(10), bike, walk(5)]))).toBe(15);
    expect(walkMinutes(undefined)).toBe(0);
    expect(suggestionText(suggestion, itinerary([bike])).detail).toBeUndefined();
  });
});
