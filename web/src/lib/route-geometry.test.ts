import { describe, expect, it } from 'vitest';
import fixtures from './api/mock-fixtures.json';
import type { Itinerary } from './api/types';
import { defaultPlannerValues } from './plan-request';
import { buildRoute, nearestStation } from './route-geometry';

const { stations, campuses } = fixtures;
const dief = campuses.find((campus) => campus.id === 'dief')!;
const base = defaultPlannerValues(new Date('2026-10-26T06:00:00Z'));
const withTrain = fixtures.demo.response.itineraries[0] as Itinerary;
const bikeOnly: Itinerary = { ...withTrain, legs: [withTrain.legs[2]] };

describe('route geometry', () => {
  it('trova la stazione più vicina', () => {
    expect(nearestStation(stations, [44.7, 10.6])?.id).toBe('reggio_fs');
    expect(nearestStation(stations, [44.64, 10.92])?.id).toBe('modena_fs');
  });

  it('stazione → treno → stazione → sede, con il treno a tratto continuo', () => {
    const route = buildRoute(base, stations, dief, withTrain);
    expect(route.points.map((point) => point.kind)).toEqual(['station', 'station', 'campus']);
    expect(route.segments.map((segment) => segment.kind)).toEqual(['train', 'active']);
  });

  it('da casa aggiunge il tratto casa → stazione più vicina', () => {
    const home = { label: 'Casa', lat: 44.7, lon: 10.62 };
    const route = buildRoute({ ...base, originKind: 'home', home }, stations, dief, withTrain);
    expect(route.points[0]).toMatchObject({ kind: 'home', position: [44.7, 10.62] });
    expect(route.segments.map((segment) => segment.kind)).toEqual(['active', 'train', 'active']);
  });

  it('senza treno disegna una sola linea diretta; senza risultato solo i punti', () => {
    const home = { label: 'Casa', lat: 44.64, lon: 10.93 };
    const values = { ...base, originKind: 'home' as const, home };
    expect(buildRoute(values, stations, dief, bikeOnly).segments).toHaveLength(1);
    const pending = buildRoute(values, stations, dief, undefined);
    expect(pending.points).toHaveLength(2);
    expect(pending.segments).toEqual([]);
    expect(buildRoute(base, stations, undefined, undefined).segments).toEqual([]);
  });
});
