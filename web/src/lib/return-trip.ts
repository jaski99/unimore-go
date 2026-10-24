import type { PlanResponse } from '@/lib/api/types';
import type { PlanStatus } from '@/hooks/use-plan';
import { isOutOfValidity } from '@/lib/notices';
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
 * The single rule for a valid outbound answer (round 4, point 3; round 5,
 * point 1): an itinerary was found and the date is covered by the timetable.
 * A same-city walk out of the validity window is not valid: the API returns
 * the walk, but no train data exist for that day.
 */
export function isValidOutbound(result: PlanResponse | null | undefined): boolean {
  return !!result?.itineraries.length && !isOutOfValidity(result);
}

/**
 * "E per tornare?" (the box, the return result and the return map) belongs to
 * a valid outbound answer of an outbound search only.
 */
export function shouldOfferReturn(
  direction: 'outbound' | 'return' | undefined,
  status: PlanStatus,
  result: PlanResponse | null,
): boolean {
  return direction === 'outbound' && status === 'success' && isValidOutbound(result);
}
