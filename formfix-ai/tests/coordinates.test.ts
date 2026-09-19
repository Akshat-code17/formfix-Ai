import { it, expect } from "vitest";
import fs from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
const cases = JSON.parse(fs.readFileSync("work/coordinates.json", "utf8")) as {
  file: string;
  page: {
    rotation: number;
    width: number;
    height: number;
    transform: number[];
  };
}[];
it.each(cases)(
  "Python coordinates match PDF.js browser-viewer viewport rotation $page.rotation",
  async (item) => {
    const task = getDocument({
      data: new Uint8Array(fs.readFileSync(item.file)),
    });
    const doc = await task.promise;
    const page = await doc.getPage(1),
      viewport = page.getViewport({ scale: 1 });
    expect(viewport.width).toBe(item.page.width);
    expect(viewport.height).toBe(item.page.height);
    viewport.transform.forEach((value: number, i: number) =>
      expect(value).toBeCloseTo(item.page.transform[i], 8),
    );
    const displayed = viewport.convertToViewportPoint(90, 600),
      m = item.page.transform;
    expect(displayed[0]).toBeCloseTo(m[0] * 90 + m[2] * 600 + m[4]);
    expect(displayed[1]).toBeCloseTo(m[1] * 90 + m[3] * 600 + m[5]);
    await task.destroy();
  },
);
