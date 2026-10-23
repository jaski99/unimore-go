'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { Campus, PlanRequest, Station, TravelMode } from '@/lib/api/types';
import { buildPlanRequest, DEFAULT_PLANNER_VALUES } from '@/lib/plan-request';
import { CampusSearch } from './campus-search';
import { Icon } from './icons';

export interface FormPrefill {
  campusId: string;
  date: string;
  time: string;
}

interface PlanFormProps {
  campuses: Campus[];
  stations: Station[];
  onSubmit: (request: PlanRequest) => void;
  prefill: FormPrefill | null;
  loading: boolean;
  onSelectionChange: (selection: { campusId: string; stationId: string }) => void;
}

export function PlanForm({
  campuses,
  stations,
  onSubmit,
  prefill,
  loading,
  onSelectionChange,
}: PlanFormProps) {
  const [values, setValues] = useState(DEFAULT_PLANNER_VALUES);
  const [geoError, setGeoError] = useState('');

  useEffect(() => {
    if (prefill) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Apply an external saved-class selection to the local form.
      setValues((current) => ({
        ...current,
        campusId: prefill.campusId,
        date: prefill.date,
        time: prefill.time,
      }));
    }
  }, [prefill]);

  const selectedStation =
    stations.find((station) => station.id === values.stationId) ?? stations[0];

  useEffect(() => {
    if (values.campusId && values.stationId)
      onSelectionChange({ campusId: values.campusId, stationId: values.stationId });
  }, [onSelectionChange, values.campusId, values.stationId]);

  function chooseMode(mode: TravelMode) {
    setValues((current) => ({ ...current, mode }));
  }

  function chooseLocation() {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('La geolocalizzazione non è disponibile in questo browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        setValues((current) => ({
          ...current,
          originKind: 'location',
          coordinates: { lat: position.coords.latitude, lon: position.coords.longitude },
        })),
      () =>
        setGeoError('Non è stato possibile ottenere la posizione. Puoi scegliere una stazione.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(buildPlanRequest({ ...values, stationId: selectedStation?.id ?? values.stationId }));
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit} aria-label="Calcola l’orario di partenza">
      <div className="space-y-2">
        <CampusSearch
          campuses={campuses}
          selectedId={values.campusId}
          onChange={(campusId) => setValues((current) => ({ ...current, campusId }))}
        />
        <p className="field-hint">Seleziona la sede dove si svolge la lezione.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="lesson-date">
            Giorno
          </label>
          <div className="input-with-icon">
            <Icon name="calendar" className="field-icon" />
            <input
              id="lesson-date"
              className="field-input field-input-icon"
              type="date"
              required
              value={values.date}
              onChange={(event) =>
                setValues((current) => ({ ...current, date: event.target.value }))
              }
            />
          </div>
        </div>
        <div>
          <label className="field-label" htmlFor="lesson-time">
            Inizio lezione
          </label>
          <div className="input-with-icon">
            <Icon name="clock" className="field-icon" />
            <input
              id="lesson-time"
              className="field-input field-input-icon"
              type="time"
              required
              value={values.time}
              onChange={(event) =>
                setValues((current) => ({ ...current, time: event.target.value }))
              }
            />
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="field-label mb-2">Come ti muovi in città?</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['walk', 'bike'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={values.mode === mode}
              onClick={() => chooseMode(mode)}
              className={`mode-button ${values.mode === mode ? 'mode-button-active' : ''}`}
            >
              <Icon name={mode} className="h-5 w-5" />
              {mode === 'walk' ? 'A piedi' : 'In bici'}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="field-label mb-2">Da dove parti?</legend>
        <div className="space-y-2">
          <button
            type="button"
            aria-pressed={values.originKind === 'location'}
            onClick={chooseLocation}
            className={`origin-option ${values.originKind === 'location' ? 'origin-option-active' : ''}`}
          >
            <span className="origin-radio" />
            <span className="flex-1 text-left">Uso la mia posizione</span>
            <Icon name="pin" className="h-4 w-4 text-pine" />
          </button>
          <button
            type="button"
            aria-pressed={values.originKind === 'station'}
            onClick={() => setValues((current) => ({ ...current, originKind: 'station' }))}
            className={`origin-option ${values.originKind === 'station' ? 'origin-option-active' : ''}`}
          >
            <span className="origin-radio" />
            <span className="flex-1 text-left">Parto dalla stazione</span>
          </button>
          <button
            type="button"
            aria-pressed={values.originKind === 'home'}
            onClick={() => setValues((current) => ({ ...current, originKind: 'home' }))}
            className={`origin-option ${values.originKind === 'home' ? 'origin-option-active' : ''}`}
          >
            <span className="origin-radio" />
            <span className="flex-1 text-left">Da casa, fino alla stazione</span>
          </button>
        </div>
        {values.originKind !== 'location' && (
          <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
            <div>
              <label className="field-label" htmlFor="origin-station">
                Stazione di partenza
              </label>
              <select
                id="origin-station"
                className="field-input"
                value={values.stationId}
                onChange={(event) =>
                  setValues((current) => ({ ...current, stationId: event.target.value }))
                }
              >
                {stations.map((station) => (
                  <option value={station.id} key={station.id}>
                    {station.name}
                  </option>
                ))}
              </select>
            </div>
            {values.originKind === 'home' && (
              <div className="w-28">
                <label className="field-label" htmlFor="home-minutes">
                  Casa → FS
                </label>
                <div className="relative">
                  <input
                    id="home-minutes"
                    className="field-input pr-10"
                    type="number"
                    min="0"
                    max="180"
                    required
                    value={values.homeToStationMin}
                    onChange={(event) =>
                      setValues((current) => ({
                        ...current,
                        homeToStationMin: Number(event.target.value),
                      }))
                    }
                  />
                  <span className="absolute right-3 top-3 text-xs text-slate-500">min</span>
                </div>
              </div>
            )}
          </div>
        )}
        {geoError && (
          <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
            {geoError}
          </p>
        )}
      </fieldset>

      <div className="rounded-2xl bg-mint/70 px-4 py-3 dark:bg-emerald-950/50">
        <div className="flex items-center justify-between gap-3">
          <label className="field-label mb-0" htmlFor="margin">
            Margine prima della lezione
          </label>
          <output className="font-bold text-pine dark:text-emerald-300" htmlFor="margin">
            {values.marginMin} min
          </output>
        </div>
        <input
          id="margin"
          className="mt-3 w-full accent-pine"
          type="range"
          min="0"
          max="60"
          step="1"
          value={values.marginMin}
          onChange={(event) =>
            setValues((current) => ({ ...current, marginMin: Number(event.target.value) }))
          }
        />
        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>0 min</span>
          <span>60 min</span>
        </div>
      </div>

      <button
        className="primary-button w-full"
        type="submit"
        disabled={loading || !values.campusId}
      >
        {loading ? (
          <>
            <span className="loading-dot" />
            Calcolo in corso…
          </>
        ) : (
          <>
            Calcola quando uscire <Icon name="arrow" className="h-5 w-5" />
          </>
        )}
      </button>
      <p className="text-center text-xs leading-5 text-slate-500">
        Orario programmato Trenitalia, non in tempo reale: verifica sempre ritardi e variazioni
        prima di partire.
      </p>
    </form>
  );
}
