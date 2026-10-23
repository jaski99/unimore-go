'use client';

import { useId, useState } from 'react';
import type { Calculation, Leg, Notice } from '@/lib/api/types';
import { trainLabel } from '@/lib/itinerary-summary';
import { realtimeLinks } from '@/lib/realtime-links';
import { copyLink } from '@/lib/share';
import { Icon } from './icons';

/** "lezione 09:00 − 10 min − 19 min a piedi = in stazione entro le 08:31": the arithmetic, visible. */
export function CalculationNote({ calculation }: { calculation?: Calculation | null }) {
  if (!calculation) return null;
  return (
    <div className="calc-note" role="note" aria-label="Come abbiamo calcolato l’orario">
      <Icon name="clock" className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <span className="block font-semibold">
          In stazione a {calculation.station} entro le {calculation.time}
        </span>
        <span className="block">{calculation.summary.replace(/^Calcolo:\s*/, '')}</span>
      </p>
    </div>
  );
}

/** One alert box per warning (already merged and sorted by the API). */
export function AlertList({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  return (
    <div className="space-y-2">
      {notices.map((notice) => (
        <p className="alert-box" role="alert" key={`${notice.code}-${notice.message}`}>
          <Icon name="alert" className="h-5 w-5 shrink-0" />
          <span>{notice.message}</span>
        </p>
      ))}
    </div>
  );
}

export function InfoList({ notices }: { notices: Notice[] }) {
  if (!notices.length) return null;
  return (
    <div className="warning-note" role="note">
      <span className="warning-mark">i</span>
      <ul className="space-y-1">
        {notices.map((notice) => (
          <li key={`${notice.code}-${notice.message}`}>{notice.message}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Where to check the proposed train live. Trenitalia documents no link to a
 * single train's page, so we show the number (copiable) and the search page.
 */
export function RealtimeBox({ train, notice }: { train?: Leg; notice?: Notice }) {
  const [copied, setCopied] = useState('');
  const titleId = useId();
  const number = train?.train?.number;
  return (
    <section className="realtime-box" aria-labelledby={titleId}>
      <h3 id={titleId} className="text-sm font-bold text-ink dark:text-white">
        Controlla ritardi e scioperi
      </h3>
      <p className="mt-1 text-xs text-slate-700 dark:text-slate-300">
        {notice?.message ??
          'Orari programmati Trenitalia, non in tempo reale: controlla prima di partire.'}
      </p>
      {number && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>
            Treno <strong>{trainLabel(train)}</strong>
          </span>
          <button
            type="button"
            className="chip-button"
            onClick={async () =>
              setCopied(
                (await copyLink(number)) === 'copied'
                  ? `Numero ${number} copiato.`
                  : 'Copia non riuscita.',
              )
            }
          >
            <Icon name="copy" className="h-3.5 w-3.5" /> Copia numero
          </button>
          <span role="status" className="text-xs text-pine dark:text-emerald-300">
            {copied}
          </span>
        </p>
      )}
      <ul className="mt-2 space-y-1.5">
        {realtimeLinks(number).map((link) => (
          <li key={link.href}>
            <a className="realtime-link" href={link.href} target="_blank" rel="noopener noreferrer">
              <span className="font-semibold underline">{link.label}</span>
              <span className="text-xs text-slate-700 dark:text-slate-300">
                {link.description}
                <span className="sr-only"> (si apre in una nuova scheda)</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
