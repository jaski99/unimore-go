import type { Itinerary, Notice } from '@/lib/api/types';
import { FESTIVE_UNVERIFIED_LABEL, hasUnverifiedFestive } from '@/lib/itinerary-summary';

/** Short badge next to a run whose holiday service is not verified (round 5, point 4). */
export const FESTIVE_SHORT_LABEL = 'Festivo?';

/** What the short badge means: its tooltip and the second paragraph of the details. */
export const FESTIVE_BADGE_HELP = `«${FESTIVE_SHORT_LABEL}» = ${FESTIVE_UNVERIFIED_LABEL.toLocaleLowerCase('it')}: il PDF Trenitalia non indica per questa corsa un calendario festivo (simbolo †, Ⓑ o Ⓒ, o una nota con la data).`;

export interface FestiveSummary {
  /** One or two lines, always visible. */
  headline: string;
  /** Long texts, shown under "Dettagli". */
  details: string[];
}

/**
 * The single holiday notice of a result (round 5, point 4): the API festive
 * notice and the per-run "not verified" flags folded into one short headline,
 * with the long texts kept for an expandable "Dettagli". Null on working days.
 */
export function festiveSummary(notices: Notice[], itineraries: Itinerary[]): FestiveSummary | null {
  const notice = notices.find((item) => item.code === 'festive_day');
  const unverified = itineraries.some(hasUnverifiedFestive);
  if (!notice && !unverified) return null;
  const headline = unverified
    ? `Festivo, servizio ridotto: verifica le corse «${FESTIVE_SHORT_LABEL}».`
    : 'Festivo, servizio ridotto: verifica su Trenitalia.';
  const details = [notice?.message, unverified ? FESTIVE_BADGE_HELP : undefined].filter(
    (text): text is string => !!text,
  );
  return { headline, details };
}
