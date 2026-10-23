import { describe, expect, it } from 'vitest';
import {
  buildPlanRequest,
  defaultPlannerValues,
  validatePlannerValues,
  type PlannerValues,
} from './plan-request';

// Monday 26/10/2026 07:00 Europe/Rome (CET, +01:00).
const NOW = new Date('2026-10-26T06:00:00Z');
const base: PlannerValues = defaultPlannerValues(NOW);

describe('defaultPlannerValues', () => {
  it('usa oggi (Europe/Rome), solo regionali e 5 minuti in stazione', () => {
    expect(base).toMatchObject({
      direction: 'outbound',
      date: '2026-10-26',
      time: '08:30',
      stationBufferMin: 5,
      regionalOnly: true,
      originKind: 'station',
      stationId: 'reggio_fs',
      home: null,
    });
    // 23:30 UTC is already the next day in Rome.
    expect(defaultPlannerValues(new Date('2026-10-26T23:30:00Z')).date).toBe('2026-10-27');
  });
});

describe('buildPlanRequest', () => {
  it('mappa i valori predefiniti sul contratto v0.4 (arrive_by, buffer, regionali)', () => {
    expect(buildPlanRequest(base)).toEqual({
      origin: { station_id: 'reggio_fs' },
      campus_id: 'dief',
      arrive_by: '2026-10-26T08:30:00+01:00',
      mode: 'bike',
      margin_min: 10,
      station_buffer_min: 5,
      train_categories: ['regional'],
    });
  });

  it('con tutti i treni invia tutte le categorie', () => {
    expect(buildPlanRequest({ ...base, regionalOnly: false }).train_categories).toEqual([
      'regional',
      'intercity',
      'high_speed',
    ]);
  });

  it('il ritorno usa depart_after al posto di arrive_by', () => {
    const request = buildPlanRequest({ ...base, direction: 'return', time: '13:00' });
    expect(request.depart_after).toBe('2026-10-26T13:00:00+01:00');
    expect(request.arrive_by).toBeUndefined();
  });

  it('da casa invia le coordinate e i minuti solo se indicati', () => {
    const home = { label: 'Casa', lat: 44.69, lon: 10.63 };
    const withCoords = buildPlanRequest({ ...base, originKind: 'home', home });
    expect(withCoords.origin).toEqual({ lat: 44.69, lon: 10.63 });
    expect(withCoords.home_to_station_min).toBeUndefined();
    const minutesOnly = buildPlanRequest({ ...base, originKind: 'home', homeToStationMin: 7 });
    expect(minutesOnly.origin).toEqual({ station_id: 'reggio_fs' });
    expect(minutesOnly.home_to_station_min).toBe(7);
  });

  it('dalla stazione ignora casa e minuti salvati', () => {
    const request = buildPlanRequest({
      ...base,
      home: { label: 'Casa', lat: 1, lon: 2 },
      homeToStationMin: 9,
    });
    expect(request.origin).toEqual({ station_id: 'reggio_fs' });
    expect(request.home_to_station_min).toBeUndefined();
  });
});

describe('validatePlannerValues', () => {
  it('accetta i valori predefiniti', () => {
    expect(validatePlannerValues(base)).toBeNull();
  });

  it.each([
    [{ campusId: '' }, /sede/],
    [{ time: '' }, /giorno e ora/],
    [{ originKind: 'home' as const }, /dove abiti/],
    [{ stationBufferMin: 0 }, /1 a 30/],
    [{ stationBufferMin: 31 }, /1 a 30/],
    [{ marginMin: 61 }, /0 a 60/],
  ])('rifiuta %o', (patch, message) => {
    expect(validatePlannerValues({ ...base, ...patch })).toMatch(message);
  });
});

describe('returnTripValues', () => {
  it('stesse impostazioni dell’andata, partenza dopo la fine lezione', async () => {
    const {
      buildPlanRequest: build,
      defaultPlannerValues: defaults,
      returnTripValues,
    } = await import('./plan-request');
    const outbound = {
      ...defaults(new Date('2026-10-26T06:00:00Z')),
      date: '2026-10-26',
      time: '08:30',
    };
    const back = returnTripValues(outbound, '13:00');
    expect(back).toEqual({ ...outbound, direction: 'return', time: '13:00' });
    expect(build(back)).toMatchObject({ depart_after: '2026-10-26T13:00:00+01:00' });
  });
});
