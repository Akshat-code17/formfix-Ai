import { describe, expect, it } from 'vitest';
import { Backend as B } from '@formfix/contracts';
import * as bridge from './backend-adapter';
const capabilities = { typedAnswers: true, groundedChat: true, deterministicValidation: true,
  jsonExport: true, officialPdfFilling: false, autoSubmission: false, documentVerification: false,
  mode: 'fixture', templateVerified: true };
const state = { form: { schemaVersion: '1.0', formId: 'test', templateId: 'ff-demo-2026-v1',
  title: 'Demo', pageCount: 6, sections: [{ id: 's', title: 'Study' }], fields: [{ id: 'id',
    sectionId: 's', labelOriginal: 'Number', type: 'text', requiredStatus: 'conditional',
    sources: [{ id: 'source', page: 2, quote: 'Printed rule' }], ruleIds: [] }],
  documentRequirements: [], extractionWarnings: [] }, language: 'en', revision: 2,
  answers: { id: '000042' }, answerSkipped: { id: true }, documentReadiness: {},
  updatedAt: '2026-09-18T00:00:00.000Z', expiresAt: '2026-09-19T00:00:00.000Z', capabilities };
describe('the real backend bridge', () => {
  it('preserves identifiers, skip metadata and canonical evidence; missing conditions stay uncertain', () => {
    const s = bridge.stateFromBackend(state);
    expect(s.answers.id?.value).toBe('000042');
    expect(s.answers.id?.skipped).toBe(true);
    expect(s.form.fields[0]?.requiredStatus).toBe('unknown');
    expect(s.form.fields[0]?.sources).toEqual(state.form.fields[0]?.sources);
    expect(s.form.sections[0]?.pageStart).toBe(2);
  });
  it('rejects malformed responses instead of substituting fixtures', () => {
    expect(() => bridge.stateFromBackend({ ...state, revision: -1 })).toThrow();
    expect(() => bridge.configFromBackend({})).toThrow();
  });
  it('sends typed values and self-reported readiness without lossy coercion', () => {
    expect(bridge.answersToBackend(2, [{ fieldId: 'id', value: '000042', skipped: true }]))
      .toEqual({ baseRevision: 2, changes: { id: '000042' }, skipped: { id: true } });
    expect(bridge.documentsToBackend(2, [{ requirementId: 'doc', ready: false }]).changes.doc).toBe('not_ready');
    expect(() => bridge.answersToBackend(2, [{ fieldId: 'id', value: ['a'] }])).toThrow();
  });
  it('preserves the actual fallback language', () => {
    const e = bridge.explanationFromBackend({ fieldId: 'id', language: 'en', meaning: 'Meaning',
      whatToEnter: 'Text', sources: [], needsReview: true,
      fallback: { requestedLanguage: 'te', reason: 'translation_unavailable' } });
    expect(e.language).toBe('en');
    expect(e.fallback?.requestedLanguage).toBe('te');
  });
  it('does not turn an unsupported template into a processing failure', () => {
    expect(bridge.jobFromBackend({ status: 'needs_review', stage: 'complete', formId: 'test' }, 'job'))
      .toEqual({ jobId: 'job', status: 'needs_review', stage: 'ready', formId: 'test' });
  });
  it('exports only selected answers and states whether validation is current', () => {
    const e = bridge.exportFromBackend(B.ExportSummary.parse({ kind: 'review_summary_not_official_form',
      exportedAt: state.updatedAt, state, latestValidation: null, validationCurrent: false,
      unresolvedChecks: [], notes: ['Validation is absent.'] }), []);
    expect(e.answers).toEqual([]);
    expect(e.validationCurrent).toBe(false);
    expect(e.templateId).toBe('ff-demo-2026-v1');
    expect(JSON.stringify(e)).not.toContain('000042');
  });
});
