/**
 * Renders the synthetic demo form to a PDF and emits the exact normalised
 * regions for every labelled block, so source highlighting in the app is
 * measured from the same layout pass that drew the page — never guessed.
 *
 * Run: npm run build:pdf -w @formfix/fixtures-demo
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const here = dirname(fileURLToPath(import.meta.url));
const specPath = resolve(here, '../src/document-spec.json');
const outPdf = resolve(here, '../assets/sample-form.pdf');
const outRegions = resolve(here, '../src/regions.generated.json');

const spec = JSON.parse(readFileSync(specPath, 'utf8'));

const STYLES = {
  title: { size: 16, bold: true, gapBefore: 0, gapAfter: 8, gray: 0 },
  h2: { size: 12.5, bold: true, gapBefore: 18, gapAfter: 8, gray: 0 },
  label: { size: 11, bold: false, gapBefore: 12, gapAfter: 5, gray: 0 },
  boxes: { size: 11, bold: false, gapBefore: 2, gapAfter: 10, gray: 0 },
  note: { size: 9, bold: false, gapBefore: 6, gapAfter: 8, gray: 0.38 },
  line: { height: 24, gapBefore: 0, gapAfter: 8 },
  box3: { height: 66, gapBefore: 0, gapAfter: 8 },
  rule: { height: 1, gapBefore: 8, gapAfter: 10 },
};

const INK = rgb(0.09, 0.17, 0.23);

function wrap(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const doc = await PDFDocument.create();
doc.setTitle(spec.title);
doc.setSubject('Synthetic demonstration document for the FormFix AI prototype. Not an official form.');
doc.setProducer('FormFix fixtures');
doc.setCreator('FormFix fixtures');

const regular = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const { width: PW, height: PH } = spec.pageSize;
const M = spec.margin;
const CONTENT_W = PW - M * 2;
const TOP_OFFSET = 44; // room for the running header

/** @type {Record<string, {page:number,bbox:{x:number,y:number,width:number,height:number}}>} */
const regions = {};

function record(id, page, xTop, yTop, w, h) {
  regions[id] = {
    page,
    bbox: {
      x: round(xTop / PW),
      y: round(yTop / PH),
      width: round(w / PW),
      height: round(h / PH),
    },
  };
}
const round = (n) => Math.round(n * 100000) / 100000;

for (const pageSpec of spec.pages) {
  const page = doc.addPage([PW, PH]);
  const n = pageSpec.page;

  // Running header: identifies the document as synthetic on every page.
  page.drawText(`${spec.title}`, {
    x: M,
    y: PH - M + 12,
    size: 8,
    font: bold,
    color: rgb(0.45, 0.45, 0.42),
  });
  page.drawText('SYNTHETIC DEMONSTRATION DOCUMENT — NOT AN OFFICIAL SCHEME', {
    x: M,
    y: PH - M,
    size: 7.5,
    font: regular,
    color: rgb(0.64, 0.35, 0),
  });
  page.drawLine({
    start: { x: M, y: PH - M - 8 },
    end: { x: PW - M, y: PH - M - 8 },
    thickness: 0.6,
    color: rgb(0.8, 0.79, 0.75),
  });
  page.drawText(`Page ${n} of ${spec.pages.length}`, {
    x: PW - M - 60,
    y: M - 18,
    size: 8,
    font: regular,
    color: rgb(0.45, 0.45, 0.42),
  });

  let cursor = M + TOP_OFFSET; // distance from the top of the page

  for (const item of pageSpec.items) {
    const style = STYLES[item.style];
    if (!style) throw new Error(`Unknown style: ${item.style}`);
    cursor += style.gapBefore ?? 0;

    if (item.style === 'line' || item.style === 'box3') {
      const h = style.height;
      page.drawRectangle({
        x: M,
        y: PH - cursor - h,
        width: CONTENT_W,
        height: h,
        borderColor: rgb(0.72, 0.71, 0.67),
        borderWidth: 0.8,
        color: rgb(0.985, 0.983, 0.975),
      });
      if (item.id) record(item.id, n, M, cursor, CONTENT_W, h);
      cursor += h + style.gapAfter;
      continue;
    }

    if (item.style === 'rule') {
      page.drawLine({
        start: { x: M, y: PH - cursor },
        end: { x: PW - M, y: PH - cursor },
        thickness: 0.8,
        color: rgb(0.8, 0.79, 0.75),
      });
      cursor += style.height + style.gapAfter;
      continue;
    }

    const font = style.bold ? bold : regular;
    const size = style.size;
    const leading = size * 1.34;
    const lines = wrap(item.text, font, size, CONTENT_W);
    const color = style.gray ? rgb(style.gray, style.gray, style.gray * 0.95) : INK;

    lines.forEach((line, i) => {
      page.drawText(line, {
        x: M,
        y: PH - (cursor + i * leading + size),
        size,
        font,
        color,
      });
    });

    const widest = Math.max(...lines.map((l) => font.widthOfTextAtSize(l, size)));
    const h = lines.length * leading;
    if (item.id) record(item.id, n, M, cursor - 2, Math.min(widest + 6, CONTENT_W), h + 4);
    cursor += h + style.gapAfter;
  }

  if (cursor > PH - M) {
    throw new Error(`Page ${n} overflows: content reaches ${cursor.toFixed(1)}pt of ${PH - M}pt`);
  }
}

const bytes = await doc.save();
writeFileSync(outPdf, bytes);
writeFileSync(outRegions, `${JSON.stringify(regions, null, 2)}\n`);

console.log(`Wrote ${outPdf} (${(bytes.length / 1024).toFixed(1)} KB, ${spec.pages.length} pages)`);
console.log(`Wrote ${outRegions} (${Object.keys(regions).length} regions)`);
