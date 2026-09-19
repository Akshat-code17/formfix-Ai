import {
  evaluateCondition,
  isAnswered,
  isRequiredNow,
  type Answer,
  type DocumentReadiness,
  type Field,
  type FormModel,
} from '@formfix/contracts';

export type Progress = {
  /** Every field, whether or not it is required. */
  answeredTotal: number;
  fieldsTotal: number;
  /** Required fields only — optional and unresolved ones are excluded. */
  requiredAnswered: number;
  requiredTotal: number;
  /** Fields whose requirement cannot be settled yet. Shown separately. */
  unresolvedCount: number;
  skippedCount: number;
};

/**
 * Completion, which is not the same thing as validity. "10 of 14 answered"
 * says nothing about whether those ten answers pass the form's own rules,
 * so the two numbers are always reported apart.
 */
export function computeProgress(
  form: FormModel,
  answers: Record<string, Answer | undefined>,
): Progress {
  let answeredTotal = 0;
  let requiredAnswered = 0;
  let requiredTotal = 0;
  let unresolvedCount = 0;
  let skippedCount = 0;

  for (const field of form.fields) {
    const answer = answers[field.id];
    const answered = isAnswered(answer);
    if (answered) answeredTotal += 1;
    if (answer?.skipped) skippedCount += 1;

    const requirement = isRequiredNow(field, answers);
    if (requirement === 'yes') {
      requiredTotal += 1;
      if (answered) requiredAnswered += 1;
    } else if (requirement === 'unresolved') {
      unresolvedCount += 1;
    }
  }

  return {
    answeredTotal,
    fieldsTotal: form.fields.length,
    requiredAnswered,
    requiredTotal,
    unresolvedCount,
    skippedCount,
  };
}

export type RequirementState = 'applies' | 'not_applicable' | 'unresolved';

export function requirementApplies(
  requirement: FormModel['documentRequirements'][number],
  answers: Record<string, Answer | undefined>,
): RequirementState {
  if (requirement.requiredStatus === 'optional') return 'applies';
  if (requirement.requiredStatus === 'unknown') return 'unresolved';
  if (requirement.requiredStatus === 'required') return 'applies';
  const result = evaluateCondition(requirement.condition, answers);
  return result === 'yes' ? 'applies' : result === 'no' ? 'not_applicable' : 'unresolved';
}

export function checklistProgress(
  form: FormModel,
  answers: Record<string, Answer | undefined>,
  readiness: Record<string, DocumentReadiness | undefined>,
) {
  const applicable = form.documentRequirements.filter(
    (r) => requirementApplies(r, answers) === 'applies',
  );
  const ready = applicable.filter((r) => readiness[r.id]?.ready).length;
  const unresolved = form.documentRequirements.filter(
    (r) => requirementApplies(r, answers) === 'unresolved',
  ).length;
  return { ready, total: applicable.length, unresolved };
}

/** Fields in reading order, grouped by section. */
export function fieldsBySection(form: FormModel): { section: FormModel['sections'][number]; fields: Field[] }[] {
  return [...form.sections]
    .sort((a, b) => a.order - b.order)
    .map((section) => ({
      section,
      fields: form.fields
        .filter((f) => f.sectionId === section.id)
        .sort((a, b) => a.order - b.order),
    }));
}

export function orderedFields(form: FormModel): Field[] {
  return [...form.fields].sort((a, b) => a.order - b.order);
}
