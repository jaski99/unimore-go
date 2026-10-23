'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Campus, HealthResponse, PlanRequest, Station } from '@/lib/api/types';
import { createPlanService } from '@/lib/api/plan-service';
import { LocalStorageScheduleStore } from '@/lib/schedule-store';
import { toRomeIso } from '@/lib/time-format';
import { usePlan } from '@/hooks/use-plan';
import { Icon } from './icons';
import { MapPanel } from './map-panel';
import { PlanForm, type FormPrefill } from './plan-form';
import { ResultPanel } from './result-panel';
import { SchedulePanel } from './schedule-panel';

export function PlannerShell() {
  const service = useMemo(() => createPlanService(), []);
  const { status, result, error, submit, retry } = usePlan(service);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [scheduleStore, setScheduleStore] = useState<LocalStorageScheduleStore | null>(null);
  const [prefill, setPrefill] = useState<FormPrefill | null>(null);
  const [selectedCampusId, setSelectedCampusId] = useState('dief');
  const [selectedStationId, setSelectedStationId] = useState('reggio-emilia-fs');
  const demoMode = process.env.NEXT_PUBLIC_API_MODE !== 'http';

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

  useEffect(() => {
    if (catalogLoading || catalogError || status !== 'idle') return;
    const initialRequest: PlanRequest = {
      origin: { station_id: 'reggio-emilia-fs' },
      campus_id: 'dief',
      arrive_by: toRomeIso('2026-10-26', '08:30'),
      mode: 'bike',
      margin_min: 10,
      home_to_station_min: 14,
    };
    void submit(initialRequest);
  }, [catalogError, catalogLoading, status, submit]);

  const selectedCampus = campuses.find((campus) => campus.id === selectedCampusId);
  const selectedStation = stations.find((station) => station.id === selectedStationId);

  function handlePlan(request: PlanRequest) {
    if ('station_id' in request.origin) setSelectedStationId(request.origin.station_id);
    setSelectedCampusId(request.campus_id);
    void submit(request);
  }

  const handleSelectionChange = useCallback(
    (selection: { campusId: string; stationId: string }) => {
      setSelectedCampusId(selection.campusId);
      setSelectedStationId(selection.stationId);
    },
    [],
  );

  function handleScheduleSelect(value: FormPrefill) {
    setPrefill(value);
    setSelectedCampusId(value.campusId);
  }

  return (
    <main className="min-h-screen bg-canvas text-ink dark:bg-slate-950 dark:text-slate-100">
      <header className="app-header">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8">
          <a className="flex items-center gap-3" href="#top" aria-label="UnimoreGo, vai all’inizio">
            <span className="brand-mark">
              <Icon name="arrow" className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight text-ink dark:text-white">
                Unimore<span className="text-pine dark:text-emerald-300">Go</span>
              </span>
              <span className="hidden text-[11px] font-medium text-slate-500 sm:block">
                Il tempo giusto per partire
              </span>
            </span>
          </a>
          <div className="flex items-center gap-2">
            <span className={`status-pill ${health?.status === 'ok' ? 'status-online' : ''}`}>
              <i />
              {health?.status === 'ok' ? 'Dati collegati' : 'Dati locali'}
            </span>
            {demoMode && <span className="demo-pill">MODALITÀ MOCK</span>}
          </div>
        </div>
      </header>

      <section id="top" className="hero-section">
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 py-8 sm:px-8 sm:py-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:py-16">
          <div>
            <p className="hero-kicker">
              <Icon name="sun" className="h-4 w-4" /> Pensato per chi studia e si sposta
            </p>
            <h1 className="hero-title">
              Arriva a lezione.
              <br />
              <span>Al momento giusto.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
              UnimoreGo mette in fila treno e ultimo tratto a piedi o in bici. Tu scegli la lezione:
              al resto pensiamo noi.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <span className="hero-chip">Reggio Emilia FS ↔ Modena FS</span>
              <span className="hero-chip">Solo treni regionali</span>
              <span className="hero-chip">Margine personalizzabile</span>
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

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 sm:px-8 lg:grid-cols-[minmax(340px,.88fr)_minmax(0,1.12fr)] lg:gap-7">
        <div className="space-y-6">
          <section id="plan-form" className="form-card" aria-labelledby="form-heading">
            <div className="mb-6">
              <p className="section-kicker">Organizza il tragitto</p>
              <h2 id="form-heading" className="mt-1 text-xl font-bold text-ink dark:text-white">
                Quando inizia la tua lezione?
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
                campuses={campuses}
                stations={stations}
                onSubmit={handlePlan}
                prefill={prefill}
                loading={status === 'loading'}
                onSelectionChange={handleSelectionChange}
              />
            )}
          </section>
          {catalogError || catalogLoading ? null : (
            <SchedulePanel
              store={scheduleStore}
              campuses={campuses}
              stations={stations}
              service={service}
              onSelectClass={handleScheduleSelect}
            />
          )}
        </div>
        <div className="space-y-6">
          <ResultPanel status={status} result={result} error={error} onRetry={retry} />
          {!catalogLoading && <MapPanel campus={selectedCampus} station={selectedStation} />}
        </div>
      </div>
      <footer className="app-footer">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>UnimoreGo · prototipo portfolio, non un servizio di viaggio in tempo reale</span>
          <span>
            {health
              ? `Dati mock disponibili al ${health.data_valid_to}`
              : 'OpenStreetMap per la cartografia'}
          </span>
        </div>
      </footer>
    </main>
  );
}
