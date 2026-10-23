'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campus, HealthResponse, Station } from '@/lib/api/types';
import { apiConfig } from '@/lib/api/config';
import { createPlanService } from '@/lib/api/plan-service';
import type { LessonPrefill } from '@/lib/lesson-prefill';
import { buildPlanRequest, validatePlannerValues } from '@/lib/plan-request';
import { buildRoute } from '@/lib/route-geometry';
import { LocalStorageScheduleStore } from '@/lib/schedule-store';
import { formatDate, formatShortDate } from '@/lib/time-format';
import { usePlan } from '@/hooks/use-plan';
import { usePlannerValues } from '@/hooks/use-planner-values';
import { Icon } from './icons';
import { MapPanel } from './map-panel';
import { PlanForm } from './plan-form';
import { ResultPanel, type ResultContext } from './result-panel';
import { SchedulePanel, type LessonSelection } from './schedule-panel';

const browserStorage = () => (typeof window === 'undefined' ? null : window.localStorage);
const isNarrowViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 1023px)').matches;

export function prefillMessage(prefill: LessonPrefill | null): string | undefined {
  if (!prefill) return undefined;
  return prefill.today
    ? `Dal tuo orario: lezione di oggi alle ${prefill.lesson.time}.`
    : `Dal tuo orario: prossima lezione ${formatShortDate(prefill.date)} alle ${prefill.lesson.time}.`;
}

