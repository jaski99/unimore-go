import { describe, expect, it } from 'vitest';
import { buildPlanRequest, DEFAULT_PLANNER_VALUES } from './plan-request';

describe('buildPlanRequest', () => {
  it('mappa i valori predefiniti sul contratto POST /api/plan', () => {
    expect(buildPlanRequest(DEFAULT_PLANNER_VALUES)).toEqual({
      origin: { station_id: 'reggio_fs' },
      campus_id: 'dief',
      arrive_by: '2026-10-26T08:30:00+01:00',
      mode: 'bike',
      margin_min: 10,
    });
  });

  it('aggiunge home_to_station_min solo partendo da casa', () => {
    const request = buildPlanRequest({
      ...DEFAULT_PLANNER_VALUES,
      originKind: 'home',
      homeToStationMin: 7,
    });
    expect(request.home_to_station_min).toBe(7);
    expect(request.origin).toEqual({ station_id: 'reggio_fs' });
  });

  it('usa le coordinate con la posizione e ricade sulla stazione senza coordinate', () => {
    const coords = { lat: 44.69, lon: 10.63 };
    expect(
      buildPlanRequest({ ...DEFAULT_PLANNER_VALUES, originKind: 'location', coordinates: coords })
        .origin,
    ).toEqual(coords);
    expect(buildPlanRequest({ ...DEFAULT_PLANNER_VALUES, originKind: 'location' }).origin).toEqual({
      station_id: 'reggio_fs',
    });
  });
});
