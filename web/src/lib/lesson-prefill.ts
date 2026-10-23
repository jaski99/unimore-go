import type { ScheduledClass } from '@/lib/schedule-store';
import { addDays, nowInRome, weekdayOf } from '@/lib/time-format';

export interface LessonPrefill {
  lesson: ScheduledClass;
  date: string;
  /** True when the lesson is today (otherwise it is the next one this week). */
  today: boolean;
}

/**
 * Lesson to prefill: today's next lesson that has not started yet, otherwise
 * the first upcoming lesson in the next 7 days. Times are Europe/Rome.
 */
export function pickLessonToPrefill(
  lessons: ScheduledClass[],
  now = new Date(),
): LessonPrefill | null {
  if (!lessons.length) return null;
  const rome = nowInRome(now);
  for (let offset = 0; offset <= 7; offset += 1) {
    const date = addDays(rome.date, offset);
    const weekday = weekdayOf(date);
    const candidates = lessons
      .filter((lesson) => lesson.weekday === weekday)
      .filter((lesson) => offset > 0 || lesson.time > rome.time)
      .sort((a, b) => a.time.localeCompare(b.time));
    if (candidates.length) return { lesson: candidates[0], date, today: offset === 0 };
  }
  return null;
}
