'use client';

import { useState } from 'react';
import type { Itinerary, PlannerName } from '@/lib/api/types';
import { downloadIcs, type TripEvent } from '@/lib/ics';
import { leaveVerb, trainLabel, trainLeg } from '@/lib/itinerary-summary';
import { formatClock } from '@/lib/time-format';
import { VIAGGIATRENO_URL } from '@/lib/realtime-links';
import { copyLink, shareFeedback, shareLink } from '@/lib/share';
import { Icon } from './icons';

/** Calendar event for the proposed itinerary ("Esci alle 07:39 · RV 3907 → DIEF"). */
export function tripEvent(
  itinerary: Itinerary,
  planner: PlannerName,
  date: string,
  destination?: string,
): TripEvent {
  const train = trainLeg(itinerary);
  const leave = formatClock(itinerary.leave_at);
  const summary = [`${leaveVerb(planner)} ${leave}`, train ? trainLabel(train) : undefined]
    .filter(Boolean)
    .join(' · ')
    .concat(destination ? ` → ${destination}` : '');
  const description = [
    train
      ? `Treno ${trainLabel(train)} alle ${formatClock(train.depart)} da ${train.from}, arrivo a ${train.to} alle ${formatClock(train.arrive)}.`
      : 'Tragitto senza treno.',
    `Arrivo previsto alle ${formatClock(itinerary.arrive_at)}.`,
    'Orari programmati Trenitalia, non in tempo reale: verifica ritardi e scioperi su ViaggiaTreno',
    VIAGGIATRENO_URL,
  ].join('\n');
  return {
    date: itinerary.date ?? date,
    leaveAt: leave,
    arriveAt: formatClock(itinerary.arrive_at),
    summary,
    description,
    location: itinerary.legs[0]?.from,
    reminderMin: 10,
  };
}

interface ResultActionsProps {
  itinerary: Itinerary;
  planner: PlannerName;
  date: string;
  destination?: string;
  /** Absolute link to this search (empty when there is nothing to share). */
  shareUrl: string;
}

export function ResultActions({
  itinerary,
  planner,
  date,
  destination,
  shareUrl,
}: ResultActionsProps) {
  const [feedback, setFeedback] = useState('');
  const event = tripEvent(itinerary, planner, date, destination);
  return (
    <div>
      <div className="result-actions">
        <button
          type="button"
          className="action-button"
          onClick={() => {
            downloadIcs(event);
            setFeedback('File del calendario scaricato: aprilo per aggiungere l’evento.');
          }}
        >
          <Icon name="calendar" className="h-4 w-4" /> Aggiungi al calendario
        </button>
        {shareUrl && (
          <>
            <button
              type="button"
              className="action-button"
              onClick={async () => setFeedback(shareFeedback(await copyLink(shareUrl)))}
            >
              <Icon name="link" className="h-4 w-4" /> Copia link
            </button>
            <button
              type="button"
              className="action-button"
              onClick={async () =>
                setFeedback(
                  shareFeedback(
                    await shareLink({ url: shareUrl, title: 'UnimoreGo', text: event.summary }),
                  ),
                )
              }
            >
              <Icon name="share" className="h-4 w-4" /> Condividi
            </button>
          </>
        )}
      </div>
      <p role="status" className="mt-2 min-h-4 text-xs text-pine dark:text-emerald-300">
        {feedback}
      </p>
    </div>
  );
}
