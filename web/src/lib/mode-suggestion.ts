import type { Itinerary, ModeSuggestion } from '@/lib/api/types';
import { formatDuration } from '@/lib/time-format';

export interface SuggestionText {
  /** "In bici circa 22 min" */
  headline: string;
  /** "A piedi 53 min, il mezzo che hai scelto." (absent without walk legs) */
  detail?: string;
}

/** Minutes on foot in an itinerary (the same-city walk the suggestion replaces). */
export function walkMinutes(itinerary: Itinerary | undefined): number {
  return (itinerary?.legs ?? [])
    .filter((leg) => leg.type === 'walk')
    .reduce((total, leg) => total + leg.minutes, 0);
}

/**
 * Text of the bike suggestion (round 5, point 3): the bike time first, then the
 * walk the user chose, which stays the chosen mode until "Usa la bici".
 */
export function suggestionText(
  suggestion: ModeSuggestion,
  itinerary: Itinerary | undefined,
): SuggestionText {
  const walk = walkMinutes(itinerary);
  return {
    headline: `In bici circa ${formatDuration(suggestion.minutes)}`,
    detail: walk > 0 ? `A piedi ${formatDuration(walk)}, il mezzo che hai scelto.` : undefined,
  };
}
