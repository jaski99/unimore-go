import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItineraryTimeline } from './itinerary-timeline';

const sample = {
  leave_at: '07:34',
  arrive_at: '08:18',
  slack_min: 12,
  legs: [
    {
      type: 'bike' as const,
      from: 'Casa · Reggio Emilia',
      to: 'Reggio Emilia FS',
      depart: '07:34',
      arrive: '07:48',
      minutes: 14,
    },
    {
      type: 'train' as const,
      from: 'Reggio Emilia FS',
      to: 'Modena FS',
      depart: '07:48',
      arrive: '08:09',
      minutes: 21,
      train: { number: '3907', category: 'Regionale Veloce', operator: 'Trenitalia Tper' },
    },
  ],
};

describe('ItineraryTimeline', () => {
  it('mostra tratte, orari localizzati e dati del treno', () => {
    render(<ItineraryTimeline itinerary={sample} />);
    expect(screen.getByText('In bici')).toBeInTheDocument();
    expect(screen.getByText('Regionale Veloce · 3907')).toBeInTheDocument();
    expect(screen.getAllByText('Reggio Emilia FS', { exact: false })).toHaveLength(2);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/07:34.*07:48.*14 min/);
  });

  it('nasconde i tratti attivi di 0 minuti restituiti partendo dalla stazione', () => {
    const fromStation = {
      ...sample,
      legs: [{ ...sample.legs[0], minutes: 0, depart: '07:48', train: null }, sample.legs[1]],
    };
    render(<ItineraryTimeline itinerary={fromStation} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('listitem')).toHaveTextContent(/Treno.*07:48.*08:09/);
  });
});
