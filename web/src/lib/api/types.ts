/**
 * TypeScript mirror of the UnimoreGo FastAPI contract (api/schemas.py).
 * Keep in sync with the OpenAPI schema served at /openapi.json.
 */

export type TravelMode = 'walk' | 'bike';
export type LegType = TravelMode | 'train';

/** Wall-clock time in Europe/Rome, formatted "HH:MM" (e.g. "07:44"). */
export type ClockTime = string;

/** GET /api/health */
export interface HealthResponse {
  status: string;
  /** Last day (YYYY-MM-DD) covered by the loaded Trenitalia timetable. */
  data_valid_to: string;
  version: string;
}

/** Item of GET /api/campuses */
export interface Campus {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

/** Item of GET /api/stations */
export interface Station {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

export type PlanOrigin = { lat: number; lon: number } | { station_id: string };

/** Body of POST /api/plan */
export interface PlanRequest {
  origin: PlanOrigin;
  campus_id: string;
  /** ISO 8601 date-time of the lesson start, with Europe/Rome offset. */
  arrive_by: string;
  mode: TravelMode;
  /** Safety margin before the lesson, 0-60 minutes. */
  margin_min: number;
  home_to_station_min?: number;
}

export interface TrainDetails {
  number: string;
  category: string;
  operator: string;
}

export interface Leg {
  type: LegType;
  from: string;
  to: string;
  depart: ClockTime;
  arrive: ClockTime;
  minutes: number;
  /** Present only for train legs; the API sends null otherwise. */
  train?: TrainDetails | null;
}

export interface Itinerary {
  leave_at: ClockTime;
  arrive_at: ClockTime;
  slack_min: number;
  legs: Leg[];
}

/** Response of POST /api/plan: up to 3 itineraries, latest departure first. */
export interface PlanResponse {
  itineraries: Itinerary[];
  warnings: string[];
}

/** Uniform error body for 4xx/5xx responses. */
export interface ApiErrorPayload {
  detail: string;
  code: string;
}
