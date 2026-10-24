import type { PlanResponse } from '@/lib/api/types';
import type { PlanStatus } from '@/hooks/use-plan';
import { addMinutesClamped } from '@/lib/time-format';

/** Default lesson length used to propose the lesson end (review B7). */
export const PROPOSED_LESSON_MINUTES = 120;

/** Lesson start "09:00" -> proposed lesson end "11:00" (clamped to the same day). */
export function proposeLessonEnd(lessonStart: string): string {
  return addMinutesClamped(lessonStart, PROPOSED_LESSON_MINUTES);
}

/** The sentence shown wherever a proposed (not chosen) lesson end is used. */
export function proposalText(lessonEnd: string): string {
  return `Proposta: inizio lezione + 2 ore (${lessonEnd}). Modificala con l’orario reale di fine lezione.`;
}

/**
 * "E per tornare?" belongs to a valid outbound answer only: a found
 * itinerary for an outbound search (round 4, point 3). No useful train, an
 * error or a date out of the timetable never offer the return.
 */
export function shouldOfferReturn(
  direction: 'outbound' | 'return' | undefined,
  status: PlanStatus,
  result: PlanResponse | null,
): boolean {
  return direction === 'outbound' && status === 'success' && !!result?.itineraries.length;
}
