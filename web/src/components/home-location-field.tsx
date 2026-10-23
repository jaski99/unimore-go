'use client';

import { useState } from 'react';
import type { GeocodeResult } from '@/lib/api/types';
import type { HomeLocation } from '@/lib/plan-request';
import { Icon } from './icons';

interface HomeLocationFieldProps {
  home: HomeLocation | null;
  onChange: (home: HomeLocation | null) => void;
  onSearch: (query: string) => Promise<GeocodeResult[]>;
  /** Ask the map to capture the next click as home. */
  onPickOnMap: () => void;
  picking: boolean;
}

const CITY = /^(Modena|Reggio Emilia|Reggio nell'Emilia)$/i;
const HOUSE_NUMBER = /^\d+[a-z]?(\/\w+)?$/i;

/**
 * Shorten a Nominatim label to "[place,] street number, city". Nominatim puts
 * an optional place name first, then house number, road, suburb, city, ...
 */
export function shortLabel(label: string): string {
  const parts = label.split(',').map((part) => part.trim());
  if (parts.length <= 3) return label;
  const numberAt = parts.findIndex((part) => HOUSE_NUMBER.test(part));
  let head: string;
  if (numberAt >= 0 && numberAt <= 1 && parts[numberAt + 1]) {
    const street = `${parts[numberAt + 1]} ${parts[numberAt]}`;
    head = numberAt === 1 ? `${parts[0]}, ${street}` : street;
  } else {
    head = `${parts[0]}, ${parts[1]}`;
  }
  const city = parts.find((part) => CITY.test(part));
  return city && !head.includes(city) ? `${head}, ${city}` : head;
}

export function HomeLocationField({
  home,
  onChange,
  onSearch,
  onPickOnMap,
  picking,
}: HomeLocationFieldProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function search() {
    const text = query.trim();
    if (text.length < 3) {
      setMessage('Scrivi almeno 3 caratteri (via e città).');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const found = await onSearch(text);
      setResults(found);
      if (!found.length)
        setMessage('Nessun indirizzo trovato in provincia di Modena o Reggio Emilia.');
    } catch (cause) {
      setResults(null);
      setMessage(cause instanceof Error ? cause.message : 'Ricerca non disponibile.');
    } finally {
      setBusy(false);
    }
  }

  function locate() {
    setMessage('');
    if (!navigator.geolocation) {
      setMessage('La geolocalizzazione non è disponibile in questo browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        onChange({
          label: 'La mia posizione',
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }),
      () => setMessage('Posizione non disponibile: cerca l’indirizzo o tocca la mappa.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  if (home) {
    return (
      <div className="home-chip" aria-live="polite">
        <Icon name="home" className="h-5 w-5 shrink-0 text-pine" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
            Casa
          </span>
          <span className="block truncate text-sm font-semibold text-ink dark:text-white">
            {home.label}
          </span>
        </span>
        <button
          type="button"
          className="icon-button"
          aria-label="Cambia indirizzo di casa"
          onClick={() => {
            onChange(null);
            setResults(null);
          }}
        >
          <Icon name="close" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="field-label" htmlFor="home-address">
        Indirizzo di casa
      </label>
      <div className="flex gap-2">
        <input
          id="home-address"
          className="field-input"
          type="search"
          inputMode="search"
          autoComplete="street-address"
          placeholder="Es. Via Emilia Ovest 100, Modena"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void search();
            }
          }}
        />
        <button
          type="button"
          className="secondary-button shrink-0 px-4"
          onClick={() => void search()}
          disabled={busy}
          aria-label="Cerca indirizzo"
        >
          <Icon name="search" className="h-5 w-5" />
        </button>
      </div>
      {results && results.length > 0 && (
        <ul className="address-results" aria-label="Indirizzi trovati">
          {results.map((result) => (
            <li key={`${result.lat},${result.lon}`}>
              <button
                type="button"
                className="address-option"
                onClick={() => {
                  onChange({ label: shortLabel(result.label), lat: result.lat, lon: result.lon });
                  setResults(null);
                  setQuery('');
                }}
              >
                {shortLabel(result.label)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="chip-button" onClick={locate}>
          <Icon name="pin" className="h-4 w-4" /> La mia posizione
        </button>
        <button
          type="button"
          className={`chip-button ${picking ? 'chip-button-active' : ''}`}
          aria-pressed={picking}
          onClick={onPickOnMap}
        >
          <Icon name="map" className="h-4 w-4" />{' '}
          {picking ? 'Tocca la mappa…' : 'Scegli sulla mappa'}
        </button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          {message}
        </p>
      )}
      <p className="field-hint">
        Ricerca indirizzi © OpenStreetMap contributors (Nominatim). L’indirizzo resta solo su questo
        dispositivo.
      </p>
    </div>
  );
}
