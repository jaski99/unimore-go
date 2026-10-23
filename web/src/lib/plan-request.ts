import type { PlanRequest, TravelMode } from '@/lib/api/types';
import { toRomeIso } from '@/lib/time-format';

export type OriginKind = 'home' | 'station' | 'location';

/** Raw values of the planner form, independent of the API wire format. */
export interface PlannerValues {
  campusId: string;
  date: string;
  time: string;
  mode: TravelMode;
  marginMin: number;
  originKind: OriginKind;
  stationId: string;
  homeToStationMin: number;
  coordinates: { lat: number; lon: number } | null;
}

/** Initial form state: Reggio Emilia FS -> DIEF, Monday 26/10/2026 08:30, bike, 10 min. */
export const DEFAULT_PLANNER_VALUES: PlannerValues = {
  campusId: 'dief',
  date: '2026-10-26',
  time: '08:30',
  mode: 'bike',
  marginMin: 10,
  originKind: 'station',
  stationId: 'reggio_fs',
  homeToStationMin: 10,
  coordinates: null,
};

/** Map form values to the POST /api/plan body. */
export function buildPlanRequest(values: PlannerValues): PlanRequest {
  const origin =
    values.originKind === 'location' && values.coordinates
      ? { ...values.coordinates }
      : { station_id: values.stationId };
  return {
    origin,
    campus_id: values.campusId,
    arrive_by: toRomeIso(values.date, values.time),
    mode: values.mode,
    margin_min: values.marginMin,
    ...(values.originKind === 'home' ? { home_to_station_min: values.homeToStationMin } : {}),
  };
}
