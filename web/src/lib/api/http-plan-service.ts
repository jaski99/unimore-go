import { ApiRequestError } from './errors';
import type { PlanService } from './plan-service';
import type {
  ApiErrorPayload,
  Campus,
  HealthResponse,
  PlanRequest,
  PlanResponse,
  Station,
} from './types';

type FetchFunction = typeof fetch;

/** PlanService backed by the real FastAPI backend over HTTP. */
export class HttpPlanService implements PlanService {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly fetcher: FetchFunction = (input, init) => fetch(input, init),
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  getHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health', { method: 'GET' });
  }

  getCampuses(): Promise<Campus[]> {
    return this.request<Campus[]>('/api/campuses', { method: 'GET' });
  }

  getStations(): Promise<Station[]> {
    return this.request<Station[]>('/api/stations', { method: 'GET' });
  }

  createPlan(request: PlanRequest): Promise<PlanResponse> {
    return this.request<PlanResponse>('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: { Accept: 'application/json', ...init.headers },
      });
    } catch {
      throw new ApiRequestError(
        'Impossibile raggiungere il servizio. Controlla la connessione.',
        'NETWORK_ERROR',
        0,
      );
    }

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as Partial<ApiErrorPayload>;
      throw new ApiRequestError(
        payload.detail ?? 'La richiesta non è andata a buon fine.',
        payload.code ?? 'REQUEST_ERROR',
        response.status,
      );
    }
    return (await response.json()) as T;
  }
}
