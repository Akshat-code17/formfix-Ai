import type { Answer } from '@formfix/contracts';
import { demoFormModel, demoSeededAnswers, demoSeededReadiness } from '@formfix/fixtures-demo';
import { describe, expect, it } from 'vitest';
import { checklistProgress, computeProgress, requirementApplies } from './progress';

const answer = (value: Answer['value'], skipped = false): Answer => ({
  value,
  skipped,
  updatedAt: '2026-09-18T00:00:00.000Z',
});

describe('computeProgress', () => {
  it('counts answered fields separately from required ones', () => {
    const progress = computeProgress(demoFormModel, demoSeededAnswers);

    // The seeded set fills everything except the document reference number.
    expect(progress.fieldsTotal).toBe(14);
    expect(progress.answeredTotal).toBe(12);

    // "Amount" has an unknown required status, so it is neither counted as
    // required nor quietly assumed optional.
    expect(progress.unresolvedCount).toBe(1);
    expect(progress.requiredTotal).toBe(11);
    expect(progress.requiredAnswered).toBe(10);
  });

  it('treats a ticked-and-unticked checkbox as answered, but an empty field as not', () => {
    const unticked = computeProgress(demoFormModel, {
      ...demoSeededAnswers,
      'fld-declaration': answer(false),
    });
    expect(unticked.answeredTotal).toBe(12);

    const cleared = computeProgress(demoFormModel, {
      ...demoSeededAnswers,
      'fld-declaration': answer(null),
    });
    expect(cleared.answeredTotal).toBe(11);
  });

  it('leaves a conditional field out of the required count until it applies', () => {
    const other = computeProgress(demoFormModel, {
      ...demoSeededAnswers,
      'fld-category': answer('other'),
    });
    // Choosing "Other" makes the follow-up question required.
    expect(other.requiredTotal).toBe(12);

    const undecided = computeProgress(demoFormModel, {
      ...demoSeededAnswers,
      'fld-category': answer(null),
    });
    // With the controlling question unanswered the follow-up is unresolved,
    // so it stays out of the required total (which is back to the base 11)
    // and joins the unresolved count alongside the unknown-status amount.
    expect(undecided.requiredTotal).toBe(11);
    expect(undecided.unresolvedCount).toBe(2);
  });

  it('counts skipped fields without treating them as progress', () => {
    const progress = computeProgress(demoFormModel, {
      ...demoSeededAnswers,
      'fld-city': answer(null, true),
    });
    expect(progress.skippedCount).toBe(1);
    expect(progress.answeredTotal).toBe(11);
  });
});

describe('requirementApplies', () => {
  it('drops the conditional document when the controlling answer rules it out', () => {
    expect(requirementApplies(demoFormModel.documentRequirements[2]!, demoSeededAnswers)).toBe(
      'not_applicable',
    );
  });

  it('brings it back when travel support is chosen', () => {
    const answers = { ...demoSeededAnswers, 'fld-support-type': answer('travel') };
    expect(requirementApplies(demoFormModel.documentRequirements[2]!, answers)).toBe('applies');
  });

  it('reports unresolved while the controlling answer is missing', () => {
    const answers = { ...demoSeededAnswers, 'fld-support-type': answer(null) };
    expect(requirementApplies(demoFormModel.documentRequirements[2]!, answers)).toBe('unresolved');
  });
});

describe('checklistProgress', () => {
  it('excludes documents that do not apply', () => {
    const progress = checklistProgress(demoFormModel, demoSeededAnswers, demoSeededReadiness);
    expect(progress.total).toBe(2);
    expect(progress.ready).toBe(1);
    expect(progress.unresolved).toBe(0);
  });
});
