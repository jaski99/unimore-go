/**
 * Screen-space placement of the permanent map labels (round 4, point 8;
 * round 5, point 2).
 *
 * Markers that are close on screen (e.g. Reggio Emilia: "Stazione arrivo" and
 * "Sede" a few hundred metres apart) used to get overlapping labels, and on
 * narrow phones a long label next to the map edge was cut. Each label tries
 * its preferred side, then the opposite one, then right and left. On each
 * side the label may slide along its marker (smallest slide first, the
 * marker always stays under the label) to get `EDGE` pixels inside the map
 * and off other labels, markers and map controls.
 * A label with no such side becomes a tooltip shown on hover/tap
 * (`permanent: false`): it is never left hanging out of the map.
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

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Frame {
  width: number;
  height: number;
  /** Areas labels must not cover, e.g. the zoom buttons and the attribution. */
  blocked?: Box[];
}

export type Shift = [number, number];

export interface LabelPlacement {
  side: LabelSide;
  /** False: no free side, show the label as a hover/tap tooltip. */
  permanent: boolean;
  /** Slide (pixels) that keeps the label inside the map; [0, 0] = centred. */
  shift: Shift;
}

/** Distance between marker centre and label edge: tooltip offset (8) + tip (6). */
export const LABEL_GAP = 14;

/** Minimum distance between a label and the map edge. */
export const EDGE = 4;

/** Part of the label that must stay over the marker when it slides. */
const ATTACH = 6;

/** Slide step (pixels) when looking for a free position along the marker. */
const STEP = 4;

/** Leaflet tooltip offset (pixels) for a side and slide; the tip adds the rest of LABEL_GAP. */
export function tooltipOffset(side: LabelSide, shift: Shift = [0, 0]): [number, number] {
  const gap = LABEL_GAP - 6;
  const [dx, dy] = { top: [0, -gap], bottom: [0, gap], left: [-gap, 0], right: [gap, 0] }[side];
  return [dx + shift[0], dy + shift[1]];
}

export function labelBox(anchor: LabelAnchor, side: LabelSide, shift: Shift = [0, 0]): Box {
  const { x, y, width, height } = anchor;
  const [dx, dy] = shift;
  switch (side) {
    case 'top':
      return box(x - width / 2 + dx, y - LABEL_GAP - height + dy, width, height);
    case 'bottom':
      return box(x - width / 2 + dx, y + LABEL_GAP + dy, width, height);
    case 'right':
      return box(x + LABEL_GAP + dx, y - height / 2 + dy, width, height);
    case 'left':
      return box(x - LABEL_GAP - width + dx, y - height / 2 + dy, width, height);
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

/** Slide needed on one axis to keep [start, end] within [EDGE, size - EDGE]. */
function slide(start: number, end: number, size: number): number {
  if (start < EDGE) return EDGE - start;
  if (end > size - EDGE) return size - EDGE - end;
  return 0;
}

/**
 * Slide that keeps the label of `side` inside the frame, or null. Top/bottom
 * labels slide horizontally, left/right labels vertically, and only while
 * the marker stays under the label; the other axis must already fit.
 */
export function shiftInside(anchor: LabelAnchor, side: LabelSide, frame: Frame): Shift | null {
  const centred = labelBox(anchor, side);
  const dx = slide(centred.left, centred.right, frame.width);
  const dy = slide(centred.top, centred.bottom, frame.height);
  const vertical = side === 'top' || side === 'bottom';
  const along = vertical ? dx : dy;
  const across = vertical ? dy : dx;
  const room = (vertical ? anchor.width : anchor.height) / 2 - ATTACH;
  if (across !== 0 || Math.abs(along) > Math.max(room, 0)) return null;
  const shift: Shift = vertical ? [along, 0] : [0, along];
  return insideFrame(labelBox(anchor, side, shift), frame) ? shift : null;
}

function insideFrame(candidate: Box, frame: Frame): boolean {
  return (
    candidate.left >= EDGE - 0.5 &&
    candidate.top >= EDGE - 0.5 &&
    candidate.right <= frame.width - EDGE + 0.5 &&
    candidate.bottom <= frame.height - EDGE + 0.5
  );
}

/**
 * Slides to try on a side, smallest first: centred, the slide that fits the
 * frame, then STEP-pixel slides both ways while the marker stays under the
 * label. Only slides that keep the label inside the frame are returned.
 */
export function slidesInside(anchor: LabelAnchor, side: LabelSide, frame: Frame): Shift[] {
  const vertical = side === 'top' || side === 'bottom';
  const room = Math.max((vertical ? anchor.width : anchor.height) / 2 - ATTACH, 0);
  const amounts = [0];
  for (let step = STEP; step <= room; step += STEP) amounts.push(step, -step);
  const fit = shiftInside(anchor, side, frame);
  if (fit) amounts.push(vertical ? fit[0] : fit[1]);
  const unique = [...new Set(amounts)].sort((a, b) => Math.abs(a) - Math.abs(b));
  return unique
    .map((amount): Shift => (vertical ? [amount, 0] : [0, amount]))
    .filter((shift) => insideFrame(labelBox(anchor, side, shift), frame));
}

function candidates(preferred: 'top' | 'bottom'): LabelSide[] {
  return [preferred, preferred === 'top' ? 'bottom' : 'top', 'right', 'left'];
}

/** One placement per anchor, in input order (earlier anchors win free sides). */
export function layoutLabels(anchors: LabelAnchor[], frame: Frame): LabelPlacement[] {
  const markers = anchors.map(markerBox);
  const placed: Box[] = [];
  const blocked = frame.blocked ?? [];
  return anchors.map((anchor, index) => {
    const obstacles = [...placed, ...blocked, ...markers.filter((_, other) => other !== index)];
    for (const side of candidates(anchor.preferred)) {
      for (const shift of slidesInside(anchor, side, frame)) {
        const candidate = labelBox(anchor, side, shift);
        if (obstacles.some((obstacle) => overlaps(candidate, obstacle))) continue;
        placed.push(candidate);
        return { side, permanent: true, shift };
      }
    }
    return { side: anchor.preferred, permanent: false, shift: [0, 0] };
  });
}
