import type { FestiveSummary } from '@/lib/festive-summary';
import { FESTIVE_BADGE_HELP, FESTIVE_SHORT_LABEL } from '@/lib/festive-summary';
import { FESTIVE_UNVERIFIED_LABEL } from '@/lib/itinerary-summary';
import { Icon } from './icons';

/**
 * The one holiday notice at the top of a result (round 5, point 4): a short
 * headline, the long texts under "Dettagli".
 */
export function FestiveNotice({ summary }: { summary: FestiveSummary }) {
  return (
    <div className="festive-notice" role="note">
      <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{summary.headline}</p>
        {summary.details.length > 0 && (
          <details className="mt-1">
            <summary className="cursor-pointer text-sm font-semibold underline">Dettagli</summary>
            <div className="mt-2 space-y-2 text-sm font-normal">
              {summary.details.map((text) => (
                <p key={text}>{text}</p>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Short badge next to a run whose holiday service is not verified: the full
 * wording is the tooltip and what screen readers announce.
 */
export function FestiveChip() {
  return (
    <span className="festive-chip" title={FESTIVE_BADGE_HELP}>
      <Icon name="alert" className="h-3.5 w-3.5" />
      <span aria-hidden="true">{FESTIVE_SHORT_LABEL}</span>
      <span className="sr-only">{FESTIVE_UNVERIFIED_LABEL}</span>
    </span>
  );
}
