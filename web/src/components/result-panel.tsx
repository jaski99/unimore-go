import type { PlanResponse } from '@/lib/api/types';
import type { PlanStatus } from '@/hooks/use-plan';
import { formatDate, formatTime } from '@/lib/time-format';
import { Icon } from './icons';
import { ItineraryTimeline } from './itinerary-timeline';

interface ResultPanelProps {
  status: PlanStatus;
  result: PlanResponse | null;
  error: string | null;
  onRetry: () => void;
}

export function ResultPanel({ status, result, error, onRetry }: ResultPanelProps) {
  if (status === 'idle') return <EmptyPrompt />;
  if (status === 'loading') return <LoadingSkeleton />;
  if (status === 'error')
    return <ErrorState message={error ?? 'Si è verificato un errore.'} onRetry={onRetry} />;

  const itinerary = result?.itineraries[0];
  if (!itinerary) return <EmptyResult warnings={result?.warnings ?? []} />;

  return (
    <section className="result-card" aria-live="polite" aria-label="Risultato del viaggio">
      <div className="result-banner">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="result-eyebrow">Il tuo orario</p>
            <h2 className="result-title">
              Esci alle <span>{formatTime(itinerary.leave_at)}</span>
            </h2>
            <p className="mt-1 text-sm text-emerald-50/90">per arrivare a lezione con calma</p>
          </div>
          <div className="rounded-2xl bg-white/15 p-3">
            <Icon name="spark" className="h-6 w-6" />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Arrivo previsto
          </p>
          <p className="mt-1 text-xl font-bold text-ink dark:text-white">
            {formatTime(itinerary.arrive_at)}
          </p>
          <p className="text-xs text-slate-500">{formatDate(itinerary.arrive_at)}</p>
        </div>
        <div className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Anticipo</p>
          <p className="mt-1 text-xl font-bold text-pine dark:text-emerald-300">
            {itinerary.slack_min} min
          </p>
          <p className="text-xs text-slate-500">prima dell’inizio lezione</p>
        </div>
      </div>
      <div className="p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink dark:text-white">Il tuo percorso</h3>
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-pine dark:bg-emerald-950 dark:text-emerald-300">
            {result?.itineraries.length ?? 1}{' '}
            {result?.itineraries.length === 1 ? 'opzione' : 'opzioni'}
          </span>
        </div>
        {result?.itineraries.slice(0, 3).map((option, index) => (
          <div
            key={`${option.leave_at}-${index}`}
            className={index > 0 ? 'mt-5 border-t border-slate-200 pt-5 dark:border-slate-700' : ''}
          >
            {index > 0 && (
              <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Alternativa {index + 1} · esci alle {formatTime(option.leave_at)}
              </p>
            )}
            <ItineraryTimeline itinerary={option} />
          </div>
        ))}
        {!!result?.warnings.length && (
          <div className="warning-note mt-1" role="note">
            <span className="warning-mark">i</span>
            <p>{result.warnings.join(' ')}</p>
          </div>
        )}
      </div>
    </section>
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
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
        Inserisci sede e orario della lezione: ti aiutiamo a pianificare l’uscita e ogni cambio di
        mezzo.
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
      <div className="mt-6 space-y-4">
        {[1, 2, 3].map((item) => (
          <div className="flex gap-3" key={item}>
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-4 w-1/3 rounded" />
              <div className="skeleton h-3 w-2/3 rounded" />
            </div>
          </div>
        ))}
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
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{message}</p>
      <button type="button" className="secondary-button mt-5" onClick={onRetry}>
        Riprova
      </button>
    </div>
  );
}

function EmptyResult({ warnings }: { warnings: string[] }) {
  return (
    <div className="result-placeholder" aria-live="polite">
      <div className="placeholder-art placeholder-art-muted">
        <Icon name="train" className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-ink dark:text-white">Nessun treno trovato</h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-400">
        Non abbiamo trovato un itinerario nel perimetro del prototipo. Prova un altro orario o una
        sede servita.
      </p>
      {warnings.map((warning) => (
        <p className="warning-note mt-4 text-left" key={warning}>
          {warning}
        </p>
      ))}
    </div>
  );
}
