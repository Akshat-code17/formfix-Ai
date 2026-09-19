import fs from "node:fs";
import {
  FormModel,
  Rule,
  type Extraction,
  type SourceRef,
} from "../../../../packages/contracts/index.js";
const data = JSON.parse(
  fs.readFileSync(
    new URL(
      "../../../../fixtures/demo/verified-template.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
export const gold = FormModel.parse(data.model);
export const rules: Rule[] = data.rules.map((r: unknown) => Rule.parse(r));
type Evidence = {
  id: string;
  page: number;
  quote: string;
  label: string;
  expectedY: number;
};
export const evidence: Evidence[] = data.evidence;
export function ref(b: Extraction["blocks"][number]): SourceRef {
  return {
    id: b.id,
    page: b.page,
    quote: b.quote,
    ...(b.bbox ? { bbox: b.bbox } : {}),
  };
}
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export function matchTemplate(
  ex: Extraction,
  formId: string,
): FormModel | null {
  if (ex.pages.length !== 6) return null;
  const mapped = new Map<string, SourceRef[]>();
  for (const p of ex.pages) {
    if (Math.abs(p.width / p.height - 612 / 792) > 0.03) return null;
    if (
      !ex.blocks.some(
        (b) =>
          b.page === p.page &&
          norm(b.quote).includes(`ff-demo-2026-v1 | page ${p.page} of 6`),
      )
    )
      return null;
  }
  for (const e of evidence) {
    const b = ex.blocks.find(
      (b) =>
        b.page === e.page &&
        norm(b.quote) === norm(e.quote) &&
        b.bbox &&
        Math.abs(b.bbox.y - e.expectedY) < 0.025 &&
        (b.ocrConfidence === null || b.ocrConfidence >= 85),
    );
    const label = ex.blocks.find(
      (b) => b.page === e.page && norm(b.quote) === norm(e.label),
    );
    if (!b || !label) return null;
    mapped.set(e.id, [ref(label), ref(b)]);
  }
  const known = new Set([...mapped.values()].flat().map((s) => s.id));
  // Additional text is allowed only inside known answer boxes or the fixed printed furniture.
  // This prevents a modified copy retaining anchors but adding contradictory rules from being approved.
  for (const b of ex.blocks) {
    if (known.has(b.id)) continue;
    if (
      [
        gold.title,
        "FORMFIX / FICTIONAL PRACTICE FORM",
        "No official affiliation. Use synthetic answers only. Do not submit this form.",
        "DEMO ONLY / Verified fictional instructions v1 / Review summary is not a submission",
        "Document-readiness checklist",
        "Section 1 / Personal details",
        "Section 2 / Study details",
        "Section 3 / Support request",
        "Readiness is self-reported. No attachments, signatures or identities are verified.",
      ].some((t) => norm(t) === norm(b.quote))
    )
      continue;
    if (norm(b.quote) === `ff-demo-2026-v1 | page ${b.page} of 6`) continue;
    if (
      b.bbox &&
      gold.fields.some((f) => {
        const r = f.inputRegion;
        return (
          r &&
          r.page === b.page &&
          b.bbox!.x >= r.bbox.x - 0.005 &&
          b.bbox!.y >= r.bbox.y - 0.005 &&
          b.bbox!.x + b.bbox!.width <= r.bbox.x + r.bbox.width + 0.005 &&
          b.bbox!.y + b.bbox!.height <= r.bbox.y + r.bbox.height + 0.005
        );
      })
    )
      continue;
    return null;
  }
  const model = structuredClone(gold);
  model.formId = formId;
  model.extractionWarnings = [...ex.warnings];
  for (const f of model.fields) {
    f.sources = mapped.get(`rule_${f.id}`)!;
    const condition = rules.find(r => r.fieldId === f.id && r.kind === 'conditional')?.params.condition;
    if (condition) f.condition = condition;
  }
  for (const d of model.documentRequirements)
    d.sources = mapped.get(`doc_${d.id}`)!;
  return FormModel.parse(model);
}
export function unknownForm(ex: Extraction, id: string): FormModel {
  return FormModel.parse({
    schemaVersion: "1.0",
    formId: id,
    title: "Unreviewed uploaded form",
    pageCount: ex.pages.length,
    sections: [],
    fields: [],
    documentRequirements: [],
    extractionWarnings: [
      "Unsupported template: extracted text is available; rules and input mapping require human review.",
      ...ex.warnings,
    ],
  });
}
