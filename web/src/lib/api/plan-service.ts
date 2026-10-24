import { apiConfig, type ApiConfig } from './config';
import { HttpPlanService } from './http-plan-service';
import { MockPlanService } from './mock-plan-service';
import type {
  Campus,
  GeocodeResponse,
  HealthResponse,
  PlanRequest,
  PlanResponse,
  Station,
} from './types';

export { ApiRequestError } from './errors';
export { HttpPlanService } from './http-plan-service';
export { MockPlanService } from './mock-plan-service';

/** Port used by UI code; implementations are swappable (HTTP, mock, ...). */
export interface PlanService {
  getHealth(): Promise<HealthResponse>;
  getCampuses(): Promise<Campus[]>;
  getStations(): Promise<Station[]>;
  createPlan(request: PlanRequest): Promise<PlanResponse>;
  /** Address search for the home location (submit-only, never autocomplete). */
  geocode(query: string): Promise<GeocodeResponse>;
}

/** Real HTTP client by default; the mock only when explicitly requested. */
export function createPlanService(config: ApiConfig = apiConfig): PlanService {
  return config.useMock ? new MockPlanService() : new HttpPlanService(config.apiUrl);
}
