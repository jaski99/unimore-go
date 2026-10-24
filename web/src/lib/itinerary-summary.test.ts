import { describe, expect, it } from 'vitest';
import fixtures from './api/mock-fixtures.json';
import type { Itinerary } from './api/types';
import {
  describeSlack,
  hasCalendarNotes,
  leaveVerb,
  needsDifferentTicket,
  slackCaption,
  stationWaitMinutes,
  trainLabel,
  trainLeg,
} from './itinerary-summary';

const demo = fixtures.demo.response.itineraries[0] as Itinerary;
const frecciarossa: Itinerary = {
  ...demo,
  legs: demo.legs.map((leg) =>
    leg.type === 'train'
      ? {
          ...leg,
          train: { ...leg.train!, code: 'FR', number: '9505', different_ticket: true },
          notes: ['Nota di calendario non interpretata (pag. 74).'],
        }
      : leg,
  ),
};

describe('itinerary summary', () => {
  it('estrae treno, etichetta e attesa in stazione dal percorso reale registrato', () => {
    expect(trainLeg(demo)?.train?.number).toBe('3907');
    expect(trainLabel(trainLeg(demo))).toBe('RV 3907');
    expect(trainLabel(undefined)).toBe('');
    expect(stationWaitMinutes(demo)).toBe(5);
    expect(stationWaitMinutes({ ...demo, legs: [] })).toBe(0);
  });

  it('segnala biglietto diverso e note di calendario', () => {
    expect(needsDifferentTicket(demo)).toBe(false);
    expect(hasCalendarNotes(demo)).toBe(false);
    expect(needsDifferentTicket(frecciarossa)).toBe(true);
    expect(hasCalendarNotes(frecciarossa)).toBe(true);
  });

  it('usa il verbo e la descrizione del margine giusti per andata e ritorno', () => {
    expect(leaveVerb('arrive_by')).toBe('Esci alle');
    expect(leaveVerb('depart_after')).toBe('Parti alle');
    expect(describeSlack('arrive_by', 12)).toBe('12 min prima dell’inizio');
    expect(describeSlack('arrive_by', -4)).toBe('arrivi 4 min dopo l’inizio');
    expect(describeSlack('depart_after', 0)).toBe('subito dopo la lezione');
    expect(describeSlack('depart_after', 33)).toBe('33 min dopo la lezione');
    expect(slackCaption('arrive_by', 12)).toBe('prima dell’inizio');
    expect(slackCaption('arrive_by', -1)).toBe('di ritardo sull’inizio');
    expect(slackCaption('depart_after', 33)).toBe('dopo la lezione');
  });
});
