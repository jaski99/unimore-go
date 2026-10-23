import type { StorageLike } from '@/lib/schedule-store';
import {
  defaultPlannerValues,
  STATION_BUFFER_RANGE,
  type HomeLocation,
  type PlannerValues,
} from '@/lib/plan-request';

/** Everything the commuter sets once; the date is never stored (always today or a lesson). */
export type StoredPreferences = Omit<PlannerValues, 'date'>;

const STORAGE_KEY = 'unimorego.planner.v1';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const isInt = (value: unknown): value is number => Number.isInteger(value);

function sanitizeHome(value: unknown): HomeLocation | null {
  if (!value || typeof value !== 'object') return null;
  const home = value as Partial<HomeLocation>;
  if (typeof home.lat !== 'number' || typeof home.lon !== 'number') return null;
  if (Math.abs(home.lat) > 90 || Math.abs(home.lon) > 180) return null;
  return {
    label: typeof home.label === 'string' ? home.label : 'Casa',
    lat: home.lat,
    lon: home.lon,
  };
}

/** Merge untrusted stored data onto defaults, field by field. */
export function sanitizePreferences(
  raw: unknown,
  base = defaultPlannerValues(),
): StoredPreferences {
  const { date: _date, ...defaults } = base;
  void _date;
  if (!raw || typeof raw !== 'object') return defaults;
  const data = raw as Record<string, unknown>;
  return {
    direction: data.direction === 'return' ? 'return' : 'outbound',
    campusId:
      typeof data.campusId === 'string' && data.campusId ? data.campusId : defaults.campusId,
    time:
      typeof data.time === 'string' && /^\d{2}:\d{2}$/.test(data.time) ? data.time : defaults.time,
    mode: data.mode === 'walk' || data.mode === 'bike' ? data.mode : defaults.mode,
    marginMin: isInt(data.marginMin) ? clamp(data.marginMin, 0, 60) : defaults.marginMin,
    stationBufferMin: isInt(data.stationBufferMin)
      ? clamp(data.stationBufferMin, STATION_BUFFER_RANGE.min, STATION_BUFFER_RANGE.max)
      : defaults.stationBufferMin,
    regionalOnly:
      typeof data.regionalOnly === 'boolean' ? data.regionalOnly : defaults.regionalOnly,
    originKind: data.originKind === 'home' ? 'home' : 'station',
    stationId:
      typeof data.stationId === 'string' && data.stationId ? data.stationId : defaults.stationId,
    homeToStationMin:
      isInt(data.homeToStationMin) && data.homeToStationMin > 0
        ? clamp(data.homeToStationMin, 1, 180)
        : null,
    home: sanitizeHome(data.home),
  };
}

export class LocalStoragePreferencesStore {
  constructor(private readonly storage: StorageLike) {}

  load(base = defaultPlannerValues()): StoredPreferences | null {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      return raw ? sanitizePreferences(JSON.parse(raw), base) : null;
    } catch {
      return null;
    }
  }

  save(values: PlannerValues): void {
    const { date: _date, ...preferences } = values;
    void _date;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Storage full or disabled (private mode): preferences are a convenience only.
    }
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }
}
