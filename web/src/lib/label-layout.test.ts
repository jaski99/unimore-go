import { describe, expect, it } from 'vitest';
import {
  LABEL_GAP,
  labelBox,
  layoutLabels,
  overlaps,
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
      { side: 'top', permanent: true },
      { side: 'bottom', permanent: true },
    ]);
  });

  it('Reggio: stazione e sede vicine non si sovrappongono (B5 round 4)', () => {
    // Same latitude band, 60 px apart: both "top" labels would overlap.
    const anchors = [anchor(300, 200), anchor(360, 205)];
    const result = layoutLabels(anchors, frame);
    expect(result.every((placement) => placement.permanent)).toBe(true);
    const [a, b] = result.map((placement, index) => labelBox(anchors[index], placement.side));
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
    expect(placement).toEqual({ side: 'bottom', permanent: true });
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
    expect(result[4]).toEqual({ side: 'top', permanent: false });
  });

  it('offset dei tooltip coerenti con il lato', () => {
    expect(tooltipOffset('top')).toEqual([0, -8]);
    expect(tooltipOffset('bottom')).toEqual([0, 8]);
    expect(tooltipOffset('right')).toEqual([8, 0]);
    expect(tooltipOffset('left')).toEqual([-8, 0]);
  });
});
