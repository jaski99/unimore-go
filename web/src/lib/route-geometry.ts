import type { Campus, Itinerary, Leg, Station } from '@/lib/api/types';
import type { PlannerValues } from '@/lib/plan-request';

export type LatLon = [number, number];

/** What a map marker stands for; drives its icon and its permanent label. */
export type PointRole = 'home' | 'from_station' | 'to_station' | 'campus';

export interface RoutePoint {
  position: LatLon;
  role: PointRole;
  /** Visible label, e.g. "Stazione partenza · Reggio Emilia FS". */
  label: string;
}

/** Train segments are drawn solid, walk/bike dashed. */
export type SegmentKind = 'train' | 'active';

export interface RouteSegment {
  from: LatLon;
  to: LatLon;
  kind: SegmentKind;
}

export interface Route {
  points: RoutePoint[];
  segments: RouteSegment[];
}

export const ROLE_LABELS: Record<PointRole, string> = {
  home: 'Casa',
  from_station: 'Stazione partenza',
  to_station: 'Stazione arrivo',
  campus: 'Sede',
};

/** "Dipartimento di Ingegneria 'Enzo Ferrari' (DIEF)" -> "DIEF"; names without an acronym stay. */
export function shortCampusName(name: string): string {
  return name.match(/\(([^)]+)\)\s*$/)?.[1] ?? name;
}

const squared = (a: LatLon, b: LatLon) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+fs$/, '')
    .trim();

export function nearestStation(stations: Station[], position: LatLon): Station | undefined {
  return [...stations].sort(
    (a, b) => squared([a.lat, a.lon], position) - squared([b.lat, b.lon], position),
  )[0];
}

/** Train legs name the stop by city ("Reggio Emilia"); walk legs by station ("Modena FS"). */
export function stationForStop(stations: Station[], stop: string): Station | undefined {
  const key = fold(stop);
  return stations.find((station) => fold(station.city) === key || fold(station.name) === key);
}

const at = (place: { lat: number; lon: number }): LatLon => [place.lat, place.lon];

function point(role: PointRole, position: LatLon, name?: string): RoutePoint {
  return { role, position, label: name ? `${ROLE_LABELS[role]} · ${name}` : ROLE_LABELS[role] };
}

/**
 * Straight-line sketch of the trip for the map. With a train itinerary:
 * [home] → departure station → (train) → arrival station → campus, mirrored
 * for the return trip. The stations come from the itinerary's own train legs,
 * so Rubiera and multi-train trips are drawn correctly. Without a train, a
 * single walk/bike line; without a result, only the endpoints.
 * No street routing is implied: the API computes the real durations.
 */
export function buildRoute(
  values: PlannerValues,
  stations: Station[],
  campus: Campus | undefined,
  itinerary: Itinerary | undefined,
): Route {
  const isReturn = values.direction === 'return';
  const home = values.originKind === 'home' && values.home ? at(values.home) : undefined;
  const chosenStation =
    values.originKind === 'station'
      ? stations.find((station) => station.id === values.stationId)
      : undefined;
  const campusAt = campus ? at(campus) : undefined;
  const campusPoint = campusAt && point('campus', campusAt, shortCampusName(campus!.name));

  const trains = itinerary?.legs.filter((leg): leg is Leg => leg.type === 'train') ?? [];
  const boarding = trains[0] && stationForStop(stations, trains[0].from);
  const alighting = trains.at(-1) && stationForStop(stations, trains.at(-1)!.to);

  if (campusPoint && boarding && alighting && boarding.id !== alighting.id) {
    const fromStation = point('from_station', at(boarding), boarding.name);
    const toStation = point('to_station', at(alighting), alighting.name);
    const homePoint = home && point('home', home);
    const start = isReturn ? campusPoint : homePoint;
    const end = isReturn ? homePoint : campusPoint;
    const points = [start, fromStation, toStation, end].filter(isPoint);
    const segments: RouteSegment[] = [
      ...(start ? [segment(start, fromStation, 'active')] : []),
      segment(fromStation, toStation, 'train'),
      ...(end ? [segment(toStation, end, 'active')] : []),
    ];
    return { points, segments };
  }

  // No train (same city, pending result or stale itinerary): endpoints only,
  // joined by one walk/bike line once there is a result.
  const own = home
    ? point('home', home)
    : chosenStation &&
      point(isReturn ? 'to_station' : 'from_station', at(chosenStation), chosenStation.name);
  const ordered = (isReturn ? [campusPoint, own] : [own, campusPoint]).filter(isPoint);
  const segments =
    itinerary && ordered.length === 2 ? [segment(ordered[0], ordered[1], 'active')] : [];
  return { points: ordered, segments };
}

function segment(from: RoutePoint, to: RoutePoint, kind: SegmentKind): RouteSegment {
  return { from: from.position, to: to.position, kind };
}

function isPoint(value: RoutePoint | undefined): value is RoutePoint {
  return value !== undefined;
}
