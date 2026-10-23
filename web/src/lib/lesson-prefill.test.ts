import { describe, expect, it } from 'vitest';
import type { ScheduledClass } from './schedule-store';
import { pickLessonToPrefill } from './lesson-prefill';

const lesson = (id: string, weekday: ScheduledClass['weekday'], time: string): ScheduledClass => ({
  id,
  weekday,
  time,
  campusId: 'dief',
});
// Monday 26/10/2026 09:00 in Rome.
const MONDAY_9 = new Date('2026-10-26T08:00:00Z');

describe('pickLessonToPrefill', () => {
  it('senza lezioni non precompila nulla', () => {
    expect(pickLessonToPrefill([], MONDAY_9)).toBeNull();
  });

  it('sceglie la prossima lezione di oggi non ancora iniziata', () => {
    const lessons = [lesson('a', 1, '08:30'), lesson('b', 1, '14:00'), lesson('c', 1, '11:00')];
    expect(pickLessonToPrefill(lessons, MONDAY_9)).toEqual({
      lesson: lessons[2],
      date: '2026-10-26',
      today: true,
    });
  });

  it('altrimenti la prima dei prossimi giorni, anche lunedì prossimo', () => {
    expect(pickLessonToPrefill([lesson('a', 3, '10:00')], MONDAY_9)).toMatchObject({
      date: '2026-10-28',
      today: false,
    });
    expect(pickLessonToPrefill([lesson('a', 1, '08:30')], MONDAY_9)).toMatchObject({
      date: '2026-11-02',
      today: false,
    });
  });
});
