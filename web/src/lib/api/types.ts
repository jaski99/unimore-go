/**
 * TypeScript mirror of the UnimoreGo FastAPI contract (api/schemas.py, v0.5).
 * Keep in sync with the OpenAPI schema served at /openapi.json.
 */

export type TravelMode = 'walk' | 'bike';
/** `wait` = minutes spent in the station before boarding. */
export type LegType = TravelMode | 'train' | 'wait';
export type TrainCategoryGroup = 'regional' | 'intercity' | 'high_speed';
export type PlannerName = 'arrive_by' | 'depart_after';

/** Wall-clock time in Europe/Rome, formatted "HH:MM" (e.g. "07:44"). */
export type ClockTime = string;

/** GET /api/health */
export interface HealthResponse {
  status: string;
  /** First day (YYYY-MM-DD) covered by the loaded Trenitalia timetable. */
  data_valid_from?: string;
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

/** Body of POST /api/plan. Exactly one of `arrive_by` / `depart_after`. */
export interface PlanRequest {
  origin: PlanOrigin;
  campus_id: string;
  /** Outbound: ISO 8601 lesson start with Europe/Rome offset. */
  arrive_by?: string;
  /** Return: ISO 8601 lesson end with Europe/Rome offset. */
  depart_after?: string;
  mode: TravelMode;
  /** Safety margin before the lesson, 0-60 minutes. */
  margin_min: number;
  home_to_station_min?: number;
  /** Minutes in the station before the train, 1-30 (API default 5). */
  station_buffer_min?: number;
  /** Allowed train groups; omitted = all (backward compatible). */
  train_categories?: TrainCategoryGroup[];
}

export interface TrainDetails {
  number: string;
  category: string;
  operator: string;
  /** R, RV, IC, ICN, EC, FR */
  code?: string;
  category_group?: TrainCategoryGroup;
  /** True when a regional ticket is not enough (IC/EC/FR). */
  different_ticket?: boolean;
  /** PDF page the run comes from. */
  source?: string;
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
  /** Leg-specific warnings (e.g. calendar note to verify on the PDF). */
  notes?: string[];
}

export interface Itinerary {
  leave_at: ClockTime;
  arrive_at: ClockTime;
  /** arrive_by: minutes before the lesson (negative = late); depart_after: free minutes after it. */
  slack_min: number;
  legs: Leg[];
  /** Travel date YYYY-MM-DD. */
  date?: string;
  /** Door-to-door minutes, from leaving to arriving (v0.5). */
  duration_min?: number;
  /** Train changes, 0 = direct (v0.5). */
  changes?: number;
}

export interface NearbySolution {
  kind: 'previous' | 'next';
  itinerary: Itinerary;
  /** Italian explanation, e.g. "Stessa ora di lezione, lunedì 26/10/2026 …" (v0.5). */
  label?: string;
}

export type NoticeLevel = 'error' | 'warning' | 'info';

/** Deduplicated, merged notice; the list is sorted by priority (v0.5). */
export interface Notice {
  /** out_of_validity, no_service, calendar_note, home_far, home_unknown, festive_day,
   * same_city, estimate, generic, not_realtime */
  code: string;
  level: NoticeLevel;
  message: string;
}

/** How the station time limit was computed (v0.5). */
export interface Calculation {
  station: string;
  time: ClockTime;
  summary: string;
}

/** Response of POST /api/plan. */
export interface PlanResponse {
  planner?: PlannerName;
  itineraries: Itinerary[];
  nearby?: NearbySolution[];
  calculation?: Calculation | null;
  notices?: Notice[];
  /** Legacy v0.4 list: "non in tempo reale" first, then the notices. */
  warnings: string[];
}

/** GET /api/geocode */
export interface GeocodeResult {
  label: string;
  lat: number;
  lon: number;
}

export interface GeocodeResponse {
  results: GeocodeResult[];
  attribution: string;
}

/** Uniform error body for 4xx/5xx responses. */
export interface ApiErrorPayload {
  detail: string;
  code: string;
}
