'use client';

import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { Campus, Station } from '@/lib/api/types';

export function MapInner({ campus, station }: { campus?: Campus; station?: Station }) {
  const points = useMemo(
    () => [
      ...(station ? [{ lat: station.lat, lon: station.lon }] : []),
      ...(campus ? [{ lat: campus.lat, lon: campus.lon }] : []),
    ],
    [campus, station],
  );
  const center: [number, number] = points.length ? [points[0].lat, points[0].lon] : [44.676, 10.78];

  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className="leaflet-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {station && (
        <CircleMarker
          center={[station.lat, station.lon]}
          radius={8}
          pathOptions={{ color: '#126e5b', fillColor: '#126e5b', fillOpacity: 0.9 }}
        >
          <Tooltip>{station.name}</Tooltip>
        </CircleMarker>
      )}
      {campus && (
        <CircleMarker
          center={[campus.lat, campus.lon]}
          radius={8}
          pathOptions={{ color: '#e18752', fillColor: '#e18752', fillOpacity: 0.95 }}
        >
          <Tooltip>{campus.name}</Tooltip>
        </CircleMarker>
      )}
      <Bounds points={points} />
    </MapContainer>
  );
}

function Bounds({ points }: { points: { lat: number; lon: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1)
      map.fitBounds(
        points.map((point) => [point.lat, point.lon]),
        { padding: [35, 35] },
      );
    else if (points.length === 1) map.setView([points[0].lat, points[0].lon], 14);
  }, [map, points]);
  return null;
}
