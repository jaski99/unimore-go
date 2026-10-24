import { describe, expect, it } from 'vitest';
import {
  EDGE,
  LABEL_GAP,
  labelBox,
  layoutLabels,
  overlaps,
  shiftInside,
  slidesInside,
  tooltipOffset,
  type LabelAnchor,
} from './label-layout';

const frame = { width: 600, height: 400 };
const anchor = (x: number, y: number, preferred: 'top' | 'bottom' = 'top'): LabelAnchor => ({
  x,
  y,
  radius: 9,
  width: 160,
  height: 20,
  preferred,
});

describe('label layout', () => {
  it('etichette lontane: resta il lato preferito', () => {
    expect(layoutLabels([anchor(100, 300), anchor(500, 100, 'bottom')], frame)).toEqual([
      { side: 'top', permanent: true, shift: [0, 0] },
      { side: 'bottom', permanent: true, shift: [0, 0] },
    ]);
  });

  it('Reggio: stazione e sede vicine non si sovrappongono (B5 round 4)', () => {
    // Same latitude band, 60 px apart: both "top" labels would overlap.
    const anchors = [anchor(300, 200), anchor(360, 205)];
    const result = layoutLabels(anchors, frame);
    expect(result.every((placement) => placement.permanent)).toBe(true);
    const [a, b] = result.map((placement, index) =>
      labelBox(anchors[index], placement.side, placement.shift),
    );
    expect(overlaps(a, b)).toBe(false);
    expect(result[0].side).toBe('top');
    expect(result[1].side).not.toBe('top');
  });

  it('un’etichetta non copre mai un altro marker', () => {
    // The second marker sits right where the first label would go.
    const anchors = [anchor(300, 200), anchor(300, 200 - LABEL_GAP - 10)];
    const [first] = layoutLabels(anchors, frame);
    expect(first.side).not.toBe('top');
  });

  it('vicino al bordo sceglie un lato dentro la mappa', () => {
    const [placement] = layoutLabels([anchor(300, 10)], frame);
    expect(placement).toEqual({ side: 'bottom', permanent: true, shift: [0, 0] });
    const [left] = layoutLabels([{ ...anchor(590, 200), width: 80 }], {
      width: 600,
      height: 400,
    });
    expect(['top', 'bottom', 'left']).toContain(left.side);
  });

  it('senza lati liberi diventa un tooltip al passaggio o al tocco', () => {
    // Five markers on the same point: four sides only, the fifth label has none.
    const crowd = Array.from({ length: 5 }, () => anchor(300, 200));
    const result = layoutLabels(crowd, frame);
    expect(result.slice(0, 4).map((placement) => placement.side)).toEqual([
      'top',
      'bottom',
      'right',
      'left',
    ]);
    expect(result[4]).toEqual({ side: 'top', permanent: false, shift: [0, 0] });
  });

  it('offset dei tooltip coerenti con il lato e lo scorrimento', () => {
    expect(tooltipOffset('top')).toEqual([0, -8]);
    expect(tooltipOffset('bottom')).toEqual([0, 8]);
    expect(tooltipOffset('right')).toEqual([8, 0]);
    expect(tooltipOffset('left')).toEqual([-8, 0]);
    expect(tooltipOffset('top', [12, 0])).toEqual([12, -8]);
  });
});

describe('label layout su schermi stretti (round 5, punto 2)', () => {
  // Mobile map 356 px wide (iPhone 12): "Stazione partenza · Reggio Emilia FS" is about 214 px.
  const phone = { width: 356, height: 258 };
  const reggio: LabelAnchor = {
    x: 100,
    y: 108,
    radius: 7,
    width: 214,
    height: 20,
    preferred: 'top',
  };
  const inside = (b: ReturnType<typeof labelBox>, f: { width: number; height: number }) =>
    b.left >= EDGE && b.top >= EDGE && b.right <= f.width - EDGE && b.bottom <= f.height - EDGE;

  it('etichetta vicino al bordo sinistro: scorre verso destra e resta dentro la mappa', () => {
    const [placement] = layoutLabels([reggio], phone);
    expect(placement.permanent).toBe(true);
    expect(placement.side).toBe('top');
    expect(placement.shift[0]).toBeGreaterThan(0);
    const placed = labelBox(reggio, placement.side, placement.shift);
    expect(inside(placed, phone)).toBe(true);
    // The marker is still under the label.
    expect(placed.left).toBeLessThan(reggio.x);
    expect(placed.right).toBeGreaterThan(reggio.x);
  });

  it('etichetta vicino al bordo destro: scorre verso sinistra', () => {
    const modena = { ...reggio, x: 330, width: 170 };
    expect(shiftInside(modena, 'top', phone)?.[0]).toBeLessThan(0);
    const [placement] = layoutLabels([modena], phone);
    expect(inside(labelBox(modena, placement.side, placement.shift), phone)).toBe(true);
  });

  it('non copre i controlli della mappa (zoom)', () => {
    const zoom = { left: 10, top: 10, right: 44, bottom: 84 };
    const [placement] = layoutLabels([reggio], { ...phone, blocked: [zoom] });
    expect(placement.permanent).toBe(true);
    expect(overlaps(labelBox(reggio, placement.side, placement.shift), zoom)).toBe(false);
  });

  it('mai fuori dalla mappa: senza spazio diventa un tooltip al tocco', () => {
    const tooWide = { ...reggio, x: 178, width: 400 };
    expect(shiftInside(tooWide, 'top', phone)).toBeNull();
    expect(layoutLabels([tooWide], phone)[0]).toEqual({
      side: 'top',
      permanent: false,
      shift: [0, 0],
    });
  });

  it('Rubiera → DIEF: scorre di poco per non toccare l’etichetta vicina invece di sparire', () => {
    // Measured at 390 px: "Partenza · Rubiera" placed first, "Arrivo · Modena FS" next to it,
    // DIEF just below Modena FS and the right edge close by.
    const rubiera: LabelAnchor = {
      x: 117,
      y: 112,
      radius: 7,
      width: 125,
      height: 20,
      preferred: 'top',
    };
    const modena: LabelAnchor = {
      x: 227,
      y: 114,
      radius: 7,
      width: 135,
      height: 20,
      preferred: 'top',
    };
    const dief: LabelAnchor = {
      x: 240,
      y: 139,
      radius: 9,
      width: 90,
      height: 20,
      preferred: 'bottom',
    };
    const anchors = [rubiera, modena, dief];
    const result = layoutLabels(anchors, phone);
    expect(result.every((placement) => placement.permanent)).toBe(true);
    const boxes = result.map((placement, index) =>
      labelBox(anchors[index], placement.side, placement.shift),
    );
    expect(boxes.every((placed) => inside(placed, phone))).toBe(true);
    expect(overlaps(boxes[0], boxes[1]) || overlaps(boxes[1], boxes[2])).toBe(false);
    expect(result[1].side).toBe('top');
    expect(result[1].shift[0]).toBeGreaterThan(0);
    expect(boxes[1].left).toBeLessThan(modena.x);
  });

  it('preferisce lo scorrimento più piccolo', () => {
    const slides = slidesInside(reggio, 'top', phone).map(([dx]) => Math.abs(dx));
    expect(slides).toEqual([...slides].sort((a, b) => a - b));
    expect(slides.every((dx) => dx <= reggio.width / 2)).toBe(true);
  });

  it('non stacca l’etichetta dal marker per farla entrare', () => {
    // Marker 2 px from the edge: the label would have to leave the marker.
    expect(shiftInside({ ...reggio, x: 2 }, 'top', phone)).toBeNull();
  });
});
