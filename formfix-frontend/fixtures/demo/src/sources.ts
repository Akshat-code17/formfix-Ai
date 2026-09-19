import type { BBox, SourceRef } from '@formfix/contracts';
import spec from './document-spec.json' with { type: 'json' };
import regions from './regions.generated.json' with { type: 'json' };

type RegionMap = Record<
  string,
  { page: number; bbox: { x: number; y: number; width: number; height: number } }
>;

const regionMap = regions as RegionMap;

const textMap = new Map<string, { page: number; text: string }>();
for (const page of spec.pages) {
  for (const item of page.items) {
    if ('id' in item && item.id && 'text' in item && typeof item.text === 'string') {
      textMap.set(item.id, { page: page.page, text: item.text });
    }
  }
}

export const DEMO_PAGE_COUNT = spec.pages.length;
export const DEMO_TITLE = spec.title;

/**
 * Build a SourceRef from a block id in the demo document.
 * `withoutBox` deliberately omits the rectangle so the viewer exercises the
 * "navigate to the page and quote the text" path instead of guessing a region.
 */
export function source(
  blockId: string,
  label?: string,
  opts?: { withoutBox?: boolean },
): SourceRef {
  const text = textMap.get(blockId);
  const region = regionMap[blockId];
  if (!text) throw new Error(`No demo document text for block "${blockId}"`);
  if (!region) throw new Error(`No demo document region for block "${blockId}"`);
  return {
    id: blockId,
    page: text.page,
    quote: text.text,
    label,
    ...(opts?.withoutBox ? {} : { bbox: region.bbox }),
  };
}

/** The writing area on the page for a given field, when the form has one. */
export function inputRegion(blockId: string): { page: number; bbox: BBox } {
  const region = regionMap[blockId];
  if (!region) throw new Error(`No demo input region for block "${blockId}"`);
  return { page: region.page, bbox: region.bbox };
}
