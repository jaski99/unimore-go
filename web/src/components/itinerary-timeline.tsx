import type { Itinerary, Leg } from '@/lib/api/types';
import { formatClock } from '@/lib/time-format';
import { Icon } from './icons';

const labels: Record<Leg['type'], string> = { walk: 'A piedi', bike: 'In bici', train: 'Treno' };

/** Hide zero-length active legs (e.g. when the trip already starts at the station). */
export function visibleLegs(legs: Leg[]): Leg[] {
  return legs.filter((leg) => leg.type === 'train' || leg.minutes > 0);
}

export function ItineraryTimeline({ itinerary }: { itinerary: Itinerary }) {
  return (
    <ol className="timeline" aria-label="Tratte del viaggio">
      {visibleLegs(itinerary.legs).map((leg, index) => (
        <li className="timeline-item" key={`${leg.type}-${leg.depart}-${index}`}>
          <div className={`timeline-icon ${leg.type === 'train' ? 'timeline-icon-train' : ''}`}>
            <Icon name={leg.type} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <p className="font-semibold text-ink dark:text-white">
                {labels[leg.type]}
                {leg.train ? (
                  <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {leg.train.category} · {leg.train.number}
                  </span>
                ) : null}
              </p>
              <span className="text-sm tabular-nums text-slate-600 dark:text-slate-300">
                {formatClock(leg.depart)}–{formatClock(leg.arrive)}{' '}
                <span className="text-slate-400">· {leg.minutes} min</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {leg.from} <span aria-hidden="true">→</span> {leg.to}
            </p>
            {leg.train && (
              <p className="mt-1 text-xs text-slate-500">
                {leg.train.operator} · orario programmato, non in tempo reale
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
