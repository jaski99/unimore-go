'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Campus, HealthResponse, ModeSuggestion, Station } from '@/lib/api/types';
import { apiConfig } from '@/lib/api/config';
import { createPlanService } from '@/lib/api/plan-service';
import type { LessonPrefill } from '@/lib/lesson-prefill';
import {
  buildPlanRequest,
  returnTripValues,
  validatePlannerValues,
  type PlannerValues,
} from '@/lib/plan-request';
import { shortCampusName } from '@/lib/campus-name';
import { buildRoute } from '@/lib/route-geometry';
import { LocalStorageScheduleStore } from '@/lib/schedule-store';
import { proposalText, proposeLessonEnd, shouldOfferReturn } from '@/lib/return-trip';
import { scrollToElement } from '@/lib/scroll';
import { formatShortDate, todayInRome } from '@/lib/time-format';
import { isCompleteSearch, parseSearch, serializeSearch, type UrlSearch } from '@/lib/url-state';
import { usePlan } from '@/hooks/use-plan';
import { shareUrl, useHistorySearch } from '@/hooks/use-history-search';
import { usePlannerValues } from '@/hooks/use-planner-values';
import { Icon } from './icons';
import { MapPanel, type MapView } from './map-panel';
import { PlanForm } from './plan-form';
import { ResultActions } from './result-actions';
import { ResultPanel, type ResultContext } from './result-panel';
import { ReturnTrip } from './return-trip';
import { SchedulePanel, type LessonSelection } from './schedule-panel';

const browserStorage = () => (typeof window === 'undefined' ? null : window.localStorage);
const isNarrowViewport = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(max-width: 1023px)').matches;

export const INVALID_LINK_MESSAGE =
  'Il link aperto è incompleto o contiene valori non validi: controlla i campi e premi Calcola.';

export function prefillMessage(prefill: LessonPrefill | null): string | undefined {
  if (!prefill) return undefined;
  return prefill.today
    ? `Dal tuo orario: lezione di oggi alle ${prefill.lesson.time}.`
    : `Dal tuo orario: prossima lezione ${formatShortDate(prefill.date)} alle ${prefill.lesson.time}.`;
}

/** A search the user (or a link) actually ran: the result belongs to these values. */
interface PlannedSearch {
  values: PlannerValues;
  /** Lesson end of the return view, once requested. */
  returnTime?: string;
  /** A return search whose lesson end was proposed by the link (start + 2 h). */
  proposedEnd?: string;
}

