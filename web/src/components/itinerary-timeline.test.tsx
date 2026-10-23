import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import fixtures from '@/lib/api/mock-fixtures.json';
import type { Itinerary } from '@/lib/api/types';
import { ItineraryTimeline, visibleLegs } from './itinerary-timeline';

const demo = fixtures.demo.response.itineraries[0] as Itinerary;

describe('ItineraryTimeline', () => {
  it('mostra attesa in stazione, treno con sigla e ultimo tratto', () => {
    render(<ItineraryTimeline itinerary={demo} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(/In stazione.*07:39.*07:44.*5 min/);
    expect(items[0]).toHaveTextContent('biglietto e binario');
    expect(items[1]).toHaveTextContent(/Treno.*RV 3907.*07:44.*07:56/);
    expect(items[1]).toHaveTextContent('orario programmato');
    expect(items[2]).toHaveTextContent(/In bici.*22 min/);
  });

  it('mostra il badge biglietto diverso e le note di calendario da verificare', () => {
    const fr: Itinerary = {
      ...demo,
      legs: demo.legs.map((leg) =>
        leg.type === 'train'
          ? {
              ...leg,
              train: { ...leg.train!, code: 'FR', number: '9505', different_ticket: true },
              notes: ['Nota di calendario non interpretata: verificare (pag. 74).'],
            }
          : leg,
      ),
    };
    render(<ItineraryTimeline itinerary={fr} />);
    expect(screen.getByText('Biglietto diverso / supplemento')).toBeInTheDocument();
    expect(screen.getByText('Calendario da verificare')).toBeInTheDocument();
    expect(screen.getByText(/pag\. 74/)).toBeInTheDocument();
  });

  it('non mostra mai tratti a piedi/bici/attesa da 0 minuti', () => {
    const zero: Itinerary = {
      ...demo,
      legs: [{ ...demo.legs[2], minutes: 0 }, demo.legs[1], { ...demo.legs[0], minutes: 0 }],
    };
    expect(visibleLegs(zero.legs).map((leg) => leg.type)).toEqual(['train']);
    render(<ItineraryTimeline itinerary={zero} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
