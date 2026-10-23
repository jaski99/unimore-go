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

describe('date di calendario Europe/Rome', () => {
  it('calcola oggi, ora e giorno della settimana a Roma', async () => {
    const { nowInRome, todayInRome } = await import('./time-format');
    const now = new Date('2026-10-25T23:15:00Z'); // Monday 00:15 in Rome (CET)
    expect(todayInRome(now)).toBe('2026-10-26');
    expect(nowInRome(now)).toEqual({ date: '2026-10-26', time: '00:15', weekday: 1 });
  });

  it('somma giorni, ricava il giorno della settimana e formatta date brevi', async () => {
    const { addDays, formatShortDate, weekdayOf } = await import('./time-format');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekdayOf('2026-10-26')).toBe(1);
    expect(weekdayOf('2026-11-01')).toBe(0);
    expect(formatShortDate('2026-10-26')).toBe('lun 26 ott');
  });

  it('formatta le durate in minuti e ore', async () => {
    const { formatDuration } = await import('./time-format');
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(-5)).toBe('5 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(125)).toBe('2 h 05 min');
  });
});
