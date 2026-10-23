'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { Route } from '@/lib/route-geometry';

const MapInner = dynamic(() => import('./map-inner').then((module) => module.MapInner), {
  ssr: false,
  loading: () => <MapPlaceholder text="Caricamento mappa…" />,
});

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
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 id="map-heading" className="font-bold text-ink dark:text-white">
            Il percorso
          </h2>
          <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
            Linea indicativa: treno continuo, tratti a piedi/bici tratteggiati
          </p>
        </div>
        <ul className="flex shrink-0 flex-col gap-1 text-[11px] text-slate-700 dark:text-slate-300">
          <li className="map-legend">
            <i className="bg-sky-600" /> Casa
          </li>
          <li className="map-legend">
            <i className="bg-pine" /> Stazione
          </li>
          <li className="map-legend">
            <i className="bg-orange-500" /> Sede
          </li>
        </ul>
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
