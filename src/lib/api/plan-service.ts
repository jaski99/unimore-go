import type { Campus, HealthResponse, PlanRequest, PlanResponse, Station } from './types';
import { CAMPUSES, STATIONS } from '@/lib/data/locations';

export interface PlanService {
  getHealth(): Promise<HealthResponse>;
  getCampuses(): Promise<Campus[]>;
  getStations(): Promise<Station[]>;
  createPlan(request: PlanRequest): Promise<PlanResponse>;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

type FetchFunction = typeof fetch;

export class HttpPlanService implements PlanService {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetcher: FetchFunction = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  getHealth(): Promise<HealthResponse> {
    return this.get<HealthResponse>('/api/health');
  }

  getCampuses(): Promise<Campus[]> {
    return this.get<Campus[]>('/api/campuses');
  }

  getStations(): Promise<Station[]> {
    return this.get<Station[]>('/api/stations');
  }

  createPlan(request: PlanRequest): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, init);
    } catch {
      throw new ApiRequestError(
        'Impossibile raggiungere il servizio. Controlla la connessione.',
        'NETWORK_ERROR',
        0,
      );
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Partial<{
        detail: string;
        code: string;
      }>;
      throw new ApiRequestError(
        payload.detail ?? 'La richiesta non è andata a buon fine.',
        payload.code ?? 'REQUEST_ERROR',
        response.status,
      );
    }
    return (await response.json()) as T;
  }
}

export class MockPlanService implements PlanService {
  async getHealth(): Promise<HealthResponse> {
    return { status: 'ok', data_valid_to: '2026-10-23', version: 'mock-1.0' };
  }

  async getCampuses(): Promise<Campus[]> {
    return CAMPUSES.map((campus) => ({ ...campus }));
  }

  async getStations(): Promise<Station[]> {
    return STATIONS.map((station) => ({ ...station }));
  }

  async createPlan(request: PlanRequest): Promise<PlanResponse> {
    const campus = CAMPUSES.find((item) => item.id === request.campus_id);
    const stationId = 'station_id' in request.origin ? request.origin.station_id : '';
    const arriveBy = new Date(request.arrive_by);
    const isDemo =
      campus?.id === 'dief' &&
      stationId === 'reggio-emilia-fs' &&
      arriveBy.toISOString().startsWith('2026-10-26T07:30:00.000Z');

    if (!isDemo) {
      return {
        itineraries: [],
        warnings: [
          'Il mock contiene solo l’esempio Reggio Emilia FS → DIEF del 26/10/2026. Non sono dati di servizio reali.',
        ],
      };
    }

    const bike = request.mode === 'bike';
    const firstMileMinutes = request.home_to_station_min ?? (bike ? 14 : 32);
    const trainDepart = bike ? '2026-10-26T07:48:00+01:00' : '2026-10-26T07:32:00+01:00';
    const trainArrive = bike ? '2026-10-26T08:09:00+01:00' : '2026-10-26T07:56:00+01:00';
    const arriveAt = bike ? '2026-10-26T08:18:00+01:00' : '2026-10-26T08:19:00+01:00';
    const leaveDate = new Date(new Date(trainDepart).getTime() - firstMileMinutes * 60_000);
    const leaveAt = `${new Date(leaveDate.getTime() + 60 * 60_000).toISOString().slice(0, 19)}+01:00`;
    const lastMileMinutes = bike ? 9 : 23;

    return {
      itineraries: [
        {
          leave_at: leaveAt,
          arrive_at: arriveAt,
          slack_min: bike ? 12 : 11,
          legs: [
            {
              type: request.mode,
              from: 'Casa · Reggio Emilia',
              to: 'Reggio Emilia FS',
              depart: leaveAt,
              arrive: trainDepart,
              minutes: firstMileMinutes,
            },
            {
              type: 'train',
              from: 'Reggio Emilia FS',
              to: 'Modena FS',
              depart: trainDepart,
              arrive: trainArrive,
              minutes: bike ? 21 : 24,
              train: {
                number: bike ? 'ESEMPIO 1' : 'ESEMPIO 2',
                category: 'Regionale',
                operator: 'Trenitalia',
              },
            },
            {
              type: request.mode,
              from: 'Modena FS',
              to: 'DIEF Ingegneria · via Vivarelli 10',
              depart: trainArrive,
              arrive: arriveAt,
              minutes: lastMileMinutes,
            },
          ],
        },
      ],
      warnings: [
        'Orari dei treni e tempi di percorrenza nel mock: sono esempi, non dati in tempo reale.',
      ],
    };
  }
}

export function createPlanService(
  mode: string | undefined = process.env.NEXT_PUBLIC_API_MODE,
  apiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL,
): PlanService {
  if (mode === 'http') {
    if (!apiUrl)
      throw new Error('NEXT_PUBLIC_API_URL è obbligatoria quando NEXT_PUBLIC_API_MODE=http.');
    return new HttpPlanService(apiUrl);
  }
  if (mode === undefined || mode === '' || mode === 'mock') return new MockPlanService();
  throw new Error(`Modalità API non supportata: ${mode}. Usa "mock" o "http".`);
}
