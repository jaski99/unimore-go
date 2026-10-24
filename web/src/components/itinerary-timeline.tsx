import type { Itinerary, Leg } from '@/lib/api/types';
import {
  DIFFERENT_TICKET_LABEL,
  FESTIVE_UNVERIFIED_LABEL,
  trainLabel,
} from '@/lib/itinerary-summary';
import { formatClock, formatDuration } from '@/lib/time-format';
import { Icon } from './icons';

const labels: Record<Leg['type'], string> = {
  walk: 'A piedi',
  bike: 'In bici',
  train: 'Treno',
  wait: 'In stazione',
};

/** Defensive: never show 0-minute walk/bike/wait legs (the API no longer sends them). */
export function visibleLegs(legs: Leg[]): Leg[] {
  return legs.filter((leg) => leg.type === 'train' || leg.minutes > 0);
}

export function TicketBadge() {
  return (
    <span className="ticket-badge">
      <Icon name="ticket" className="h-3.5 w-3.5" />
      {DIFFERENT_TICKET_LABEL}
    </span>
  );
}

/** Next to a train whose Sunday/holiday service is not confirmed by the timetable. */
export function FestiveBadge() {
  return (
    <span className="festive-badge">
      <Icon name="alert" className="h-3.5 w-3.5" />
      {FESTIVE_UNVERIFIED_LABEL}
    </span>
  );
}

function legDescription(leg: Leg): string {
  if (leg.type === 'wait') return `${leg.from}: biglietto e binario`;
  return `${leg.from} → ${leg.to}`;
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
                {leg.train ? <span className="train-chip">{trainLabel(leg)}</span> : null}
              </p>
              <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                {formatClock(leg.depart)}–{formatClock(leg.arrive)}{' '}
                <span className="text-slate-600 dark:text-slate-400">
                  · {formatDuration(leg.minutes)}
                </span>
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{legDescription(leg)}</p>
            {(leg.train?.different_ticket || leg.train?.festive_unverified) && (
              <p className="mt-2 flex flex-wrap gap-2">
                {leg.train.different_ticket && <TicketBadge />}
                {leg.train.festive_unverified && <FestiveBadge />}
              </p>
            )}
            {leg.train && (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {leg.train.category} · {leg.train.operator} · orario programmato
              </p>
            )}
            {leg.notes?.map((note) => (
              <details className="calendar-note" key={note}>
                <summary>
                  <Icon name="alert" className="h-4 w-4 shrink-0" /> Calendario da verificare
                </summary>
                <p>{note}</p>
              </details>
            ))}
          </div>
        </li>
      ))}
    </ol>
  );
}
