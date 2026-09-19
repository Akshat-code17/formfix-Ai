import {
  ValidationReport,
  type SessionState,
  type Rule,
  type SourceRef,
} from "../../../../packages/contracts/index.js";
import { rules } from "../services/template.js";
const empty = (x: unknown) =>
  x === null || x === undefined || (typeof x === "string" && x.trim() === "");
export function realDate(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}
const patterns = { six_digits: /^[0-9]{6}$/, support_number: /^SD-[0-9]{6}$/ };
type Check = (
  value: string,
  rule: Rule,
  state: SessionState,
) => string | undefined;
const checks: Record<Rule["kind"], Check> = {
  required: () => undefined,
  options: (v, r) =>
    r.params.options!.includes(v)
      ? undefined
      : "Choose one of the printed options.",
  length: (v, r) =>
    v.length < (r.params.min ?? 0) || v.length > (r.params.max ?? Infinity)
      ? "Value is outside the printed length limits."
      : undefined,
  pattern: (v, r) =>
    patterns[r.params.pattern!].test(v)
      ? undefined
      : "Value does not match the printed format.",
  date: (v, r) =>
    !realDate(v)
      ? "Enter a real calendar date in YYYY-MM-DD format."
      : v < r.params.from! || v > r.params.to!
        ? "Date is outside the printed inclusive range."
        : undefined,
  equals: (v, r, s) =>
    v === s.answers[r.params.otherField!]
      ? undefined
      : "Repeat the referenced identifier exactly, including leading zeros.",
  conditional: () => undefined,
};
export function validate(state: SessionState): ValidationReport {
  const issues: ValidationReport["issues"] = [];
  const add = (
    id: string,
    code: string,
    message: string,
    sources: SourceRef[],
    fieldId?: string,
    requirementId?: string,
    severity: "error" | "manual_review" = "error",
  ) =>
    issues.push({
      id,
      code,
      message,
      sources,
      severity,
      ...(fieldId ? { fieldId } : {}),
      ...(requirementId ? { requirementId } : {}),
    });
  if (!state.capabilities.templateVerified) {
    add(
      "template_review",
      "UNVERIFIED_TEMPLATE",
      "Requirements are unverified; a reviewer must establish applicable rules.",
      [],
      undefined,
      undefined,
      "manual_review",
    );
  } else
    for (const f of state.form.fields) {
      const value = state.answers[f.id];
      for (const r of rules.filter((r) => r.fieldId === f.id)) {
        const c = r.params.condition;
        if (r.kind === "conditional" && c && empty(state.answers[c.fieldId])) {
          add(
            r.id,
            "CONDITION_UNKNOWN",
            "The condition cannot be evaluated until the controlling field is answered.",
            f.sources,
            f.id,
            undefined,
            "manual_review",
          );
          continue;
        }
        if (
          (r.kind === "required" ||
            (r.kind === "conditional" &&
              c &&
              state.answers[c.fieldId] === c.value)) &&
          empty(value)
        ) {
          add(r.id, "REQUIRED", "Enter the required value.", f.sources, f.id);
          continue;
        }
        if (empty(value)) continue;
        const message = checks[r.kind](String(value), r, state);
        if (message) add(r.id, r.kind.toUpperCase(), message, f.sources, f.id);
      }
    }
  for (const d of state.form.documentRequirements) {
    if (
      d.requiredStatus === "unknown" ||
      (d.condition && empty(state.answers[d.condition.fieldId]))
    ) {
      add(
        "document_" + d.id,
        "REQUIREMENT_UNKNOWN",
        "Document requirement needs manual review.",
        d.sources,
        undefined,
        d.id,
        "manual_review",
      );
      continue;
    }
    const needed =
      d.requiredStatus === "required" ||
      (d.condition && state.answers[d.condition.fieldId] === d.condition.value);
    if (needed && state.documentReadiness[d.id] !== "ready")
      add(
        "document_" + d.id,
        "DOCUMENT_NOT_READY",
        "Required document is not self-reported ready. No document was inspected.",
        d.sources,
        undefined,
        d.id,
      );
  }
  return ValidationReport.parse({
    revision: state.revision,
    checkedAt: new Date().toISOString(),
    issues,
    counts: {
      error: issues.filter((i) => i.severity === "error").length,
      warning: issues.filter((i) => i.severity === "warning").length,
      manual_review: issues.filter((i) => i.severity === "manual_review")
        .length,
    },
  });
}
