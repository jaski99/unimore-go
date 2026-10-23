import { describe, expect, it } from 'vitest';
import fixtures from './api/mock-fixtures.json';
import type { Itinerary, Leg } from './api/types';
import { defaultPlannerValues } from './plan-request';
import { buildRoute, nearestStation, shortCampusName, stationForStop } from './route-geometry';

const { stations, campuses } = fixtures;
const dief = campuses.find((campus) => campus.id === 'dief')!;
const base = defaultPlannerValues(new Date('2026-10-26T06:00:00Z'));
const withTrain = fixtures.demo.response.itineraries[0] as Itinerary;
const train = withTrain.legs[1] as Leg;
const bikeOnly: Itinerary = { ...withTrain, legs: [withTrain.legs[2]] };
const home = { label: 'Casa mia', lat: 44.7, lon: 10.62 };

describe('stazioni dal percorso', () => {
  it('trova la stazione più vicina e quella di una fermata (città o nome)', () => {
    expect(nearestStation(stations, [44.7, 10.6])?.id).toBe('reggio_fs');
    expect(nearestStation(stations, [44.64, 10.92])?.id).toBe('modena_fs');
    expect(stationForStop(stations, 'Reggio Emilia')?.id).toBe('reggio_fs');
    expect(stationForStop(stations, 'Modena FS')?.id).toBe('modena_fs');
    expect(stationForStop(stations, 'rubiera')?.id).toBe('rubiera');
    expect(stationForStop(stations, 'Parma')).toBeUndefined();
  });
});

describe('route geometry', () => {
  it('andata: stazione partenza → treno (continuo) → stazione arrivo → sede (tratteggio)', () => {
    const route = buildRoute(base, stations, dief, withTrain);
    expect(route.points.map((point) => point.label)).toEqual([
      'Stazione partenza · Reggio Emilia FS',
      'Stazione arrivo · Modena FS',
      'Sede · DIEF',
    ]);
    expect(route.segments.map((segment) => segment.kind)).toEqual(['train', 'active']);
  });

  it('da casa aggiunge Casa → stazione di partenza del treno', () => {
    const route = buildRoute({ ...base, originKind: 'home', home }, stations, dief, withTrain);
    expect(route.points.map((point) => point.role)).toEqual([
      'home',
      'from_station',
      'to_station',
      'campus',
    ]);
    expect(route.points[0]).toMatchObject({ label: 'Casa', position: [44.7, 10.62] });
    expect(route.segments.map((segment) => segment.kind)).toEqual(['active', 'train', 'active']);
  });

  it('usa le stazioni del treno proposto (Rubiera), non quella scelta nel modulo', () => {
    const fromRubiera: Itinerary = {
      ...withTrain,
      legs: [{ ...train, from: 'Rubiera', to: 'Modena' }],
    };
    const route = buildRoute(base, stations, dief, fromRubiera);
    expect(route.points[0].label).toBe('Stazione partenza · Rubiera');
  });

  it('ritorno: sede → stazione partenza → treno → stazione arrivo → casa', () => {
    const back: Itinerary = {
      ...withTrain,
      legs: [{ ...train, from: 'Modena', to: 'Reggio Emilia' }],
    };
    const values = { ...base, direction: 'return' as const, originKind: 'home' as const, home };
    const route = buildRoute(values, stations, dief, back);
    expect(route.points.map((point) => point.role)).toEqual([
      'campus',
      'from_station',
      'to_station',
      'home',
    ]);
    expect(route.points[1].label).toBe('Stazione partenza · Modena FS');
    expect(route.segments.map((segment) => segment.kind)).toEqual(['active', 'train', 'active']);
  });

  it('senza treno una sola linea tratteggiata; senza risultato solo i punti', () => {
    const near = { label: 'Casa', lat: 44.64, lon: 10.93 };
    const values = { ...base, originKind: 'home' as const, home: near };
    expect(buildRoute(values, stations, dief, bikeOnly).segments).toEqual([
      { from: [44.64, 10.93], to: [dief.lat, dief.lon], kind: 'active' },
    ]);
    const pending = buildRoute(values, stations, dief, undefined);
    expect(pending.points.map((point) => point.role)).toEqual(['home', 'campus']);
    expect(pending.segments).toEqual([]);
    expect(buildRoute(base, stations, undefined, undefined)).toEqual({
      points: [
        {
          role: 'from_station',
          position: [44.697309, 10.642577],
          label: 'Stazione partenza · Reggio Emilia FS',
        },
      ],
      segments: [],
    });
  });

  it('non disegna mai un treno tra la stessa stazione (dato incoerente o vecchio)', () => {
    const loop: Itinerary = { ...withTrain, legs: [{ ...train, from: 'Modena', to: 'Modena' }] };
    const route = buildRoute({ ...base, stationId: 'modena_fs' }, stations, dief, loop);
    expect(route.points.map((point) => point.label)).toEqual([
      'Stazione partenza · Modena FS',
      'Sede · DIEF',
    ]);
    expect(route.segments.map((segment) => segment.kind)).toEqual(['active']);
  });

  it('ritorno senza treno: la stazione scelta è l’arrivo', () => {
    const values = { ...base, direction: 'return' as const };
    const route = buildRoute(values, stations, dief, undefined);
    expect(route.points.map((point) => point.role)).toEqual(['campus', 'to_station']);
  });
});

describe('shortCampusName', () => {
  it('usa la sigla tra parentesi quando c’è', () => {
    expect(shortCampusName("Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)")).toBe('DIEF');
    expect(shortCampusName('Palazzo Dossetti')).toBe('Palazzo Dossetti');
  });
});
