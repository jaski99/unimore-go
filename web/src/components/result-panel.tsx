import type { ReactNode } from 'react';
import type { ModeSuggestion, PlanResponse, PlannerName } from '@/lib/api/types';
import type { PlanStatus } from '@/hooks/use-plan';
import {
  describeSlack,
  hasCalendarNotes,
  hasUnverifiedFestive,
  leaveVerb,
  needsDifferentTicket,
  slackCaption,
  stationWaitMinutes,
  trainLabel,
  trainLeg,
} from '@/lib/itinerary-summary';
import { festiveSummary } from '@/lib/festive-summary';
import { groupNotices, noticesOf } from '@/lib/notices';
import { formatClock, formatDuration, formatShortDate } from '@/lib/time-format';
import { HelpTip } from './help-tip';
import { Icon } from './icons';
import { FestiveChip, FestiveNotice } from './festive-notice';
import { ItineraryTimeline, TicketBadge } from './itinerary-timeline';
import { ModeSuggestionCallout } from './mode-suggestion';
import { NearbySolutions } from './nearby-solutions';
import { AlertList, CalculationNote, InfoList, RealtimeBox } from './result-notices';

/** Round 4, point 7: says what the minutes are for (was "Tempo per uscire dall’aula"). */
export const RETURN_SLACK_LABEL = 'Minuti per lasciare la sede dopo la lezione';
export const RETURN_SLACK_HELP =
  'Tempo tra la fine della lezione e l’uscita dalla sede per prendere questo treno.';

export interface ResultContext {
  planner: PlannerName;
  date: string;
  time: string;
  campusName?: string;
  /** Minimum margin chosen by the user (explains the "Anticipo" stat). */
  marginMin?: number;
  /** "Proposta: inizio lezione + 2 ore (11:00)…" when the lesson end was proposed. */
  proposal?: string;
}

interface ResultPanelProps {
  status: PlanStatus;
  result: PlanResponse | null;
  error: string | null;
  onRetry: () => void;
  context?: ResultContext;
  /** Buttons under the stats (calendar, share), only for a found itinerary. */
  actions?: ReactNode;
  /** Extra content at the end of the card (e.g. "Calcola il ritorno"). */
  footer?: ReactNode;
  /** Heading level offset for a nested panel (the return under the outbound). */
  nested?: boolean;
  /** "Usa la bici": re-plan with the suggested mode (round 4, point 2). */
  onUseSuggestion?: (suggestion: ModeSuggestion) => void;
}

