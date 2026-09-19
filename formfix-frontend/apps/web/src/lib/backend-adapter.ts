/** Explicit, validated bridge between the supplied UI contract and API v1.
 * No fixture answers are substituted here. Canonical values and evidence survive unchanged.
 */
import { z } from 'zod';
import { Backend as B, AppConfigSchema, SessionStateSchema, JobSchema,
  ValidationReportSchema, ExplanationSchema, ExportSummarySchema, type AnswerChange,
  type DocumentChange, type Language } from '@formfix/contracts';

const languages: Language[] = ['en', 'hi', 'te', 'mr'];
function capabilities(c: z.infer<typeof B.Capabilities>) {
  return { explanations: true, chat: c.groundedChat, validation: c.deterministicValidation,
    exportJson: c.jsonExport, documentStream: true, languages };
}
function condition(c: z.infer<typeof B.Condition> | undefined, fields: z.infer<typeof B.Field>[]) {
  return c ? { fieldId: c.fieldId, equalsAny: [String(c.value)],
    describe: `Applies when ${fields.find(f => f.id === c.fieldId)?.labelOriginal ?? c.fieldId} is ${String(c.value)}.` } : undefined;
}
export function configFromBackend(raw: unknown) {
  const c = B.Config.parse(raw);
  return AppConfigSchema.parse({ mode: c.mode === 'fixture' ? 'demo' : 'live',
    limits: { maxFileBytes: c.limits.maxBytes, maxPages: c.limits.maxPages,
      acceptedMimeTypes: ['application/pdf'], sessionTtlMinutes: c.limits.retentionHours * 60 },
    capabilities: capabilities(c.capabilities), supportedLanguages: c.supportedLanguages,
    retentionPolicyUrl: '/retention', sampleFormAvailable: true });
}
export function stateFromBackend(raw: unknown) {
  const s = B.SessionState.parse(raw);
  return SessionStateSchema.parse({ ...s,
    form: { ...s.form, schemaVersion: 1, synthetic: s.form.templateId === 'ff-demo-2026-v1',
      sections: s.form.sections.map((section, order) => {
        const pages = s.form.fields.filter(f => f.sectionId === section.id)
          .flatMap(f => f.inputRegion ? [f.inputRegion.page] : f.sources.map(s => s.page));
        return { id: section.id, titleOriginal: section.title, order,
          pageStart: pages.length ? Math.min(...pages) : 1,
          pageEnd: pages.length ? Math.max(...pages) : s.form.pageCount };
      }),
      fields: s.form.fields.map((f, order) => ({ ...f, order,
        type: f.type === 'boolean' ? 'checkbox' : f.type,
        // Missing conditions stay unresolved; never imply an unconditional rule.
        requiredStatus: f.requiredStatus === 'conditional' && !f.condition ? 'unknown' : f.requiredStatus,
        condition: condition(f.condition, s.form.fields),
        options: f.options?.map(value => ({ value, labelOriginal: value })) })),
      documentRequirements: s.form.documentRequirements.map(r => ({ ...r,
        labelOriginal: r.label, alternatives: [], condition: condition(r.condition, s.form.fields),
        requiredStatus: r.requiredStatus === 'conditional' && !r.condition ? 'unknown' : r.requiredStatus })),
      extractionWarnings: s.form.extractionWarnings.map((message, i) => ({
        id: `warning_${i}`, code: 'extraction_review', message })) },
    answers: Object.fromEntries(Object.entries(s.answers).map(([id, value]) => [id,
      { value, skipped: s.answerSkipped?.[id] ?? false, updatedAt: s.updatedAt }])),
    documentReadiness: Object.fromEntries(Object.entries(s.documentReadiness).map(([id, value]) => [id,
      { ready: value === 'ready', updatedAt: s.updatedAt }])),
    capabilities: capabilities(s.capabilities) });
}
export function jobFromBackend(raw: unknown, jobId: string) {
  const j = B.JobResult.parse(raw);
  const stages = { queued: 'uploaded', extracting: 'extracting', matching: 'structuring',
    complete: 'ready', failed: 'failed' } as const;
  return JobSchema.parse({ ...j, jobId, stage: stages[j.stage] });
}
export function reportFromBackend(raw: unknown) {
  const r = B.ValidationReport.parse(raw);
  return ValidationReportSchema.parse({ ...r, counts: {
    errors: r.counts.error, warnings: r.counts.warning, manualReviews: r.counts.manual_review,
    checklistGaps: r.issues.filter(i => i.requirementId).length } });
}
export function explanationFromBackend(raw: unknown) {
  return ExplanationSchema.parse({ ...B.Explanation.parse(raw), schemaVersion: 1 });
}
export function answersToBackend(baseRevision: number, changes: AnswerChange[]) {
  return B.AnswerPatch.parse({ baseRevision,
    changes: Object.fromEntries(changes.map(c => [c.fieldId, c.value])),
    skipped: Object.fromEntries(changes.map(c => [c.fieldId, c.skipped ?? false])) });
}
export function documentsToBackend(baseRevision: number, changes: DocumentChange[]) {
  return B.DocumentPatch.parse({ baseRevision,
    changes: Object.fromEntries(changes.map(c => [c.requirementId, c.ready ? 'ready' : 'not_ready'])) });
}
export function exportFromBackend(raw: unknown, selectedIds: string[]) {
  const e = B.ExportSummary.parse(raw);
  const s = stateFromBackend(e.state);
  const selected = new Set(selectedIds);
  return ExportSummarySchema.parse({ artifact: 'formfix.review-summary', artifactVersion: 1,
    disclaimer: 'Review summary only. This is not a completed official application or a submission.',
    documentTitle: s.form.title, synthetic: s.form.synthetic, language: s.language,
    reviewedAt: e.exportedAt, templateId: s.form.templateId, schemaVersion: s.form.schemaVersion,
    revision: s.revision, validationCurrent: e.validationCurrent, notes: e.notes,
    unresolvedChecks: e.unresolvedChecks,
    answers: s.form.fields.filter(f => selected.has(f.id)).map(f => ({ fieldId: f.id,
      labelOriginal: f.labelOriginal, requiredStatus: f.requiredStatus, value: s.answers[f.id]?.value ?? null })),
    checklist: s.form.documentRequirements.map(r => ({ requirementId: r.id,
      labelOriginal: r.labelOriginal, requiredStatus: r.requiredStatus,
      selfReportedReady: s.documentReadiness[r.id]?.ready ?? false,
      readiness: e.state.documentReadiness[r.id] ?? 'unknown' })),
    findings: e.latestValidation ? reportFromBackend(e.latestValidation) : null });
}
