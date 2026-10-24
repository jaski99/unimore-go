import type { Itinerary, ModeSuggestion } from '@/lib/api/types';
import { suggestionText } from '@/lib/mode-suggestion';
import { Icon } from './icons';

/**
 * Same-city walk over 20 min (round 4, point 2): the bike time, highlighted
 * right under the result title with its "Usa la bici" button (round 5, point
 * 3). Only the button changes the mode; the chosen walk stays until then.
 */
export function ModeSuggestionCallout({
  suggestion,
  itinerary,
  onUse,
}: {
  suggestion: ModeSuggestion;
  itinerary: Itinerary | undefined;
  onUse: (suggestion: ModeSuggestion) => void;
}) {
  const { headline, detail } = suggestionText(suggestion, itinerary);
  return (
    <div className="suggestion-callout" role="group" aria-label="Suggerimento: bici">
      <Icon name="bike" className="h-6 w-6 shrink-0 text-pine dark:text-emerald-300" />
      <p className="min-w-0 flex-1">
        <strong className="block text-base">{headline}</strong>
        {detail && <span className="block text-sm font-normal">{detail}</span>}
      </p>
      <button type="button" className="suggestion-button" onClick={() => onUse(suggestion)}>
        Usa la bici
      </button>
    </div>
  );
}
