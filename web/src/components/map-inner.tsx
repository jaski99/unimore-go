'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import type { LatLon, PointRole, Route } from '@/lib/route-geometry';

/** Marker colours; keep in sync with the legend in map-panel.tsx. */
export const ROLE_COLORS: Record<PointRole, string> = {
  home: '#0284c7',
  from_station: '#126e5b',
  to_station: '#6d28d9',
  campus: '#ea580c',
};

interface MapInnerProps {
  route: Route;
  picking: boolean;
  onPick: (lat: number, lon: number) => void;
}

export function MapInner({ route, picking, onPick }: MapInnerProps) {
  const positions = useMemo(() => route.points.map((point) => point.position), [route]);
  const center: LatLon = positions[0] ?? [44.676, 10.78];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      className={`leaflet-map ${picking ? 'cursor-crosshair' : ''}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {route.segments.map((segment, index) => (
        <Polyline
          key={`${segment.kind}-${index}`}
          positions={[segment.from, segment.to]}
          pathOptions={
            segment.kind === 'train'
              ? { color: '#126e5b', weight: 5, opacity: 0.85 }
              : { color: '#334155', weight: 3, dashArray: '6 8', opacity: 0.9 }
          }
        />
      ))}
      {route.points.map((point) => (
        <CircleMarker
          key={point.role}
          center={point.position}
          radius={point.role === 'home' || point.role === 'campus' ? 9 : 7}
          pathOptions={{
            color: '#ffffff',
            weight: 2,
            fillColor: ROLE_COLORS[point.role],
            fillOpacity: 1,
          }}
        >
          {/* Permanent labels: the markers are readable without hovering (touch). */}
          <Tooltip permanent direction="top" offset={[0, -8]} className="map-label">
            {point.label}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitAndResize positions={positions} />
      <PickHandler picking={picking} onPick={onPick} />
    </MapContainer>
  );
}

function FitAndResize({ positions }: { positions: LatLon[] }) {
  const map = useMap();
  useEffect(() => {
    // The container may get its final size after mount (lazy load, layout shifts).
    map.invalidateSize();
    if (positions.length > 1) {
      // Labels are centred on the markers: keep room for half a label on each side.
      const side = Math.min(110, Math.round(map.getSize().x * 0.28));
      map.fitBounds(positions, {
        paddingTopLeft: [side, 40],
        paddingBottomRight: [side, 24],
        maxZoom: 15,
      });
    } else if (positions.length === 1) map.setView(positions[0], 14);
  }, [map, positions]);
  useEffect(() => {
    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [map]);
  return null;
}

function PickHandler({ picking, onPick }: Pick<MapInnerProps, 'picking' | 'onPick'>) {
  useMapEvents({
    click(event) {
      if (picking) onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}
