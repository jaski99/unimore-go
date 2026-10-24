import type { Itinerary, Leg, PlannerName } from '@/lib/api/types';
import { formatDuration } from '@/lib/time-format';

export const DIFFERENT_TICKET_LABEL = 'Biglietto diverso / supplemento';

export function trainLeg(itinerary: Itinerary): Leg | undefined {
  return itinerary.legs.find((leg) => leg.type === 'train');
}

export function needsDifferentTicket(itinerary: Itinerary): boolean {
  return itinerary.legs.some((leg) => leg.train?.different_ticket);
}

/** Shown next to a train whose Sunday/holiday service the timetable does not confirm. */
export const FESTIVE_UNVERIFIED_LABEL = 'Circolazione nei festivi da verificare';

export function hasUnverifiedFestive(itinerary: Itinerary): boolean {
  return itinerary.legs.some((leg) => leg.train?.festive_unverified);
}

export function hasCalendarNotes(itinerary: Itinerary): boolean {
  return itinerary.legs.some((leg) => (leg.notes?.length ?? 0) > 0);
}

/** "RV 3907" (falls back to the long category when the code is missing). */
export function trainLabel(leg: Leg | undefined): string {
  if (!leg?.train) return '';
  return `${leg.train.code || leg.train.category} ${leg.train.number}`;
}

/** Headline verb: outbound "Esci alle", return "Parti alle" (leave the campus). */
export function leaveVerb(planner: PlannerName): string {
  return planner === 'depart_after' ? 'Parti alle' : 'Esci alle';
}

/** Human meaning of slack_min for the given planner. */
export function describeSlack(planner: PlannerName, slack: number): string {
  if (planner === 'depart_after') {
    if (slack < 0) return `${formatDuration(slack)} prima della fine lezione`;
    return slack === 0 ? 'subito dopo la lezione' : `${formatDuration(slack)} dopo la lezione`;
  }
  if (slack < 0) return `arrivi ${formatDuration(slack)} dopo l’inizio`;
  return `${formatDuration(slack)} prima dell’inizio`;
}

/** Station wait leg minutes, 0 if absent. */
export function stationWaitMinutes(itinerary: Itinerary): number {
  return itinerary.legs.find((leg) => leg.type === 'wait')?.minutes ?? 0;
}

/** Caption under the slack number ("12 min" + caption). */
export function slackCaption(planner: PlannerName, slack: number): string {
  if (planner === 'depart_after') return slack < 0 ? 'prima della fine lezione' : 'dopo la lezione';
  return slack < 0 ? 'di ritardo sull’inizio' : 'prima dell’inizio';
}
