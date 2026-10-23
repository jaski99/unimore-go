import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatDate,
  formatTime,
  getNextDateForWeekday,
  toRomeIso,
} from './time-format';

describe('formattazione Europe/Rome', () => {
  it('visualizza correttamente gli orari ricevuti in ISO con offset', () => {
    expect(formatTime('2026-10-26T06:34:00Z')).toBe('07:34');
    expect(formatTime('2026-07-01T05:34:00Z')).toBe('07:34');
    expect(formatDate('2026-10-26T07:30:00Z')).toContain('lunedì');
  });

  it('mostra così com’è l’orario HH:MM dell’API e converte gli ISO', () => {
    expect(formatClock('07:44')).toBe('07:44');
    expect(formatClock('23:59')).toBe('23:59');
    expect(formatClock('2026-10-26T06:34:00Z')).toBe('07:34');
  });

  it('converte il campo locale in ISO Europe/Rome rispettando ora legale e solare', () => {
    expect(toRomeIso('2026-10-26', '08:30')).toBe('2026-10-26T08:30:00+01:00');
    expect(toRomeIso('2026-07-01', '08:30')).toBe('2026-07-01T08:30:00+02:00');
  });

  it('calcola la prossima occorrenza del giorno della settimana', () => {
    expect(getNextDateForWeekday(1, new Date(2026, 9, 23))).toBe('2026-10-26');
  });
});
