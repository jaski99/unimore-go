'use client';

import dynamic from 'next/dynamic';
import type { Campus, Station } from '@/lib/api/types';

const MapInner = dynamic(() => import('./map-inner').then((module) => module.MapInner), {
  ssr: false,
  loading: () => (
    <div className="map-loading" aria-label="Caricamento mappa">
      <span className="loading-dot" />
      Caricamento mappa…
    </div>
  ),
});

interface MapPanelProps {
  campus: Campus | undefined;
  station: Station | undefined;
}

export function MapPanel({ campus, station }: MapPanelProps) {
  return (
    <section className="map-card" aria-label="Mappa della sede e della stazione">
      <div className="flex items-center justify-between px-5 py-4">
        <div>
          <h2 className="font-bold text-ink dark:text-white">La zona</h2>
          <p className="mt-0.5 text-xs text-slate-500">Stazione e sede della lezione</p>
        </div>
        <span className="map-legend">
          <i /> Sede
        </span>
      </div>
      <div className="map-frame">
        <MapInner campus={campus} station={station} />
      </div>
      <p className="px-5 py-3 text-[11px] text-slate-500">
        ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </section>
  );
}
