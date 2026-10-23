import { describe, expect, it } from 'vitest';
import fixtures from './mock-fixtures.json';
import { MOCK_ONLY_DEMO_WARNING, MockPlanService } from './mock-plan-service';
import type { PlanRequest } from './types';

const demo = fixtures.demo.request as PlanRequest;

describe('MockPlanService', () => {
  it('espone sedi e stazioni registrate dalla vera API (stessi id)', async () => {
    const service = new MockPlanService();
    const campusIds = (await service.getCampuses()).map((campus) => campus.id);
    expect(campusIds).toContain('dief');
    expect((await service.getStations()).map((station) => station.id).sort()).toEqual([
      'modena_fs',
      'reggio_fs',
    ]);
    expect((await service.getHealth()).data_valid_to).toBe(fixtures.health.data_valid_to);
  });

  it('restituisce la risposta registrata per la richiesta demo', async () => {
    const result = await new MockPlanService().createPlan({ ...demo });
    expect(result).toEqual(fixtures.demo.response);
    expect(result.itineraries[0].leave_at).toMatch(/^\d{2}:\d{2}$/);
  });

  it('non inventa itinerari per richieste diverse', async () => {
    const service = new MockPlanService();
    for (const variant of [
      { ...demo, campus_id: 'campus_san_lazzaro' },
      { ...demo, mode: 'walk' as const },
      { ...demo, home_to_station_min: 12 },
      { ...demo, origin: { lat: 44.7, lon: 10.6 } },
      { ...demo, station_buffer_min: 10 },
      { ...demo, train_categories: ['regional' as const, 'high_speed' as const] },
      { ...demo, arrive_by: undefined, depart_after: demo.arrive_by },
    ]) {
      expect(await service.createPlan(variant)).toEqual({
        itineraries: [],
        nearby: [],
        warnings: [MOCK_ONLY_DEMO_WARNING],
      });
    }
  });

  it('il percorso registrato include 5 min in stazione e non ha tratti da 0 minuti', async () => {
    const result = await new MockPlanService().createPlan({ ...demo });
    const [first] = result.itineraries;
    expect(first.leave_at).toBe('07:39');
    expect(first.legs[0]).toMatchObject({ type: 'wait', minutes: 5 });
    expect(first.legs.every((leg) => leg.minutes > 0)).toBe(true);
  });

  it('non offre ricerca indirizzi in modalità mock', async () => {
    expect((await new MockPlanService().geocode()).results).toEqual([]);
  });
});
