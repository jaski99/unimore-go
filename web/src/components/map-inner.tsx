'use client';

import 'leaflet/dist/leaflet.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { layoutLabels, tooltipOffset, type Box, type LabelPlacement } from '@/lib/label-layout';
import {
  mapLabel,
  type LatLon,
  type PointRole,
  type Route,
  type RoutePoint,
} from '@/lib/route-geometry';

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
      <RouteMarkers points={route.points} />
      <FitAndResize
        positions={positions}
        labelBelow={route.points.some((point) => point.labelSide === 'bottom')}
      />
      <PickHandler picking={picking} onPick={onPick} />
    </MapContainer>
  );
}

const markerRadius = (point: RoutePoint) =>
  point.role === 'home' || point.role === 'campus' ? 9 : 7;

/** Size of a label as rendered by `.leaflet-tooltip.map-label` (globals.css). */
let measureContext: CanvasRenderingContext2D | null | undefined;
function labelSize(text: string): { width: number; height: number } {
  if (measureContext === undefined)
    measureContext = document.createElement('canvas').getContext('2d');
  let textWidth = text.length * 6.2;
  if (measureContext) {
    measureContext.font = `600 11px ${getComputedStyle(document.body).fontFamily}`;
    textWidth = measureContext.measureText(text).width;
  }
  // padding 6+6, border 1+1, max-width 220 (ellipsis); line 11 x 1.3 + padding 2+2 + border.
  // +8 %: phone system fonts render wider than the measured fallback (round 5, point 2).
  return { width: Math.min(220, Math.ceil(textWidth * 1.08) + 14), height: 20 };
}

/** Leaflet controls (zoom buttons, attribution) in container pixels: labels keep off them. */
function controlBoxes(container: HTMLElement): Box[] {
  const origin = container.getBoundingClientRect();
  return [...container.querySelectorAll<HTMLElement>('.leaflet-control')].map((control) => {
    const rect = control.getBoundingClientRect();
    return {
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      right: rect.right - origin.left,
      bottom: rect.bottom - origin.top,
    };
  });
}

/**
 * Markers with labels placed in screen space (round 4, point 8): re-laid out
 * on zoom/move/resize so close markers (Reggio: station and campus) never get
 * overlapping labels; a label with no free side becomes a hover/tap tooltip.
 */
function RouteMarkers({ points }: { points: RoutePoint[] }) {
  const map = useMap();
  const [placements, setPlacements] = useState<LabelPlacement[] | null>(null);
  const [mapWidth, setMapWidth] = useState(() => map.getSize().x);
  const relayout = useCallback(() => {
    const size = map.getSize();
    if (!size.x || !size.y) return;
    setMapWidth(size.x);
    const anchors = points.map((point) => {
      const pixel = map.latLngToContainerPoint(point.position);
      return {
        x: pixel.x,
        y: pixel.y,
        radius: markerRadius(point),
        preferred: point.labelSide,
        ...labelSize(mapLabel(point, size.x)),
      };
    });
    const blocked = controlBoxes(map.getContainer());
    setPlacements(layoutLabels(anchors, { width: size.x, height: size.y, blocked }));
  }, [map, points]);
  useEffect(() => {
    // After the frame: markers and fitBounds have settled.
    const frame = requestAnimationFrame(relayout);
    return () => cancelAnimationFrame(frame);
  }, [relayout]);
  useMapEvents({ zoomend: relayout, moveend: relayout, resize: relayout });

  // SVG paints in order: big markers (home, campus) first, so a station
  // marker a few hundred metres away stays visible on top at low zoom.
  const paintOrder = points
    .map((point, index) => ({ point, index }))
    .sort((a, b) => markerRadius(b.point) - markerRadius(a.point));
  return paintOrder.map(({ point, index }) => {
    const placement: LabelPlacement = placements?.[index] ?? {
      side: point.labelSide,
      permanent: true,
      shift: [0, 0],
    };
    const shifted = placement.shift[0] !== 0 || placement.shift[1] !== 0;
    return (
      <CircleMarker
        // Remount when the side changes: Leaflet reads tooltip options once.
        key={`${point.role}-${placement.side}-${placement.permanent}-${placement.shift.join(',')}`}
        center={point.position}
        radius={markerRadius(point)}
        pathOptions={{
          color: '#ffffff',
          weight: 2,
          fillColor: ROLE_COLORS[point.role],
          fillOpacity: 1,
        }}
      >
        {/* Permanent labels, readable without hovering (touch); a crowded label
            opens on hover or tap instead of covering another one. */}
        <Tooltip
          permanent={placement.permanent}
          direction={placement.side}
          offset={tooltipOffset(placement.side, placement.shift)}
          // A label slid to stay inside the map hides its tip (it would point aside).
          className={shifted ? 'map-label map-label--shifted' : 'map-label'}
        >
          {mapLabel(point, mapWidth)}
        </Tooltip>
      </CircleMarker>
    );
  });
}

function FitAndResize({ positions, labelBelow }: { positions: LatLon[]; labelBelow: boolean }) {
  const map = useMap();
  useEffect(() => {
    // The container may get its final size after mount (lazy load, layout shifts).
    map.invalidateSize();
    if (positions.length > 1) {
      // Labels are centred on the markers: keep room for half a label on each side.
      const side = Math.min(110, Math.round(map.getSize().x * 0.28));
      map.fitBounds(positions, {
        paddingTopLeft: [side, 40],
        paddingBottomRight: [side, labelBelow ? 44 : 24],
        maxZoom: 15,
      });
    } else if (positions.length === 1) map.setView(positions[0], 14);
  }, [map, positions, labelBelow]);
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
