import { demoFormModel } from '@formfix/fixtures-demo';
import { describe, expect, it } from 'vitest';
import { rotateBox } from './PdfViewer';

const box = { x: 0.1, y: 0.2, width: 0.5, height: 0.05 };
const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-9);

describe('rotateBox', () => {
  it('leaves an unrotated page alone', () => {
    expect(rotateBox(box, 0)).toEqual(box);
  });

  it('swaps the axes at 90 degrees', () => {
    const rotated = rotateBox(box, 90);
    close(rotated.x, 1 - box.y - box.height);
    close(rotated.y, box.x);
    close(rotated.width, box.height);
    close(rotated.height, box.width);
  });

  it('mirrors both axes at 180 degrees', () => {
    const rotated = rotateBox(box, 180);
    close(rotated.x, 1 - box.x - box.width);
    close(rotated.y, 1 - box.y - box.height);
    close(rotated.width, box.width);
    close(rotated.height, box.height);
  });

  it('returns to the original after four quarter turns', () => {
    let current = box;
    for (const step of [90, 180, 270] as const) {
      const once = rotateBox(box, step);
      // Every rotation stays inside the page.
      expect(once.x).toBeGreaterThanOrEqual(0);
      expect(once.y).toBeGreaterThanOrEqual(0);
      expect(once.x + once.width).toBeLessThanOrEqual(1 + 1e-9);
      expect(once.y + once.height).toBeLessThanOrEqual(1 + 1e-9);
    }
    current = rotateBox(rotateBox(rotateBox(rotateBox(box, 90), 90), 90), 90);
    close(current.x, box.x);
    close(current.y, box.y);
    close(current.width, box.width);
    close(current.height, box.height);
  });

  it('keeps every fixture region inside the page at all four rotations', () => {
    const boxes = demoFormModel.fields.flatMap((f) => f.sources).flatMap((s) => (s.bbox ? [s.bbox] : []));
    expect(boxes.length).toBeGreaterThan(10);

    for (const source of boxes) {
      for (const rotation of [0, 90, 180, 270] as const) {
        const rotated = rotateBox(source, rotation);
        expect(rotated.x).toBeGreaterThanOrEqual(-1e-9);
        expect(rotated.y).toBeGreaterThanOrEqual(-1e-9);
        expect(rotated.x + rotated.width).toBeLessThanOrEqual(1 + 1e-9);
        expect(rotated.y + rotated.height).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
});
