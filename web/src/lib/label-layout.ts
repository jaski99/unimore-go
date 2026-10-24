/**
 * Screen-space placement of the permanent map labels (round 4, point 8).
 *
 * Markers that are close on screen (e.g. Reggio Emilia: "Stazione arrivo" and
 * "Sede" a few hundred metres apart) used to get overlapping labels. Each
 * label tries its preferred side, then the opposite one, then right and left;
 * a side is accepted when the label box stays inside the map and does not
 * cover other labels or markers. A label with no free side becomes a tooltip
 * shown on hover/tap (`permanent: false`) instead of covering another one.
 *
 * Pure geometry in pixels: the map component measures and re-runs it on
 * zoom, move and resize.
 */

export type LabelSide = 'top' | 'bottom' | 'left' | 'right';

export interface LabelAnchor {
  /** Marker centre in container pixels. */
  x: number;
  y: number;
  /** Marker radius in pixels. */
  radius: number;
  /** Measured label size in pixels. */
  width: number;
  height: number;
  preferred: 'top' | 'bottom';
}

export interface Frame {
  width: number;
  height: number;
}

export interface LabelPlacement {
  side: LabelSide;
  /** False: no free side, show the label as a hover/tap tooltip. */
  permanent: boolean;
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Distance between marker centre and label edge: tooltip offset (8) + tip (6). */
export const LABEL_GAP = 14;

/** Leaflet tooltip offset (pixels) for a side; the tip adds the rest of LABEL_GAP. */
export function tooltipOffset(side: LabelSide): [number, number] {
  const gap = LABEL_GAP - 6;
  return { top: [0, -gap], bottom: [0, gap], left: [-gap, 0], right: [gap, 0] }[side] as [
    number,
    number,
  ];
}

export function labelBox(anchor: LabelAnchor, side: LabelSide): Box {
  const { x, y, width, height } = anchor;
  switch (side) {
    case 'top':
      return box(x - width / 2, y - LABEL_GAP - height, width, height);
    case 'bottom':
      return box(x - width / 2, y + LABEL_GAP, width, height);
    case 'right':
      return box(x + LABEL_GAP, y - height / 2, width, height);
    case 'left':
      return box(x - LABEL_GAP - width, y - height / 2, width, height);
  }
}

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function box(left: number, top: number, width: number, height: number): Box {
  return { left, top, right: left + width, bottom: top + height };
}

function markerBox(anchor: LabelAnchor): Box {
  const r = anchor.radius;
  return box(anchor.x - r, anchor.y - r, 2 * r, 2 * r);
}

function inside(candidate: Box, frame: Frame): boolean {
  return (
    candidate.left >= 0 &&
    candidate.top >= 0 &&
    candidate.right <= frame.width &&
    candidate.bottom <= frame.height
  );
}

function candidates(preferred: 'top' | 'bottom'): LabelSide[] {
  return [preferred, preferred === 'top' ? 'bottom' : 'top', 'right', 'left'];
}

/** One placement per anchor, in input order (earlier anchors win free sides). */
export function layoutLabels(anchors: LabelAnchor[], frame: Frame): LabelPlacement[] {
  const markers = anchors.map(markerBox);
  const placed: Box[] = [];
  return anchors.map((anchor, index) => {
    const obstacles = [...placed, ...markers.filter((_, other) => other !== index)];
    const free = (side: LabelSide) => {
      const candidate = labelBox(anchor, side);
      return !obstacles.some((obstacle) => overlaps(candidate, obstacle)) ? candidate : null;
    };
    const order = candidates(anchor.preferred);
    // Prefer a side fully inside the map; then any free side (the map can be panned).
    const side =
      order.find((option) => {
        const candidate = free(option);
        return candidate !== null && inside(candidate, frame);
      }) ?? order.find((option) => free(option) !== null);
    if (!side) return { side: anchor.preferred, permanent: false };
    placed.push(labelBox(anchor, side));
    return { side, permanent: true };
  });
}
