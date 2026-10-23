import type { NearbySolution, PlannerName } from '@/lib/api/types';
import { describeSlack, leaveVerb, trainLabel, trainLeg } from '@/lib/itinerary-summary';
import { formatClock, formatShortDate } from '@/lib/time-format';
import { ItineraryTimeline } from './itinerary-timeline';

const titles = { previous: 'Soluzione precedente', next: 'Soluzione successiva' } as const;

export function NearbySolutions({
  nearby,
  planner,
  requestDate,
}: {
  nearby: NearbySolution[];
  planner: PlannerName;
  requestDate?: string;
}) {
  if (!nearby.length) return null;
  return (
    <div className="mt-5 space-y-3 text-left">
      {nearby.map(({ kind, itinerary }) => {
        const train = trainLeg(itinerary);
        const otherDay = itinerary.date && itinerary.date !== requestDate;
        return (
          <details className="nearby-card" key={kind}>
            <summary>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                {titles[kind]}
                {otherDay && itinerary.date ? ` · ${formatShortDate(itinerary.date)}` : ''}
              </span>
              <span className="mt-1 block font-bold text-ink dark:text-white">
                {leaveVerb(planner)} {formatClock(itinerary.leave_at)}
                {train ? ` · ${trainLabel(train)}` : ''}
              </span>
              <span className="block text-sm text-slate-700 dark:text-slate-300">
                arrivo {formatClock(itinerary.arrive_at)}
                {/* Slack across different days is meaningless ("33 h prima"). */}
                {otherDay ? '' : ` · ${describeSlack(planner, itinerary.slack_min)}`}
              </span>
            </summary>
            <div className="mt-4">
              <ItineraryTimeline itinerary={itinerary} />
            </div>
          </details>
        );
      })}
    </div>
  );
}
