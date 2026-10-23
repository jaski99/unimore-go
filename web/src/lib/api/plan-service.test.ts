import { describe, expect, it, vi } from 'vitest';
import { createPlanService, HttpPlanService, MockPlanService } from './plan-service';
import type { PlanRequest } from './types';

const demoRequest: PlanRequest = {
  origin: { station_id: 'reggio-emilia-fs' },
  campus_id: 'dief',
  arrive_by: '2026-10-26T08:30:00+01:00',
  mode: 'bike',
  margin_min: 10,
  home_to_station_min: 14,
};

describe('MockPlanService', () => {
  it('espone solo le sedi e le stazioni specificate', async () => {
    const service = new MockPlanService();
    expect((await service.getCampuses()).map((campus) => campus.id)).toEqual([
      'dief',
      'economia-marco-biagi',
      'giurisprudenza',
      'palazzo-dossetti',
      'san-lazzaro',
    ]);
    expect((await service.getStations()).map((station) => station.name)).toEqual([
      'Reggio Emilia FS',
      'Modena FS',
    ]);
    expect(await service.getHealth()).toEqual({
      status: 'ok',
      data_valid_to: '2026-10-23',
      version: 'mock-1.0',
    });
  });

  it('riproduce l’esempio bici richiesto e avverte che gli orari sono dimostrativi', async () => {
    const result = await new MockPlanService().createPlan(demoRequest);
    expect(result.itineraries[0].leave_at).toBe('2026-10-26T07:34:00+01:00');
    expect(result.itineraries[0].arrive_at).toBe('2026-10-26T08:18:00+01:00');
    expect(result.itineraries[0].legs[1].train?.number).toBe('ESEMPIO 1');
    expect(result.warnings[0]).toContain('non dati in tempo reale');
  });

  it('riproduce l’esempio a piedi e non inventa soluzioni fuori dal caso dimostrativo', async () => {
    const service = new MockPlanService();
    const walk = await service.createPlan({
      ...demoRequest,
      mode: 'walk',
      home_to_station_min: 32,
    });
    expect(walk.itineraries[0].leave_at).toBe('2026-10-26T07:00:00+01:00');
    expect(walk.itineraries[0].arrive_at).toBe('2026-10-26T08:19:00+01:00');
    const noMatch = await service.createPlan({ ...demoRequest, campus_id: 'san-lazzaro' });
    expect(noMatch.itineraries).toEqual([]);
  });

  it('sceglie il client in base alle variabili d’ambiente', () => {
    expect(createPlanService('mock')).toBeInstanceOf(MockPlanService);
    expect(createPlanService('http', 'https://api.example.test')).toBeInstanceOf(HttpPlanService);
    expect(() => createPlanService('http')).toThrow('NEXT_PUBLIC_API_URL');
  });
});

describe('HttpPlanService', () => {
  it('chiama l’endpoint corretto e serializza il contratto POST', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ itineraries: [], warnings: [] }), { status: 200 }),
      );
    const service = new HttpPlanService('https://api.example.test/', fetchMock);
    await service.createPlan(demoRequest);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/plan',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoRequest),
      }),
    );
  });

  it('legge detail e code dall’errore JSON', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Sede non valida', code: 'INVALID_CAMPUS' }), {
        status: 422,
      }),
    );
    const service = new HttpPlanService('https://api.example.test', fetchMock);
    await expect(service.getCampuses()).rejects.toMatchObject({
      message: 'Sede non valida',
      code: 'INVALID_CAMPUS',
      status: 422,
    });
  });
});
