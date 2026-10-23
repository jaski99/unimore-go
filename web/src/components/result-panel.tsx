import type { PlanResponse, PlannerName } from '@/lib/api/types';
import type { PlanStatus } from '@/hooks/use-plan';
import {
  describeSlack,
  hasCalendarNotes,
  leaveVerb,
  needsDifferentTicket,
  slackCaption,
  stationWaitMinutes,
  trainLabel,
  trainLeg,
} from '@/lib/itinerary-summary';
import { formatClock, formatDuration, formatShortDate } from '@/lib/time-format';
import { Icon } from './icons';
import { ItineraryTimeline, TicketBadge } from './itinerary-timeline';
import { NearbySolutions } from './nearby-solutions';

export interface ResultContext {
  planner: PlannerName;
  date: string;
  time: string;
  campusName?: string;
}

interface ResultPanelProps {
  status: PlanStatus;
  result: PlanResponse | null;
  error: string | null;
  onRetry: () => void;
  context?: ResultContext;
}

/** Warnings that deserve an alert box instead of the small notes list. */
const isCritical = (warning: string) =>
  warning.startsWith('Attenzione') || warning.includes('festivo') || warning.includes('domenica');

export function ResultPanel({ status, result, error, onRetry, context }: ResultPanelProps) {
  if (status === 'idle') return <EmptyPrompt />;
  if (status === 'loading') return <LoadingSkeleton />;
  if (status === 'error')
    return <ErrorState message={error ?? 'Si è verificato un errore.'} onRetry={onRetry} />;

  const planner: PlannerName = result?.planner ?? context?.planner ?? 'arrive_by';
  const warnings = result?.warnings ?? [];
  const critical = warnings.filter(isCritical);
  const notes = warnings.filter((warning) => !isCritical(warning));
  const itinerary = result?.itineraries[0];

  if (!itinerary)
    return (
      <EmptyResult
        planner={planner}
        critical={critical}
        notes={notes}
        result={result}
        requestDate={context?.date}
      />
    );

  const train = trainLeg(itinerary);
  const wait = stationWaitMinutes(itinerary);
  const isReturn = planner === 'depart_after';

  return (
    <section className="result-card" aria-live="polite" aria-labelledby="result-title">
      <div className="result-banner">
        <p className="result-eyebrow">
          {isReturn ? 'Ritorno' : 'Andata'}
          {context
            ? ` · ${formatShortDate(context.date)} · lezione ${isReturn ? 'fino alle' : 'alle'} ${context.time}`
            : ''}
        </p>
        <h2 id="result-title" className="result-title">
          {leaveVerb(planner)} <span>{formatClock(itinerary.leave_at)}</span>
        </h2>
        <p className="mt-1 text-sm text-white">
          {train
            ? `${trainLabel(train)} alle ${formatClock(train.depart)} da ${train.from}${wait ? ` · ${wait} min in stazione` : ''}`
            : `Diretto ${itinerary.legs[0]?.type === 'bike' ? 'in bici' : 'a piedi'}, senza treno`}
        </p>
        {context?.campusName && (
          <p className="mt-0.5 truncate text-xs text-white/90">
            {isReturn ? 'Da ' : 'Verso '}
            {context.campusName}
          </p>
        )}
        {needsDifferentTicket(itinerary) && (
          <p className="mt-3">
            <TicketBadge />
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="p-4">
          <p className="stat-label">{isReturn ? 'A casa alle' : 'Arrivo in sede'}</p>
          <p className="mt-1 text-xl font-bold text-ink dark:text-white">
            {formatClock(itinerary.arrive_at)}
          </p>
        </div>
        <div className="p-4">
          <p className="stat-label">{isReturn ? 'Tempo libero' : 'Anticipo'}</p>
          <p className="mt-1 text-xl font-bold text-pine dark:text-emerald-300">
            {formatDuration(itinerary.slack_min)}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {slackCaption(planner, itinerary.slack_min)}
          </p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        {critical.map((warning) => (
          <p className="alert-box mb-4" role="alert" key={warning}>
            <Icon name="alert" className="h-5 w-5 shrink-0" />
            <span>{warning}</span>
          </p>
        ))}
        <h3 className="mb-4 text-base font-bold text-ink dark:text-white">Il tuo percorso</h3>
        <ItineraryTimeline itinerary={itinerary} />
        {result!.itineraries.length > 1 && (
          <div className="mt-2 space-y-2">
            <h3 className="text-sm font-bold text-ink dark:text-white">Alternative</h3>
            {result!.itineraries.slice(1, 3).map((option, index) => {
              const optionTrain = trainLeg(option);
              return (
                <details className="nearby-card" key={`${option.leave_at}-${index}`}>
                  <summary>
                    <span className="block font-semibold text-ink dark:text-white">
                      {leaveVerb(planner)} {formatClock(option.leave_at)}
                      {optionTrain ? ` · ${trainLabel(optionTrain)}` : ''}
                    </span>
                    <span className="block text-sm text-slate-700 dark:text-slate-300">
                      arrivo {formatClock(option.arrive_at)} ·{' '}
                      {describeSlack(planner, option.slack_min)}
                      {needsDifferentTicket(option) ? ' · biglietto diverso' : ''}
                      {hasCalendarNotes(option) ? ' · calendario da verificare' : ''}
                    </span>
                  </summary>
                  <div className="mt-4">
                    <ItineraryTimeline itinerary={option} />
                  </div>
                </details>
              );
            })}
          </div>
        )}
        {notes.length > 0 && <WarningList warnings={notes} />}
      </div>
    </section>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <div className="warning-note mt-4" role="note">
      <span className="warning-mark">i</span>
      <ul className="space-y-1">
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

function EmptyPrompt() {
  return (
    <div className="result-placeholder">
      <div className="placeholder-art">
        <Icon name="train" className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-ink dark:text-white">
        Il tuo tragitto, senza corse
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-700 dark:text-slate-400">
        Inserisci sede e orario della lezione: ti diciamo quando uscire.
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="result-card p-6" role="status" aria-label="Calcolo del percorso in corso">
      <span className="sr-only">Calcolo del percorso in corso…</span>
      <div className="skeleton h-32 rounded-2xl" />
      <div className="mt-5 grid grid-cols-2 gap-4">
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-16 rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="result-placeholder" role="alert">
      <div className="error-icon">!</div>
      <h2 className="mt-4 text-lg font-bold text-ink dark:text-white">
        Non siamo riusciti a calcolare il percorso
      </h2>
      <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">{message}</p>
      <button type="button" className="secondary-button mt-5" onClick={onRetry}>
        Riprova
      </button>
    </div>
  );
}

function EmptyResult({
  planner,
  critical,
  notes,
  result,
  requestDate,
}: {
  planner: PlannerName;
  critical: string[];
  notes: string[];
  result: PlanResponse | null;
  requestDate?: string;
}) {
  const headline = notes.find((warning) => warning.startsWith('Nessun treno utile'));
  const others = notes.filter((warning) => warning !== headline);
  return (
    <section className="result-placeholder" aria-live="polite" aria-labelledby="empty-title">
      <div className="placeholder-art placeholder-art-muted">
        <Icon name="train" className="h-8 w-8" />
      </div>
      <h2 id="empty-title" className="mt-4 text-lg font-bold text-ink dark:text-white">
        Nessun treno utile
      </h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-700 dark:text-slate-300">
        {headline ??
          'Non c’è un treno utile per questo orario. Prova un altro orario o un altro giorno.'}
      </p>
      <div className="w-full max-w-md">
        {critical.map((warning) => (
          <p className="alert-box mt-4 text-left" role="alert" key={warning}>
            <Icon name="alert" className="h-5 w-5 shrink-0" />
            <span>{warning}</span>
          </p>
        ))}
        <NearbySolutions
          nearby={result?.nearby ?? []}
          planner={planner}
          requestDate={requestDate}
        />
        {others.length > 0 && (
          <div className="text-left">
            <WarningList warnings={others} />
          </div>
        )}
      </div>
    </section>
  );
}
