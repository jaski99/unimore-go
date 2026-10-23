'use client';

import type { FormEvent } from 'react';
import type { Campus, GeocodeResult, Station } from '@/lib/api/types';
import {
  STATION_BUFFER_RANGE,
  validatePlannerValues,
  type PlannerValues,
} from '@/lib/plan-request';
import { CampusSearch } from './campus-search';
import { HomeLocationField } from './home-location-field';
import { Icon } from './icons';

interface PlanFormProps {
  values: PlannerValues;
  onChange: (patch: Partial<PlannerValues>) => void;
  campuses: Campus[];
  stations: Station[];
  onSubmit: () => void;
  loading: boolean;
  /** Last day covered by the timetable (YYYY-MM-DD), from /api/health. */
  validTo?: string;
  onSearchAddress: (query: string) => Promise<GeocodeResult[]>;
  onPickOnMap: () => void;
  pickingOnMap: boolean;
  /** Note shown when the form was prefilled from the weekly schedule. */
  prefillNote?: string;
}

export function PlanForm({
  values,
  onChange,
  campuses,
  stations,
  onSubmit,
  loading,
  validTo,
  onSearchAddress,
  onPickOnMap,
  pickingOnMap,
  prefillNote,
}: PlanFormProps) {
  const isReturn = values.direction === 'return';
  const error = validatePlannerValues(values);
  const afterValidity = !!validTo && !!values.date && values.date > validTo;
  const showStation = values.originKind === 'station' || !values.home;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!error) onSubmit();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} aria-label="Calcola l’orario">
      <fieldset>
        <legend className="sr-only">Andata o ritorno</legend>
        <div className="segmented">
          {(
            [
              ['outbound', 'Andata', 'a che ora esco?'],
              ['return', 'Ritorno', 'a che ora parto?'],
            ] as const
          ).map(([direction, title, hint]) => (
            <button
              key={direction}
              type="button"
              aria-pressed={values.direction === direction}
              className={`segmented-option ${values.direction === direction ? 'segmented-active' : ''}`}
              onClick={() => onChange({ direction })}
            >
              <span className="font-bold">{title}</span>
              <span className="text-xs">{hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {prefillNote && (
        <p className="rounded-xl bg-mint/70 px-3 py-2 text-sm text-pine dark:bg-emerald-950/60 dark:text-emerald-200">
          {prefillNote}
        </p>
      )}

      <CampusSearch
        campuses={campuses}
        selectedId={values.campusId}
        onChange={(campusId) => onChange({ campusId })}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="field-label" htmlFor="lesson-date">
            Giorno
          </label>
          <input
            id="lesson-date"
            className="field-input"
            type="date"
            required
            value={values.date}
            aria-describedby={afterValidity ? 'validity-alert' : undefined}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="lesson-time">
            {isReturn ? 'Fine lezione' : 'Inizio lezione'}
          </label>
          <input
            id="lesson-time"
            className="field-input"
            type="time"
            required
            value={values.time}
            onChange={(event) => onChange({ time: event.target.value })}
          />
        </div>
      </div>
      {afterValidity && (
        <p id="validity-alert" role="alert" className="alert-box">
          <Icon name="alert" className="h-5 w-5 shrink-0" />
          <span>
            L’orario caricato vale fino al {validTo!.split('-').reverse().join('/')}: per questa
            data non ci sono treni affidabili.
          </span>
        </p>
      )}

      <fieldset>
        <legend className="field-label mb-2">{isReturn ? 'Dove torni?' : 'Da dove parti?'}</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['station', 'Dalla stazione', 'Alla stazione', 'train'],
              ['home', 'Da casa', 'A casa', 'home'],
            ] as const
          ).map(([kind, outboundLabel, returnLabel, icon]) => (
            <button
              key={kind}
              type="button"
              aria-pressed={values.originKind === kind}
              className={`origin-option ${values.originKind === kind ? 'origin-option-active' : ''}`}
              onClick={() => onChange({ originKind: kind })}
            >
              <Icon name={icon} className="h-5 w-5" />
              <span className="flex-1 text-left">{isReturn ? returnLabel : outboundLabel}</span>
            </button>
          ))}
        </div>

        {values.originKind === 'home' && (
          <div className="mt-3 space-y-3">
            <HomeLocationField
              home={values.home}
              onChange={(home) => onChange({ home })}
              onSearch={onSearchAddress}
              onPickOnMap={onPickOnMap}
              picking={pickingOnMap}
            />
            <div>
              <label className="field-label" htmlFor="home-minutes">
                Minuti casa ↔ stazione <span className="font-normal">(facoltativo)</span>
              </label>
              <input
                id="home-minutes"
                className="field-input"
                type="number"
                inputMode="numeric"
                min="1"
                max="180"
                placeholder={values.home ? 'Stima automatica' : 'Es. 12'}
                value={values.homeToStationMin ?? ''}
                onChange={(event) =>
                  onChange({
                    homeToStationMin: event.target.value ? Number(event.target.value) : null,
                  })
                }
              />
              <p className="field-hint">
                Se casa è nella stessa città della sede calcoliamo solo il tragitto a piedi o in
                bici, senza treno.
              </p>
            </div>
          </div>
        )}

        {showStation && (
          <div className="mt-3">
            <label className="field-label" htmlFor="origin-station">
              {values.originKind === 'home' ? 'Stazione che usi' : 'Stazione'}
            </label>
            <select
              id="origin-station"
              className="field-input"
              value={values.stationId}
              onChange={(event) => onChange({ stationId: event.target.value })}
            >
              {stations.map((station) => (
                <option value={station.id} key={station.id}>
                  {station.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="field-label mb-2">Come ti muovi in città?</legend>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['walk', 'bike'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={values.mode === mode}
              onClick={() => onChange({ mode })}
              className={`mode-button ${values.mode === mode ? 'mode-button-active' : ''}`}
            >
              <Icon name={mode} className="h-5 w-5" />
              {mode === 'walk' ? 'A piedi' : 'In bici'}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="space-y-4 rounded-2xl bg-mint/60 px-4 py-4 dark:bg-emerald-950/40">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-pine"
            checked={values.regionalOnly}
            onChange={(event) => onChange({ regionalOnly: event.target.checked })}
          />
          <span>
            <span className="block font-semibold text-ink dark:text-white">
              Solo regionali (R/RV)
            </span>
            <span className="block text-xs text-slate-700 dark:text-slate-300">
              Togli la spunta per vedere anche Intercity e Frecciarossa: richiedono un biglietto
              diverso o un supplemento.
            </span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="station-buffer">
              Tempo in stazione
            </label>
            <div className="relative">
              <input
                id="station-buffer"
                className="field-input pr-12"
                type="number"
                inputMode="numeric"
                min={STATION_BUFFER_RANGE.min}
                max={STATION_BUFFER_RANGE.max}
                required
                value={values.stationBufferMin}
                aria-describedby="station-buffer-hint"
                onChange={(event) => onChange({ stationBufferMin: Number(event.target.value) })}
              />
              <span className="pointer-events-none absolute right-3 top-3 text-sm text-slate-600">
                min
              </span>
            </div>
          </div>
          {!isReturn && (
            <div>
              <label className="field-label" htmlFor="margin">
                Anticipo a lezione
              </label>
              <div className="relative">
                <input
                  id="margin"
                  className="field-input pr-12"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="60"
                  required
                  value={values.marginMin}
                  onChange={(event) => onChange({ marginMin: Number(event.target.value) })}
                />
                <span className="pointer-events-none absolute right-3 top-3 text-sm text-slate-600">
                  min
                </span>
              </div>
            </div>
          )}
        </div>
        <p id="station-buffer-hint" className="field-hint -mt-2">
          Biglietto, binario, sottopasso: l’uscita non coincide mai con la partenza del treno.
        </p>
      </div>

      {error && values.originKind === 'home' && (
        <p className="text-sm text-slate-700 dark:text-slate-300">{error}</p>
      )}
      <button className="primary-button w-full" type="submit" disabled={loading || !!error}>
        {loading ? (
          <>
            <span className="loading-dot" />
            Calcolo in corso…
          </>
        ) : (
          <>
            {isReturn ? 'Calcola quando partire' : 'Calcola quando uscire'}
            <Icon name="arrow" className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );
}
