import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ItineraryTimeline } from './itinerary-timeline';

const sample = {
  leave_at: '2026-10-26T07:34:00+01:00',
  arrive_at: '2026-10-26T08:18:00+01:00',
  slack_min: 12,
  legs: [
    {
      type: 'bike' as const,
      from: 'Casa · Reggio Emilia',
      to: 'Reggio Emilia FS',
      depart: '2026-10-26T07:34:00+01:00',
      arrive: '2026-10-26T07:48:00+01:00',
      minutes: 14,
    },
    {
      type: 'train' as const,
      from: 'Reggio Emilia FS',
      to: 'Modena FS',
      depart: '2026-10-26T07:48:00+01:00',
      arrive: '2026-10-26T08:09:00+01:00',
      minutes: 21,
      train: { number: 'ESEMPIO 1', category: 'Regionale', operator: 'Trenitalia' },
    },
  ],
};

describe('ItineraryTimeline', () => {
  it('mostra tratte, orari localizzati e dati del treno', () => {
    render(<ItineraryTimeline itinerary={sample} />);
    expect(screen.getByText('In bici')).toBeInTheDocument();
    expect(screen.getByText('Regionale · ESEMPIO 1')).toBeInTheDocument();
    expect(screen.getAllByText('Reggio Emilia FS', { exact: false })).toHaveLength(2);
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent(/07:34.*07:48.*14 min/);
  });
});
