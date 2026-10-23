import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { Itinerary } from '@/lib/api/types';
import * as ics from '@/lib/ics';
import { ResultActions, tripEvent } from './result-actions';

const itinerary = fixtures.demo.response.itineraries[0] as Itinerary;

afterEach(() => vi.restoreAllMocks());

describe('tripEvent', () => {
  it('titolo "Esci alle HH:MM · treno → sede" e nota non in tempo reale', () => {
    const event = tripEvent(itinerary, 'arrive_by', '2026-10-26', 'DIEF');
    expect(event).toMatchObject({
      date: '2026-10-26',
      leaveAt: '07:39',
      arriveAt: '08:18',
      summary: 'Esci alle 07:39 · RV 3907 → DIEF',
      location: 'Reggio Emilia FS',
      reminderMin: 10,
    });
    expect(event.description).toContain('Treno RV 3907 alle 07:44 da Reggio Emilia');
    expect(event.description).toContain('non in tempo reale');
    const back = tripEvent(
      { ...itinerary, legs: [itinerary.legs[2]] },
      'depart_after',
      '2026-10-26',
    );
    expect(back.summary).toBe('Parti alle 07:39');
    expect(back.description).toContain('Tragitto senza treno.');
  });
});

describe('ResultActions', () => {
  it('scarica il .ics, copia e condivide il link con un messaggio leggibile', async () => {
    const user = userEvent.setup();
    const download = vi.spyOn(ics, 'downloadIcs').mockImplementation(() => {});
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    render(
      <ResultActions
        itinerary={itinerary}
        planner="arrive_by"
        date="2026-10-26"
        destination="DIEF"
        shareUrl="https://x.test/?sede=dief"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Aggiungi al calendario' }));
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'Esci alle 07:39 · RV 3907 → DIEF' }),
    );
    expect(screen.getByRole('status')).toHaveTextContent('File del calendario scaricato');
    await user.click(screen.getByRole('button', { name: 'Copia link' }));
    expect(writeText).toHaveBeenCalledWith('https://x.test/?sede=dief');
    expect(screen.getByRole('status')).toHaveTextContent('Link copiato negli appunti.');
    await user.click(screen.getByRole('button', { name: 'Condividi' }));
    expect(writeText).toHaveBeenCalledTimes(2);
  });

  it('senza link da condividere mostra solo il calendario', () => {
    render(
      <ResultActions itinerary={itinerary} planner="arrive_by" date="2026-10-26" shareUrl="" />,
    );
    expect(screen.queryByRole('button', { name: 'Copia link' })).not.toBeInTheDocument();
  });
});
