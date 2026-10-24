import { describe, expect, it } from 'vitest';
import type { PlanResponse } from '@/lib/api/types';
import { isValidOutbound, proposalText, proposeLessonEnd, shouldOfferReturn } from './return-trip';

const found = { itineraries: [{}], warnings: [] } as unknown as PlanResponse;
const none: PlanResponse = { itineraries: [], warnings: [] };

describe('return trip rules', () => {
  it('propone la fine lezione due ore dopo l’inizio, nello stesso giorno', () => {
    expect(proposeLessonEnd('09:00')).toBe('11:00');
    expect(proposeLessonEnd('22:30')).toBe('23:55');
    expect(proposalText('11:00')).toBe(
      'Proposta: inizio lezione + 2 ore (11:00). Modificala con l’orario reale di fine lezione.',
    );
  });

  it('offre il ritorno solo dopo un’andata con un itinerario trovato', () => {
    expect(shouldOfferReturn('outbound', 'success', found)).toBe(true);
    expect(shouldOfferReturn('outbound', 'success', none)).toBe(false);
    expect(shouldOfferReturn('outbound', 'empty', none)).toBe(false); // nessun treno / fuori range
    expect(shouldOfferReturn('outbound', 'error', null)).toBe(false);
    expect(shouldOfferReturn('outbound', 'loading', found)).toBe(false);
    expect(shouldOfferReturn('return', 'success', found)).toBe(false);
    expect(shouldOfferReturn(undefined, 'success', found)).toBe(false);
  });

  it('un solo criterio: itinerario trovato e data coperta dall’orario (round 5, punto 1)', () => {
    const outOfRange = {
      itineraries: [{}],
      warnings: [],
      notices: [{ code: 'out_of_validity', level: 'warning', message: 'Fuori validità' }],
    } as unknown as PlanResponse;
    // Same city on foot: the API returns the walk even out of the timetable.
    expect(isValidOutbound(outOfRange)).toBe(false);
    expect(shouldOfferReturn('outbound', 'success', outOfRange)).toBe(false);
    expect(isValidOutbound(found)).toBe(true);
    expect(isValidOutbound(none)).toBe(false);
    expect(isValidOutbound(null)).toBe(false);
    // v0.4 responses (warnings only) are read by their wording.
    const legacy = {
      itineraries: [{}],
      warnings: ['Dom 20 dic 2026 è dopo la fine di validità dell’orario caricato.'],
    } as unknown as PlanResponse;
    expect(isValidOutbound(legacy)).toBe(false);
  });
});
