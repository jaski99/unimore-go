'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { Route } from '@/lib/route-geometry';

const MapInner = dynamic(() => import('./map-inner').then((module) => module.MapInner), {
  ssr: false,
  loading: () => <MapPlaceholder text="Caricamento mappa…" />,
});

const MARKERS = [
  { role: 'home', label: 'Casa', className: 'bg-sky-600' },
  { role: 'from_station', label: 'Stazione partenza', className: 'bg-pine' },
  { role: 'to_station', label: 'Stazione arrivo', className: 'bg-violet-700' },
  { role: 'campus', label: 'Sede', className: 'bg-orange-500' },
] as const;

/** Legend for marker colours (see ROLE_COLORS in map-inner.tsx) and line styles. */
export function MapLegend() {
  return (
    <ul
      aria-label="Legenda della mappa"
      className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700 dark:text-slate-300"
    >
      {MARKERS.map((marker) => (
        <li key={marker.role} className="map-legend">
          <i className={marker.className} /> {marker.label}
        </li>
      ))}
      <li className="map-legend">
        <b className="map-line map-line-train" aria-hidden="true" /> Treno
      </li>
      <li className="map-legend">
        <b className="map-line map-line-active" aria-hidden="true" /> A piedi / in bici
      </li>
    </ul>
  );
}

function MapPlaceholder({ text }: { text: string }) {
  return (
    <div className="map-loading" role="status">
      <span className="loading-dot" />
      {text}
    </div>
  );
}

interface MapPanelProps {
  route: Route;
  /** When true the next map click sets the home position. */
  picking: boolean;
  onPick: (lat: number, lon: number) => void;
}

/**
 * Leaflet is loaded only when the map is about to enter the viewport (or when
 * the user wants to pick home on it), keeping it out of the initial load.
 */
export function MapPanel({ route, picking, onPick }: MapPanelProps) {
  const frame = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = frame.current;
    if (!element || visible) return;
    if (typeof IntersectionObserver === 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- legacy browsers: load immediately.
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setVisible(true);
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (picking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- picking needs the map now.
      setVisible(true);
      frame.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [picking]);

  return (
    <section id="map" className="map-card" aria-labelledby="map-heading">
      <div className="px-5 pt-4 pb-2">
        <div>
          <h2 id="map-heading" className="font-bold text-ink dark:text-white">
            Il percorso
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Linea indicativa in linea d’aria: non è il percorso stradale
          </p>
        </div>
      </div>
      <div className="px-5 pb-3">
        <MapLegend />
      </div>
      {picking && (
        <p className="mx-5 mb-3 rounded-xl bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-100">
          Tocca la mappa nel punto in cui abiti.
        </p>
      )}
      <div className="map-frame" ref={frame}>
        {visible ? (
          <MapInner route={route} picking={picking} onPick={onPick} />
        ) : (
          <MapPlaceholder text="La mappa si carica quando arrivi qui" />
        )}
      </div>
      <p className="px-5 py-3 text-[11px] text-slate-600 dark:text-slate-400">
        Mappa ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenStreetMap contributors
        </a>{' '}
        (ODbL)
      </p>
    </section>
  );
}
