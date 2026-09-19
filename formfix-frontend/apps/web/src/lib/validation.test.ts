import {
  demoCorrectedAnswers,
  demoCorrectedReadiness,
  demoFormModel,
  demoSeededAnswers,
  demoSeededReadiness,
  validateDemoForm,
} from '@formfix/fixtures-demo';
import { describe, expect, it } from 'vitest';

const run = (
  answers: typeof demoSeededAnswers,
  readiness: typeof demoSeededReadiness,
) => validateDemoForm(demoFormModel, answers, readiness, 1);

describe('the demo form check', () => {
  it('finds exactly the three seeded mistakes, and nothing else', () => {
    const report = run(demoSeededAnswers, demoSeededReadiness);

    expect(report.counts.errors).toBe(2);
    expect(report.counts.checklistGaps).toBe(1);
    expect(report.counts.warnings).toBe(0);

    expect(report.issues.map((i) => i.code).sort()).toEqual([
      'document_not_ready',
      'pin_not_six_digits',
      'required_missing',
      'required_status_unknown',
    ]);
  });

  it('says how many characters the PIN actually had', () => {
    const report = run(demoSeededAnswers, demoSeededReadiness);
    const pin = report.issues.find((i) => i.code === 'pin_not_six_digits');
    expect(pin?.message).toContain('six-digit');
    expect(pin?.message).toContain('5 characters');
    expect(pin?.fieldId).toBe('fld-pin');
  });

  it('clears the errors once the three are corrected', () => {
    const report = run(demoCorrectedAnswers, demoCorrectedReadiness);

    expect(report.counts.errors).toBe(0);
    expect(report.counts.checklistGaps).toBe(0);

    // A clean deterministic run still leaves the item no rule can settle.
    expect(report.counts.manualReviews).toBe(1);
    expect(report.issues[0]?.code).toBe('required_status_unknown');
  });

  it('keeps leading zeros on identifiers rather than failing them', () => {
    const report = run(demoCorrectedAnswers, demoCorrectedReadiness);
    expect(demoCorrectedAnswers['fld-enrolment-no']?.value).toBe('007412580');
    expect(report.issues.some((i) => i.code === 'enrolment_not_nine_digits')).toBe(false);
  });

  it('fails the declaration when the box is left unticked, which is not the same as untouched', () => {
    const unticked = run(
      { ...demoCorrectedAnswers, 'fld-declaration': { value: false, skipped: false, updatedAt: '' } },
      demoCorrectedReadiness,
    );
    expect(unticked.issues.some((i) => i.code === 'declaration_not_ticked')).toBe(true);
  });

  it('asks the bank passbook only when travel or equipment support is chosen', () => {
    const travel = run(
      { ...demoCorrectedAnswers, 'fld-support-type': { value: 'travel', skipped: false, updatedAt: '' } },
      demoCorrectedReadiness,
    );
    expect(travel.issues.some((i) => i.requirementId === 'doc-bank')).toBe(true);

    const tuition = run(demoCorrectedAnswers, demoCorrectedReadiness);
    expect(tuition.issues.some((i) => i.requirementId === 'doc-bank')).toBe(false);
  });

  it('warns rather than errors on a malformed optional email', () => {
    const report = run(
      { ...demoCorrectedAnswers, 'fld-email': { value: 'not-an-address', skipped: false, updatedAt: '' } },
      demoCorrectedReadiness,
    );
    const email = report.issues.find((i) => i.fieldId === 'fld-email');
    expect(email?.severity).toBe('warning');
    expect(report.counts.errors).toBe(0);
  });

  it('carries a source citation on every issue it can attribute', () => {
    const report = run(demoSeededAnswers, demoSeededReadiness);
    for (const issue of report.issues) {
      expect(issue.sources.length).toBeGreaterThan(0);
      expect(issue.sources[0]?.page).toBeGreaterThanOrEqual(1);
    }
  });
});
