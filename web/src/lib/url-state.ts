import type { PlannerValues } from '@/lib/plan-request';
import { proposeLessonEnd } from '@/lib/return-trip';

/**
 * Search state in the URL query (shareable, works with Back/Forward/Reload):
 *
 *   ?sede=dief&stazione=reggio_fs&data=2026-10-26&ora=08:30&mezzo=bici&verso=andata&ritorno=13:00
 *
 * The home position is never written to the link (privacy): a search from home
 * says only `partenza=casa`, and the recipient's own saved home is used.
 *
 * `ritorno` is always a lesson end (HH:MM) and `ora` always a lesson start:
 * - `verso=andata&ora=09:00&ritorno=13:00`: outbound plus the return view;
 * - `verso=ritorno&ritorno=13:00`: a return search (written without `ora`);
 * - `verso=ritorno&ora=09:00` without `ritorno`: the lesson end is proposed
 *   (start + 2 h, round 4 point 5) and the search runs straight away.
 */
export interface UrlSearch {
  patch: Partial<PlannerValues>;
  /** Lesson end for the return view (HH:MM), when present. */
  returnTime?: string;
  /** Set when a return search uses a proposed lesson end (start + 2 h). */
  proposal?: { lessonStart: string; lessonEnd: string };
}

const ID = /^[a-z0-9_]{1,40}$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const MODES = { bici: 'bike', piedi: 'walk' } as const;
const DIRECTIONS = { andata: 'outbound', ritorno: 'return' } as const;

const isRealDate = (value: string) => {
  if (!DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** Values -> query string (without "?"); stable key order for comparisons. */
export function serializeSearch(values: PlannerValues, returnTime?: string): string {
  const params = new URLSearchParams();
  params.set('sede', values.campusId);
  if (values.originKind === 'station') params.set('stazione', values.stationId);
  else params.set('partenza', 'casa');
  params.set('data', values.date);
  const isReturn = values.direction === 'return';
  // In the return direction the form time is the lesson end.
  if (!isReturn) params.set('ora', values.time);
  params.set('mezzo', values.mode === 'walk' ? 'piedi' : 'bici');
  params.set('verso', isReturn ? 'ritorno' : 'andata');
  if (isReturn) params.set('ritorno', values.time);
  else if (returnTime && TIME.test(returnTime)) params.set('ritorno', returnTime);
  return params.toString();
}

/** Query string -> validated values; invalid parameters are ignored one by one. */
export function parseSearch(search: string): UrlSearch {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const patch: Partial<PlannerValues> = {};
  const campus = params.get('sede');
  if (campus && ID.test(campus)) patch.campusId = campus;
  const station = params.get('stazione');
  if (station && ID.test(station)) {
    patch.stationId = station;
    patch.originKind = 'station';
  }
  if (!patch.originKind && params.get('partenza') === 'casa') patch.originKind = 'home';
  const date = params.get('data');
  if (date && isRealDate(date)) patch.date = date;
  const time = params.get('ora');
  if (time && TIME.test(time)) patch.time = time;
  const mode = params.get('mezzo');
  if (mode && mode in MODES) patch.mode = MODES[mode as keyof typeof MODES];
  const direction = params.get('verso');
  if (direction && direction in DIRECTIONS)
    patch.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
  const ritorno = params.get('ritorno');
  const lessonEnd = ritorno && TIME.test(ritorno) ? ritorno : undefined;
  if (patch.direction === 'return') {
    if (lessonEnd) return { patch: { ...patch, time: lessonEnd } };
    if (!patch.time) return { patch };
    const proposed = proposeLessonEnd(patch.time);
    return {
      patch: { ...patch, time: proposed },
      proposal: { lessonStart: patch.time, lessonEnd: proposed },
    };
  }
  return { patch, ...(lessonEnd ? { returnTime: lessonEnd } : {}) };
}

/** True when the link carries a full search (campus, date and time): plan it on open. */
export function isCompleteSearch(search: UrlSearch): boolean {
  return !!(search.patch.campusId && search.patch.date && search.patch.time);
}