export function PlannerShell() {
  const service = useMemo(() => createPlanService(), []);
  const outbound = usePlan(service);
  const back = usePlan(service);
  const { values, update, apply, ready, prefill, urlSearch } = usePlannerValues(browserStorage);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [scheduleStore, setScheduleStore] = useState<LocalStorageScheduleStore | null>(null);
  const [picking, setPicking] = useState(false);
  const [planned, setPlanned] = useState<PlannedSearch | null>(null);
  const [returnTime, setReturnTime] = useState<string | null>(null);
  const [linkNotice, setLinkNotice] = useState('');
  /** Which trip the map draws once the return is calculated too (review B1). */
  const [mapView, setMapView] = useState<MapView>('outbound');
  const linkHandled = useRef(false);
  /** Move focus to the result title when the requested result arrives (point 11). */
  const focusResult = useRef(false);
  const demoMode = apiConfig.useMock;
  const today = todayInRome();

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

  /** A link may only run when it names a known campus (and station). */
  const linkIsValid = useCallback(
    (search: UrlSearch) =>
      isCompleteSearch(search) &&
      campuses.some((campus) => campus.id === search.patch.campusId) &&
      (!search.patch.stationId ||
        stations.some((station) => station.id === search.patch.stationId)),
    [campuses, stations],
  );

  /** Run a search; the return view is planned too when a lesson end is given. */
  const runSearch = useCallback(
    (searchValues: PlannerValues, lessonEnd?: string, proposedEnd?: string) => {
      if (validatePlannerValues(searchValues)) return false;
      const withReturn = searchValues.direction === 'outbound' ? lessonEnd : undefined;
      setPlanned({ values: searchValues, returnTime: withReturn, proposedEnd });
      setMapView('outbound');
      void outbound.submit(buildPlanRequest(searchValues));
      if (withReturn) {
        setReturnTime(withReturn);
        void back.submit(buildPlanRequest(returnTripValues(searchValues, withReturn)));
      } else back.reset();
      return true;
    },
    [outbound, back],
  );

  const clearSearch = useCallback(() => {
    outbound.reset();
    back.reset();
    setPlanned(null);
  }, [outbound, back]);

  // Back/Forward: show the search of that history entry (or none).
  const { push } = useHistorySearch((search) => {
    const parsed = parseSearch(search);
    const next = Object.keys(parsed.patch).length ? apply(parsed.patch) : values;
    setLinkNotice('');
    if (linkIsValid(parsed) && runSearch(next, parsed.returnTime, parsed.proposal?.lessonEnd))
      return;
    clearSearch();
  });

  // A shared link or a reload: plan straight away, only when the link is complete and valid.
  useEffect(() => {
    if (!ready || catalogLoading || catalogError || linkHandled.current) return;
    linkHandled.current = true;
    if (!urlSearch) return;
    const started =
      linkIsValid(urlSearch) &&
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off run of the opened link.
      runSearch(values, urlSearch.returnTime, urlSearch.proposal?.lessonEnd);
    if (!started) setLinkNotice(INVALID_LINK_MESSAGE);
  }, [ready, catalogLoading, catalogError, urlSearch, linkIsValid, runSearch, values]);

  /** Run `next`, record it in the history and bring the answer into view. */
  function planAndShow(next: PlannerValues) {
    if (!runSearch(next)) return;
    push(serializeSearch(next));
    focusResult.current = true;
    // Round 4, point 9: on phones the answer is below the form.
    if (isNarrowViewport()) scrollToElement('result');
  }

  function handleSubmit() {
    setLinkNotice('');
    planAndShow(values);
  }

  /** "Usa la bici" (round 4, point 2): same search with the suggested mode. */
  function handleUseSuggestion(suggestion: ModeSuggestion) {
    if (!planned) return;
    update({ mode: suggestion.mode });
    planAndShow({ ...planned.values, mode: suggestion.mode });
  }

  // The answer is announced by moving focus to its title (no extra scroll:
  // on narrow screens the scroll above already brings it into view).
  useEffect(() => {
    if (!focusResult.current || outbound.status === 'loading' || outbound.status === 'idle') return;
    focusResult.current = false;
    document.getElementById('result-title')?.focus({ preventScroll: true });
  }, [outbound.status]);

  const defaultReturnTime = planned ? proposeLessonEnd(planned.values.time) : '12:00';
  const effectiveReturnTime = returnTime ?? defaultReturnTime;
  // Review B7: a proposed lesson end is never silent.
  const returnTimeHint = returnTime === null ? proposalText(defaultReturnTime) : undefined;

  function handleReturn() {
    if (!planned) return;
    setPlanned({ ...planned, returnTime: effectiveReturnTime });
    setMapView('return');
    void back.submit(buildPlanRequest(returnTripValues(planned.values, effectiveReturnTime)));
    push(serializeSearch(planned.values, effectiveReturnTime));
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

  // While loading, `result` still belongs to the previous request: never mix them.
  const resultIsCurrent =
    outbound.status === 'success' &&
    !!outbound.lastRequest &&
    JSON.stringify(outbound.lastRequest) === JSON.stringify(buildPlanRequest(values));
  // The return trip of the planned search, once "Calcola il ritorno" ran.
  const returnValues = useMemo(
    () =>
      planned?.returnTime && planned.values.direction === 'outbound'
        ? returnTripValues(planned.values, planned.returnTime)
        : undefined,
    [planned],
  );
  const hasReturnView = !!returnValues && back.status !== 'idle';
  const showReturnOnMap = hasReturnView && mapView === 'return';
  const returnIsCurrent =
    !!returnValues &&
    back.status === 'success' &&
    JSON.stringify(back.lastRequest) === JSON.stringify(buildPlanRequest(returnValues));
  const route = useMemo(() => {
    const shown = showReturnOnMap ? returnValues! : values;
    const itinerary = showReturnOnMap
      ? returnIsCurrent
        ? back.result?.itineraries[0]
        : undefined
      : resultIsCurrent
        ? outbound.result?.itineraries[0]
        : undefined;
    return buildRoute(
      shown,
      stations,
      campuses.find((campus) => campus.id === shown.campusId),
      itinerary,
    );
  }, [
    showReturnOnMap,
    returnValues,
    values,
    stations,
    campuses,
    resultIsCurrent,
    returnIsCurrent,
    outbound.result,
    back.result,
  ]);

  const context: ResultContext | undefined = planned
    ? {
        planner: planned.values.direction === 'return' ? 'depart_after' : 'arrive_by',
        date: planned.values.date,
        time: planned.values.time,
        campusName: campusName(planned.values.campusId),
        marginMin: planned.values.marginMin,
        proposal: planned.proposedEnd ? proposalText(planned.proposedEnd) : undefined,
      }
    : undefined;
  // The form says the lesson end is a proposal until the user changes it.
  const timeHint =
    planned?.proposedEnd && values.direction === 'return' && values.time === planned.proposedEnd
      ? proposalText(planned.proposedEnd)
      : undefined;
  const link = planned ? shareUrl(serializeSearch(planned.values, planned.returnTime)) : '';
  const destination = (values_: PlannerValues | undefined) => {
    const campus = campuses.find((item) => item.id === values_?.campusId);
    return campus && shortCampusName(campus.name);
  };
  const mainItinerary = outbound.result?.itineraries[0];
  const returnItinerary = back.result?.itineraries[0];
  // Round 4, point 3: only under a valid outbound answer.
  const showReturn = shouldOfferReturn(planned?.values.direction, outbound.status, outbound.result);

  return (
    <main className="min-h-screen bg-canvas text-ink dark:bg-slate-950 dark:text-slate-100">
      <header className="app-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8 sm:py-4">
          <a className="flex items-center gap-3" href="#top">
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
              <span className="sr-only">, vai all’inizio</span>
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
              <span className="hero-chip">Reggio Emilia · Rubiera · Modena</span>
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

      {/* DOM order = mobile order: form, then the answer and the map right under the button. */}
      <div className="planner-grid mx-auto max-w-7xl px-4 pb-12 sm:px-8">
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
          {linkNotice && (
            <p role="alert" className="alert-box mb-4">
              <Icon name="alert" className="h-5 w-5 shrink-0" />
              <span>{linkNotice}</span>
            </p>
          )}
          {catalogLoading && (
            <div
              className="form-skeleton space-y-4"
              role="status"
              aria-label="Caricamento sedi e stazioni"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
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
              loading={outbound.status === 'loading'}
              validFrom={health?.data_valid_from}
              validTo={health?.data_valid_to}
              today={today}
              onSearchAddress={(query) => service.geocode(query).then((found) => found.results)}
              onPickOnMap={() => setPicking((current) => !current)}
              pickingOnMap={picking}
              prefillNote={prefillMessage(prefill)}
              timeHint={timeHint}
            />
          )}
        </section>
        <div id="result" className="planner-result scroll-mt-20">
          <ResultPanel
            status={outbound.status}
            result={outbound.result}
            error={outbound.error}
            onRetry={outbound.retry}
            context={context}
            onUseSuggestion={handleUseSuggestion}
            actions={
              mainItinerary && planned ? (
                <ResultActions
                  itinerary={mainItinerary}
                  planner={context!.planner}
                  date={planned.values.date}
                  destination={
                    planned.values.direction === 'outbound'
                      ? destination(planned.values)
                      : undefined
                  }
                  shareUrl={link}
                />
              ) : undefined
            }
            footer={
              showReturn ? (
                <ReturnTrip
                  endTime={effectiveReturnTime}
                  endTimeHint={returnTimeHint}
                  onEndTimeChange={setReturnTime}
                  onCalculate={handleReturn}
                  loading={back.status === 'loading'}
                >
                  {back.status !== 'idle' && (
                    <ResultPanel
                      nested
                      status={back.status}
                      result={back.result}
                      error={back.error}
                      onRetry={back.retry}
                      context={
                        planned
                          ? {
                              planner: 'depart_after',
                              date: planned.values.date,
                              time: planned.returnTime ?? effectiveReturnTime,
                              campusName: campusName(planned.values.campusId),
                            }
                          : undefined
                      }
                      actions={
                        returnItinerary && planned ? (
                          <ResultActions
                            itinerary={returnItinerary}
                            planner="depart_after"
                            date={planned.values.date}
                            shareUrl={link}
                          />
                        ) : undefined
                      }
                    />
                  )}
                </ReturnTrip>
              ) : undefined
            }
          />
        </div>
        <div className="planner-map">
          {!catalogLoading && (
            <MapPanel
              route={route}
              picking={picking}
              onPick={handlePick}
              view={hasReturnView ? { active: mapView, onChange: setMapView } : undefined}
            />
          )}
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
              ? `Orario valido fino a ${formatShortDate(health.data_valid_to)} · mappe e indirizzi © OpenStreetMap contributors (ODbL)`
              : 'Mappe e indirizzi © OpenStreetMap contributors (ODbL)'}
          </span>
        </div>
      </footer>
    </main>
  );
}
