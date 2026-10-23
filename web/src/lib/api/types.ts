export type TravelMode = 'walk' | 'bike';

export interface HealthResponse {
  status: 'ok';
  data_valid_to: string;
  version: string;
}

export interface Campus {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

export interface Station {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

export type PlanOrigin = { lat: number; lon: number } | { station_id: string };

export interface PlanRequest {
  origin: PlanOrigin;
  campus_id: string;
  arrive_by: string;
  mode: TravelMode;
  margin_min: number;
  home_to_station_min?: number;
}

export interface TrainDetails {
  number: string;
  category: string;
  operator: string;
}

export interface Leg {
  type: TravelMode | 'train';
  from: string;
  to: string;
  depart: string;
  arrive: string;
  minutes: number;
  train?: TrainDetails;
}

export interface Itinerary {
  leave_at: string;
  arrive_at: string;
  slack_min: number;
  legs: Leg[];
}

export interface PlanResponse {
  itineraries: Itinerary[];
  warnings: string[];
}

export interface ApiErrorPayload {
  detail: string;
  code: string;
}
