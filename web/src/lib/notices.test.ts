import { describe, expect, it } from 'vitest';
import type { PlanResponse } from '@/lib/api/types';
import { groupNotices, isOutOfValidity, noticesOf } from './notices';

const base: PlanResponse = { itineraries: [], warnings: [] };

describe('noticesOf', () => {
  it('usa le notice v0.5 così come arrivano (già ordinate)', () => {
    const notices = [
      { code: 'out_of_validity', level: 'warning' as const, message: 'Fuori validità' },
      { code: 'not_realtime', level: 'info' as const, message: 'Non in tempo reale' },
    ];
    expect(noticesOf({ ...base, notices, warnings: ['x'] })).toBe(notices);
  });

  it('ricostruisce i codici dalle warning v0.4', () => {
    const notices = noticesOf({
      ...base,
      warnings: [
        'Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale).',
        'Nessun treno utile per arrivare entro le 08:31.',
        'Attenzione: il 14/12/2026 è dopo la fine di validità dell’orario.',
        'Stima primo tratto',
      ],
    });
    expect(notices.map((notice) => notice.code)).toEqual([
      'not_realtime',
      'no_service',
      'out_of_validity',
      'generic',
    ]);
    expect(noticesOf(null)).toEqual([]);
  });
});

describe('groupNotices', () => {
  it('separa titolo, avvisi, note e tempo reale', () => {
    const groups = groupNotices([
      { code: 'no_service', level: 'warning', message: 'Nessun treno' },
      { code: 'home_far', level: 'warning', message: 'Lontano' },
      { code: 'festive_day', level: 'info', message: 'Festivo' },
      { code: 'not_realtime', level: 'info', message: 'Non in tempo reale' },
    ]);
    expect(groups.noService?.message).toBe('Nessun treno');
    expect(groups.alerts.map((n) => n.message)).toEqual(['Lontano']);
    expect(groups.infos.map((n) => n.message)).toEqual(['Festivo']);
    expect(groups.realtime?.message).toBe('Non in tempo reale');
  });
});

describe('isOutOfValidity (round 5, punto 1)', () => {
  it('legge il codice out_of_validity, anche nelle risposte v0.4', () => {
    const notice = { code: 'out_of_validity', level: 'warning' as const, message: 'Fuori' };
    expect(isOutOfValidity({ ...base, notices: [notice] })).toBe(true);
    expect(isOutOfValidity({ ...base, warnings: ['Data fuori dal periodo di validità'] })).toBe(
      true,
    );
    expect(isOutOfValidity({ ...base, notices: [{ ...notice, code: 'same_city' }] })).toBe(false);
    expect(isOutOfValidity(null)).toBe(false);
  });
});
