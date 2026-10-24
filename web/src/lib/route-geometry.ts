import type { Campus, Itinerary, Leg, Station } from '@/lib/api/types';
import { shortCampusName } from '@/lib/campus-name';
import type { PlannerValues } from '@/lib/plan-request';

export type LatLon = [number, number];

/** What a map marker stands for; drives its icon and its permanent label. */
export type PointRole = 'home' | 'from_station' | 'to_station' | 'campus';

/** Where the permanent label sits: above or below its marker (labels stay centred). */
export type LabelSide = 'top' | 'bottom';

export interface RoutePoint {
  position: LatLon;
  role: PointRole;
  /** Full label, e.g. "Stazione partenza · Reggio Emilia FS" (map summary, wide maps). */
  label: string;
  /** Label for narrow maps, e.g. "Partenza · Reggio Emilia FS" (round 5, point 2). */
  shortLabel: string;
  labelSide: LabelSide;
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

/** Shorter role names for maps narrower than `COMPACT_MAP_WIDTH` (the legend keeps the full ones). */
export const SHORT_ROLE_LABELS: Record<PointRole, string> = {
  home: 'Casa',
  from_station: 'Partenza',
  to_station: 'Arrivo',
  campus: 'Sede',
};

/** Below this map width (pixels) the map shows `shortLabel`. */
export const COMPACT_MAP_WIDTH = 480;

/** The label to draw on a map of the given width. */
export function mapLabel(point: RoutePoint, mapWidth: number): string {
  return mapWidth < COMPACT_MAP_WIDTH ? point.shortLabel : point.label;
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
  return {
    role,
    position,
    label: name ? `${ROLE_LABELS[role]} · ${name}` : ROLE_LABELS[role],
    shortLabel: name ? `${SHORT_ROLE_LABELS[role]} · ${name}` : SHORT_ROLE_LABELS[role],
    labelSide: 'top',
  };
}

/** Strictly "north of" `other`; at the same latitude the western point counts as north. */
const isAbove = (point: LatLon, other: LatLon) =>
  point[0] > other[0] || (point[0] === other[0] && point[1] < other[1]);

/**
 * Keep labels of nearby markers apart at any zoom (review B5): each label
 * goes on the side away from its nearest marker, i.e. above when the point
 * is the northern one of the pair, below otherwise. Mutual nearest
 * neighbours (Modena FS and DIEF, a home next to its station) thus always
 * get opposite sides, while labels stay horizontally centred.
 */
export function assignLabelSides(points: RoutePoint[]): RoutePoint[] {
  return points.map((current) => {
    const others = points.filter((other) => other !== current);
    if (!others.length) return { ...current, labelSide: 'top' };
    const nearest = others.reduce((best, other) =>
      squared(other.position, current.position) < squared(best.position, current.position)
        ? other
        : best,
    );
    return {
      ...current,
      labelSide: isAbove(current.position, nearest.position) ? 'top' : 'bottom',
    };
  });
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
    return { points: assignLabelSides(points), segments };
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
  return { points: assignLabelSides(ordered), segments };
}

function segment(from: RoutePoint, to: RoutePoint, kind: SegmentKind): RouteSegment {
  return { from: from.position, to: to.position, kind };
}

function isPoint(value: RoutePoint | undefined): value is RoutePoint {
  return value !== undefined;
}