export function PlannerShell() {
  const service = useMemo(() => createPlanService(), []);
  const { status, result, error, lastRequest, submit, retry } = usePlan(service);
  const { values, update, ready, prefill } = usePlannerValues(browserStorage);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [scheduleStore, setScheduleStore] = useState<LocalStorageScheduleStore | null>(null);
  const [picking, setPicking] = useState(false);
  const [context, setContext] = useState<ResultContext | undefined>();
  const demoMode = apiConfig.useMock;

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError('');
    try {
      const [campusItems, stationItems, healthInfo] = await Promise.all([
        service.getCampuses(),
        service.getStations(),
        service.getHealth(),
      ]);
      setCampuses(campusItems);
      setStations(stationItems);
      setHealth(healthInfo);
    } catch (cause) {
      setCatalogError(
        cause instanceof Error ? cause.message : 'Non è stato possibile caricare le sedi.',
      );
    } finally {
      setCatalogLoading(false);
    }
  }, [service]);

  useEffect(() => {
    void Promise.resolve().then(loadCatalog);
  }, [loadCatalog]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only available after client hydration.
    setScheduleStore(new LocalStorageScheduleStore(window.localStorage));
  }, []);

  const campusName = useCallback(
    (id: string) => campuses.find((campus) => campus.id === id)?.name,
    [campuses],
  );

  const plan = useCallback(() => {
    if (validatePlannerValues(values)) return;
    setContext({
      planner: values.direction === 'return' ? 'depart_after' : 'arrive_by',
      date: values.date,
      time: values.time,
      campusName: campusName(values.campusId),
    });
    void submit(buildPlanRequest(values));
  }, [values, submit, campusName]);

  // First visit: answer straight away with saved preferences / today's lesson.
  useEffect(() => {
    if (!ready || catalogLoading || catalogError || status !== 'idle') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off automatic plan after hydration.
    plan();
  }, [ready, catalogLoading, catalogError, status, plan]);

  function handleSubmit() {
    plan();
    if (isNarrowViewport())
      document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function handleScheduleSelect(selection: LessonSelection) {
    update({ ...selection, direction: 'outbound' });
  }

  const handlePick = useCallback(
    (lat: number, lon: number) => {
      update({
        originKind: 'home',
        home: { label: `Punto sulla mappa (${lat.toFixed(4)}, ${lon.toFixed(4)})`, lat, lon },
      });
      setPicking(false);
      document.getElementById('plan-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    [update],
  );

  const resultIsCurrent =
    !!lastRequest && JSON.stringify(lastRequest) === JSON.stringify(buildPlanRequest(values));
  const route = useMemo(
    () =>
      buildRoute(
        values,
        stations,
        campuses.find((campus) => campus.id === values.campusId),
        resultIsCurrent ? result?.itineraries[0] : undefined,
      ),
    [values, stations, campuses, resultIsCurrent, result],
  );

  return (
    <main className="min-h-screen bg-canvas text-ink dark:bg-slate-950 dark:text-slate-100">
      <header className="app-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
          <a className="flex items-center gap-3" href="#top" aria-label="UnimoreGo, vai all’inizio">
            <span className="brand-mark">
              <Icon name="arrow" className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight text-ink dark:text-white">
                Unimore<span className="text-pine dark:text-emerald-300">Go</span>
              </span>
              <span className="hidden text-[11px] font-medium text-slate-600 sm:block">
                Il tempo giusto per partire
              </span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${health?.status === 'ok' ? 'status-online' : ''}`}>
              <i />
              {demoMode
                ? 'Dati registrati'
                : health?.status === 'ok'
                  ? 'API collegata'
                  : catalogLoading
                    ? 'Connessione…'
                    : 'API non raggiungibile'}
            </span>
            {demoMode && <span className="demo-pill">MODALITÀ MOCK</span>}
          </div>
        </div>
      </header>

      <section id="top" className="hero-section">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-4 sm:px-8 sm:py-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:py-8">
          <div>
            <div className="hidden sm:block">
              <p className="hero-kicker">
                <Icon name="sun" className="h-4 w-4" /> Pensato per chi studia e si sposta
              </p>
            </div>
            <h1 className="hero-title">
              Arriva a lezione. <br className="hidden sm:block" />
              <span>Al momento giusto.</span>
            </h1>
            <p className="mt-4 hidden max-w-xl text-base leading-7 text-slate-700 dark:text-slate-300 sm:block sm:text-lg">
              UnimoreGo mette in fila treno e ultimo tratto a piedi o in bici. Tu scegli la lezione:
              al resto pensiamo noi.
            </p>
            <div className="mt-6 hidden flex-wrap gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 sm:flex">
              <span className="hero-chip">Reggio Emilia FS ↔ Modena FS</span>
              <span className="hero-chip">Orario ufficiale Trenitalia</span>
              <span className="hero-chip">Andata e ritorno</span>
            </div>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-station">
              <Icon name="train" className="h-9 w-9" />
            </div>
            <div className="hero-route">
              <span />
              <span />
              <span />
            </div>
            <div className="hero-campus">
              <Icon name="pin" className="h-8 w-8" />
            </div>
            <div className="hero-time">
              <Icon name="clock" className="h-4 w-4" /> 08:30
            </div>
            <div className="hero-hill hill-one" />
            <div className="hero-hill hill-two" />
          </div>
        </div>
      </section>

      {/* DOM order = mobile order (answer first); desktop places it in two columns. */}
      <div className="planner-grid mx-auto max-w-7xl px-4 pb-12 sm:px-8">
        <div id="result" className="planner-result scroll-mt-20">
          <ResultPanel
            status={status}
            result={result}
            error={error}
            onRetry={retry}
            context={context}
          />
        </div>
        <section
          id="plan-form"
          className="planner-form form-card scroll-mt-20"
          aria-labelledby="form-heading"
        >
          <div className="mb-5">
            <p className="section-kicker">Organizza il tragitto</p>
            <h2 id="form-heading" className="mt-1 text-xl font-bold text-ink dark:text-white">
              {values.direction === 'return'
                ? 'Quando finisce la lezione?'
                : 'Quando inizia la lezione?'}
            </h2>
          </div>
          {catalogLoading && (
            <div className="space-y-4" role="status" aria-label="Caricamento sedi e stazioni">
              {[1, 2, 3, 4].map((item) => (
                <div className="skeleton h-12 rounded-xl" key={item} />
              ))}
            </div>
          )}
          {!catalogLoading && catalogError && (
            <div
              role="alert"
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
            >
              <p>{catalogError}</p>
              <button
                type="button"
                className="mt-3 font-semibold underline"
                onClick={() => void loadCatalog()}
              >
                Riprova a caricare le sedi
              </button>
            </div>
          )}
          {!catalogLoading && !catalogError && (
            <PlanForm
              values={values}
              onChange={update}
              campuses={campuses}
              stations={stations}
              onSubmit={handleSubmit}
              loading={status === 'loading'}
              validTo={health?.data_valid_to}
              onSearchAddress={(query) => service.geocode(query).then((found) => found.results)}
              onPickOnMap={() => setPicking((current) => !current)}
              pickingOnMap={picking}
              prefillNote={prefillMessage(prefill)}
            />
          )}
        </section>
        <div className="planner-map">
          {!catalogLoading && <MapPanel route={route} picking={picking} onPick={handlePick} />}
        </div>
        <div className="planner-schedule">
          {catalogError || catalogLoading ? null : (
            <SchedulePanel
              store={scheduleStore}
              campuses={campuses}
              values={values}
              service={service}
              onSelectClass={handleScheduleSelect}
            />
          )}
        </div>
      </div>
      <footer className="app-footer">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-8 dark:text-slate-400">
          <span>
            UnimoreGo · progetto portfolio · orari programmati Trenitalia, non in tempo reale
          </span>
          <span>
            {health
              ? `Orario valido fino al ${formatDate(`${health.data_valid_to}T12:00:00`)} · mappe e indirizzi © OpenStreetMap contributors (ODbL)`
              : 'Mappe e indirizzi © OpenStreetMap contributors (ODbL)'}
          </span>
        </div>
      </footer>
    </main>
  );
}
