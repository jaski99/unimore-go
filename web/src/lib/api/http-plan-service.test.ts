import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError } from './errors';
import { HttpPlanService } from './http-plan-service';
import type { PlanRequest, PlanResponse } from './types';

const request: PlanRequest = {
  origin: { station_id: 'reggio_fs' },
  campus_id: 'dief',
  arrive_by: '2026-10-26T08:30:00+01:00',
  mode: 'bike',
  margin_min: 10,
};

// Shape returned by the real FastAPI contract: "HH:MM" times and train: null.
const apiPlan: PlanResponse = {
  itineraries: [
    {
      leave_at: '07:44',
      arrive_at: '08:18',
      slack_min: 12,
      legs: [
        {
          type: 'train',
          from: 'Reggio Emilia',
          to: 'Modena',
          depart: '07:44',
          arrive: '07:56',
          minutes: 12,
          train: { number: '3907', category: 'Regionale Veloce', operator: 'Trenitalia Tper' },
        },
        {
          type: 'bike',
          from: 'Modena FS',
          to: 'DIEF',
          depart: '07:56',
          arrive: '08:18',
          minutes: 22,
          train: null,
        },
      ],
    },
  ],
  warnings: ['Orari pianificati da bollettino ufficiale Trenitalia (non in tempo reale).'],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('HttpPlanService', () => {
  it('invia POST /api/plan con il contratto JSON e restituisce la risposta', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json(apiPlan));
    const service = new HttpPlanService('http://localhost:8000/', fetchMock);

    await expect(service.createPlan(request)).resolves.toEqual(apiPlan);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/plan');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(JSON.parse(String(init?.body))).toEqual(request);
  });

  it.each([
    ['getHealth', '/api/health'],
    ['getCampuses', '/api/campuses'],
    ['getStations', '/api/stations'],
  ] as const)('%s usa GET %s', async (method, path) => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(json([]));
    await new HttpPlanService('https://api.example.test', fetchMock)[method]();
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test${path}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('converte l’errore uniforme {detail, code} in ApiRequestError', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(json({ detail: 'Campus non trovato: xyz', code: 'NOT_FOUND' }, 404));
    const promise = new HttpPlanService('http://api', fetchMock).createPlan(request);
    await expect(promise).rejects.toBeInstanceOf(ApiRequestError);
    await expect(promise).rejects.toMatchObject({
      message: 'Campus non trovato: xyz',
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('usa un messaggio generico se il corpo d’errore non è JSON', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Bad gateway', { status: 502 }));
    await expect(new HttpPlanService('http://api', fetchMock).getHealth()).rejects.toMatchObject({
      code: 'REQUEST_ERROR',
      status: 502,
    });
  });

  it('segnala NETWORK_ERROR quando fetch fallisce (es. CORS o API spenta)', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      new HttpPlanService('http://localhost:8000', fetchMock).getCampuses(),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });
});
