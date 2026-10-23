import type { PlanRequest, TrainCategoryGroup, TravelMode } from '@/lib/api/types';
import { toRomeIso, todayInRome } from '@/lib/time-format';

/** 'station' = I start at the station; 'home' = from home (coordinates and/or minutes). */
export type OriginKind = 'home' | 'station';
/** 'outbound' = "A che ora esco?"; 'return' = "A che ora parto per tornare?". */
export type Direction = 'outbound' | 'return';

export interface HomeLocation {
  label: string;
  lat: number;
  lon: number;
}

/** Raw values of the planner form, independent of the API wire format. */
export interface PlannerValues {
  direction: Direction;
  campusId: string;
  date: string;
  /** Lesson start (outbound) or end (return), HH:MM. */
  time: string;
  mode: TravelMode;
  marginMin: number;
  stationBufferMin: number;
  regionalOnly: boolean;
  originKind: OriginKind;
  stationId: string;
  /** Home -> station minutes; null = let the API estimate from the home position. */
  homeToStationMin: number | null;
  home: HomeLocation | null;
}

export const ALL_CATEGORIES: TrainCategoryGroup[] = ['regional', 'intercity', 'high_speed'];
export const STATION_BUFFER_RANGE = { min: 1, max: 30 } as const;

/** Commuter defaults: today, 08:30, Reggio Emilia FS -> DIEF by bike, regional trains only. */
export function defaultPlannerValues(now = new Date()): PlannerValues {
  return {
    direction: 'outbound',
    campusId: 'dief',
    date: todayInRome(now),
    time: '08:30',
    mode: 'bike',
    marginMin: 10,
    stationBufferMin: 5,
    regionalOnly: true,
    originKind: 'station',
    stationId: 'reggio_fs',
    homeToStationMin: null,
    home: null,
  };
}

/** Italian validation message, or null when the values can be sent. */
export function validatePlannerValues(values: PlannerValues): string | null {
  if (!values.campusId) return 'Scegli la sede della lezione.';
  if (!values.date || !values.time) return 'Indica giorno e ora della lezione.';
  if (values.originKind === 'home' && !values.home && !values.homeToStationMin)
    return 'Indica dove abiti (indirizzo o mappa) oppure i minuti da casa alla stazione.';
  const buffer = values.stationBufferMin;
  if (
    !Number.isInteger(buffer) ||
    buffer < STATION_BUFFER_RANGE.min ||
    buffer > STATION_BUFFER_RANGE.max
  )
    return `Il tempo in stazione va da ${STATION_BUFFER_RANGE.min} a ${STATION_BUFFER_RANGE.max} minuti.`;
  if (!Number.isInteger(values.marginMin) || values.marginMin < 0 || values.marginMin > 60)
    return 'L’anticipo va da 0 a 60 minuti.';
  return null;
}

/** Map form values to the POST /api/plan body. */
export function buildPlanRequest(values: PlannerValues): PlanRequest {
  const fromHome = values.originKind === 'home';
  const origin =
    fromHome && values.home
      ? { lat: values.home.lat, lon: values.home.lon }
      : { station_id: values.stationId };
  const when = toRomeIso(values.date, values.time);
  return {
    origin,
    campus_id: values.campusId,
    ...(values.direction === 'return' ? { depart_after: when } : { arrive_by: when }),
    mode: values.mode,
    margin_min: values.marginMin,
    station_buffer_min: values.stationBufferMin,
    train_categories: values.regionalOnly ? ['regional'] : [...ALL_CATEGORIES],
    ...(fromHome && values.homeToStationMin
      ? { home_to_station_min: values.homeToStationMin }
      : {}),
  };
}