export function ResultPanel({
  status,
  result,
  error,
  onRetry,
  context,
  actions,
  footer,
  nested = false,
  onUseSuggestion,
}: ResultPanelProps) {
  if (status === 'idle') return nested ? null : <EmptyPrompt />;
  if (status === 'loading') return <LoadingSkeleton />;
  if (status === 'error')
    return (
      <ErrorState
        message={error ?? 'Si è verificato un errore.'}
        onRetry={onRetry}
        titleId={nested ? 'return-result-title' : 'result-title'}
      />
    );

  const planner: PlannerName = result?.planner ?? context?.planner ?? 'arrive_by';
  const groups = groupNotices(noticesOf(result));
  const itinerary = result?.itineraries[0];
  const titleId = nested ? 'return-result-title' : 'result-title';

  if (!itinerary)
    return (
      <EmptyResult
        planner={planner}
        result={result}
        requestDate={context?.date}
        proposal={context?.proposal}
        groups={groups}
        titleId={titleId}
        footer={footer}
        nested={nested}
      />
    );

  const train = trainLeg(itinerary);
  const wait = stationWaitMinutes(itinerary);
  // Round 5, point 4: one holiday notice at the top replaces the long one below.
  const festive = festiveSummary(noticesOf(result), result!.itineraries);
  const infos = festive
    ? groups.infos.filter((notice) => notice.code !== 'festive_day')
    : groups.infos;
  const isReturn = planner === 'depart_after';
  const Title = nested ? 'h3' : 'h2';

  return (
    <section
      className={`result-card ${nested ? 'result-card-nested' : ''}`}
      aria-live="polite"
      aria-labelledby={titleId}
    >
      <div className="result-banner">
        <p className="result-eyebrow">
          {isReturn ? 'Ritorno' : 'Andata'}
          {context
            ? ` · ${formatShortDate(context.date)} · lezione ${isReturn ? 'fino alle' : 'alle'} ${context.time}`
            : ''}
        </p>
        <Title id={titleId} className="result-title" tabIndex={-1}>
          {leaveVerb(planner)} <span>{formatClock(itinerary.leave_at)}</span>
        </Title>
        <p className="mt-1 text-sm text-white">
          {train
            ? `${trainLabel(train)} alle ${formatClock(train.depart)} da ${train.from}${wait ? ` · ${formatDuration(wait)} in stazione` : ''}`
            : `Diretto ${itinerary.legs[0]?.type === 'bike' ? 'in bici' : 'a piedi'}, senza treno`}
        </p>
        {context?.campusName && (
          <p className="mt-0.5 truncate text-xs text-white/90">
            {isReturn ? 'Da ' : 'Verso '}
            {context.campusName}
          </p>
        )}
        {result?.suggestion && onUseSuggestion && (
          <ModeSuggestionCallout
            suggestion={result.suggestion}
            itinerary={itinerary}
            onUse={onUseSuggestion}
          />
        )}
        {needsDifferentTicket(itinerary) && (
          <p className="mt-3 flex flex-wrap gap-2">
            <TicketBadge />
          </p>
        )}
      </div>
      <dl className="result-stats">
        <div>
          <dt className="stat-label">{isReturn ? 'Arrivo' : 'Arrivo in sede'}</dt>
          <dd className="stat-value">{formatClock(itinerary.arrive_at)}</dd>
        </div>
        <div>
          <dt className="stat-label">
            {isReturn ? RETURN_SLACK_LABEL : 'Anticipo'}
            <HelpTip label={isReturn ? RETURN_SLACK_LABEL : 'Anticipo'} align="end">
              {isReturn
                ? RETURN_SLACK_HELP
                : `Minuti tra l’arrivo in sede e l’inizio della lezione. Comprende l’anticipo minimo che hai scelto${context?.marginMin !== undefined ? ` (${formatDuration(context.marginMin)})` : ''}.`}
            </HelpTip>
          </dt>
          <dd className="stat-value text-pine dark:text-emerald-300">
            {formatDuration(itinerary.slack_min)}
          </dd>
          <dd className="text-xs text-slate-600 dark:text-slate-400">
            {slackCaption(planner, itinerary.slack_min)}
          </dd>
        </div>
        {itinerary.duration_min !== undefined && (
          <div>
            <dt className="stat-label">Porta a porta</dt>
            <dd className="stat-value">{formatDuration(itinerary.duration_min)}</dd>
          </div>
        )}
        {itinerary.changes !== undefined && (
          <div>
            <dt className="stat-label">Cambi</dt>
            <dd className="stat-value">
              {itinerary.changes === 0 ? 'Nessuno' : itinerary.changes}
            </dd>
            {train && itinerary.changes === 0 && (
              <dd className="text-xs text-slate-600 dark:text-slate-400">treno diretto</dd>
            )}
          </div>
        )}
      </dl>
      <div className="space-y-4 p-5 sm:p-6">
        {festive && <FestiveNotice summary={festive} />}
        {context?.proposal && <ProposalNote text={context.proposal} />}
        {actions}
        <CalculationNote calculation={result?.calculation} />
        <AlertList notices={groups.alerts} />
        <div>
          <h3 className="mb-4 text-base font-bold text-ink dark:text-white">Il tuo percorso</h3>
          <ItineraryTimeline itinerary={itinerary} />
        </div>
        {result!.itineraries.length > 1 && (
          <div className="space-y-2">
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
                      {option.duration_min !== undefined
                        ? ` · ${formatDuration(option.duration_min)}`
                        : ''}
                      {needsDifferentTicket(option) ? ' · biglietto diverso' : ''}
                      {hasUnverifiedFestive(option) && (
                        <>
                          {' '}
                          <FestiveChip />
                        </>
                      )}
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
        <InfoList notices={infos} />
        {train && <RealtimeBox train={train} notice={groups.realtime} />}
        {footer}
      </div>
    </section>
  );
}

/** A proposed lesson end is never silent (round 4, point 5). */
function ProposalNote({ text }: { text: string }) {
  return (
    <p className="proposal-note">
      <Icon name="clock" className="h-4 w-4 shrink-0" />
      <span>{text}</span>
    </p>
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
        Scegli sede e orario della lezione, poi premi <strong>Calcola</strong>: ti diciamo quando
        uscire.
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

function ErrorState({
  message,
  onRetry,
  titleId,
}: {
  message: string;
  onRetry: () => void;
  titleId: string;
}) {
  return (
    <div className="result-placeholder" role="alert">
      <div className="error-icon">!</div>
      <h2 id={titleId} tabIndex={-1} className="mt-4 text-lg font-bold text-ink dark:text-white">
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
  result,
  requestDate,
  proposal,
  groups,
  titleId,
  footer,
  nested,
}: {
  nested: boolean;
  proposal?: string;
  planner: PlannerName;
  result: PlanResponse | null;
  requestDate?: string;
  groups: ReturnType<typeof groupNotices>;
  titleId: string;
  footer?: ReactNode;
}) {
  return (
    <section className="result-placeholder" aria-live="polite" aria-labelledby={titleId}>
      <div className="placeholder-art placeholder-art-muted">
        <Icon name="train" className="h-8 w-8" />
      </div>
      {nested ? (
        <h3 id={titleId} tabIndex={-1} className="mt-4 text-lg font-bold text-ink dark:text-white">
          Nessun treno utile per il ritorno
        </h3>
      ) : (
        <h2 id={titleId} tabIndex={-1} className="mt-4 text-lg font-bold text-ink dark:text-white">
          Nessun treno utile
        </h2>
      )}
      {/* One explanation only: the API notice (which already contains the
          calculation), or the alert (e.g. out of validity), or a generic line.
          No calculation box without a result for the date (review B2/B3). */}
      {(groups.noService || !groups.alerts.length) && (
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-700 dark:text-slate-300">
          {groups.noService?.message ??
            'Non c’è un treno utile per questo orario. Prova un altro orario o un altro giorno.'}
        </p>
      )}
      <div className="w-full max-w-md space-y-4 text-left">
        {proposal && <ProposalNote text={proposal} />}
        <AlertList notices={groups.alerts} />
        <NearbySolutions
          nearby={result?.nearby ?? []}
          planner={planner}
          requestDate={requestDate}
        />
        <InfoList notices={groups.infos} />
        <RealtimeBox notice={groups.realtime} />
        {footer}
      </div>
    </section>
  );
}
