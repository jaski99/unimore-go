import type { Campus, Itinerary, Station } from '@/lib/api/types';
import type { PlannerValues } from '@/lib/plan-request';

export type LatLon = [number, number];

export interface RoutePoint {
  position: LatLon;
  label: string;
  kind: 'home' | 'station' | 'campus';
}

export interface RouteSegment {
  from: LatLon;
  to: LatLon;
  kind: 'active' | 'train';
}

export interface Route {
  points: RoutePoint[];
  segments: RouteSegment[];
}

const squared = (a: LatLon, b: LatLon) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;

export function nearestStation(stations: Station[], position: LatLon): Station | undefined {
  return [...stations].sort(
    (a, b) => squared([a.lat, a.lon], position) - squared([b.lat, b.lon], position),
  )[0];
}

/**
 * Straight-line sketch of the trip for the map: home (if known) -> station ->
 * train -> campus station -> campus, or a direct line for same-city trips.
 * No street routing is implied; the API computes the real durations.
 */
export function buildRoute(
  values: PlannerValues,
  stations: Station[],
  campus: Campus | undefined,
  itinerary: Itinerary | undefined,
): Route {
  const home: RoutePoint | null =
    values.originKind === 'home' && values.home
      ? { position: [values.home.lat, values.home.lon], label: 'Casa', kind: 'home' }
      : null;
  const homeStation = home
    ? nearestStation(stations, home.position)
    : stations.find((station) => station.id === values.stationId);
  const stationPoint = (station: Station): RoutePoint => ({
    position: [station.lat, station.lon],
    label: station.name,
    kind: 'station',
  });
  const start = home ?? (homeStation ? stationPoint(homeStation) : null);
  const campusPoint: RoutePoint | null = campus
    ? { position: [campus.lat, campus.lon], label: campus.name, kind: 'campus' }
    : null;

  if (!campusPoint || !start) return { points: [start, campusPoint].filter(isPoint), segments: [] };

  const usesTrain = itinerary?.legs.some((leg) => leg.type === 'train');
  if (!usesTrain || !homeStation) {
    const segments: RouteSegment[] = itinerary
      ? [{ from: start.position, to: campusPoint.position, kind: 'active' }]
      : [];
    return { points: [start, campusPoint], segments };
  }

  const campusStation =
    stations.find((station) => station.city === campus?.city) ??
    nearestStation(stations, campusPoint.position)!;
  if (campusStation.id === homeStation.id) {
    // Same city: never draw a train (also guards against a stale itinerary).
    return {
      points: [start, campusPoint],
      segments: [{ from: start.position, to: campusPoint.position, kind: 'active' }],
    };
  }
  const points = [home, stationPoint(homeStation), stationPoint(campusStation), campusPoint].filter(
    isPoint,
  );
  const segments: RouteSegment[] = [
    ...(home
      ? [
          {
            from: home.position,
            to: [homeStation.lat, homeStation.lon] as LatLon,
            kind: 'active' as const,
          },
        ]
      : []),
    {
      from: [homeStation.lat, homeStation.lon],
      to: [campusStation.lat, campusStation.lon],
      kind: 'train',
    },
    { from: [campusStation.lat, campusStation.lon], to: campusPoint.position, kind: 'active' },
  ];
  return { points, segments };
}

function isPoint(point: RoutePoint | null): point is RoutePoint {
  return point !== null;
}
