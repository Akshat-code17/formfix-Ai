import {
  evaluateCondition,
  isAnswered,
  type Answer,
  type DocumentReadiness,
  type Field,
  type FormModel,
  type ValidationIssue,
  type ValidationReport,
} from '@formfix/contracts';

type Answers = Record<string, Answer | undefined>;
type Readiness = Record<string, DocumentReadiness | undefined>;

const asText = (a: Answer | undefined): string =>
  typeof a?.value === 'string' ? a.value.trim() : '';

/**
 * Deterministic checks. Every rule is a pure function of the saved state —
 * nothing here calls a model, and nothing here can pass an application.
 * The backend runs the same rule ids against the same field model.
 */
type Rule = (ctx: {
  field: Field;
  answer: Answer | undefined;
  answers: Answers;
}) => Omit<ValidationIssue, 'id' | 'sources'> | null;

const RULES: Record<string, Rule> = {
  'rule-required': ({ field, answer }) =>
    isAnswered(answer)
      ? null
      : {
          severity: 'error',
          code: 'required_missing',
          message: `“${field.labelOriginal}” is marked required on the form and has no answer yet.`,
          fieldId: field.id,
        },

  'rule-conditional-required': ({ field, answer, answers }) => {
    const applies = evaluateCondition(field.condition, answers);
    if (applies === 'no') return null;
    if (applies === 'unresolved') {
      return {
        severity: 'manual_review',
        code: 'condition_unresolved',
        message: `Whether “${field.labelOriginal}” is needed depends on an answer you have not given yet.`,
        fieldId: field.id,
      };
    }
    return isAnswered(answer)
      ? null
      : {
          severity: 'error',
          code: 'required_missing',
          message: `${field.condition?.describe ?? 'This field applies to you'} — it has no answer yet.`,
          fieldId: field.id,
        };
  },

  'rule-pin-6-digits': ({ field, answer }) => {
    const v = asText(answer);
    if (!v) return null;
    return /^[0-9]{6}$/.test(v)
      ? null
      : {
          severity: 'error',
          code: 'pin_not_six_digits',
          message: `The form requires a six-digit PIN code. You entered ${v.length} character${v.length === 1 ? '' : 's'}.`,
          fieldId: field.id,
        };
  },

  'rule-enrolment-9-digits': ({ field, answer }) => {
    const v = asText(answer);
    if (!v) return null;
    return /^[0-9]{9}$/.test(v)
      ? null
      : {
          severity: 'error',
          code: 'enrolment_not_nine_digits',
          message: `The form asks for a nine-digit enrolment number. You entered ${v.length} character${v.length === 1 ? '' : 's'}.`,
          fieldId: field.id,
        };
  },

  'rule-phone-10-digits': ({ field, answer }) => {
    const v = asText(answer);
    if (!v) return null;
    return /^[0-9]{10}$/.test(v)
      ? null
      : {
          severity: 'error',
          code: 'phone_not_ten_digits',
          message: 'The form asks for ten digits without a country code.',
          fieldId: field.id,
        };
  },

  'rule-date-not-future': ({ field, answer }) => {
    const v = asText(answer);
    if (!v) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      return {
        severity: 'error',
        code: 'date_unreadable',
        message: 'This date could not be read. Pick the day, month and year again.',
        fieldId: field.id,
      };
    }
    return new Date(`${v}T00:00:00Z`).getTime() > Date.now()
      ? {
          severity: 'error',
          code: 'date_in_future',
          message: 'A date of birth cannot be in the future.',
          fieldId: field.id,
        }
      : null;
  },

  'rule-email-shape': ({ field, answer }) => {
    const v = asText(answer);
    if (!v) return null;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
      ? null
      : {
          severity: 'warning',
          code: 'email_shape',
          message: 'This does not look like an email address. The form marks this question optional.',
          fieldId: field.id,
        };
  },

  'rule-whole-rupees': ({ field, answer }) => {
    const v = asText(answer);
    if (!v) return null;
    return /^[0-9]+$/.test(v)
      ? null
      : {
          severity: 'error',
          code: 'amount_not_whole_rupees',
          message: 'The form asks for digits only — no commas, decimal point or rupee sign.',
          fieldId: field.id,
        };
  },

  // The form never states whether the amount is compulsory, so no automatic
  // check can settle it. It is surfaced as a decision for the applicant.
  'rule-manual-review-amount': ({ field }) => ({
    severity: 'manual_review',
    code: 'required_status_unknown',
    message:
      'The form does not say whether the amount is compulsory. Decide for yourself whether to leave it blank.',
    fieldId: field.id,
  }),

  'rule-declaration-accepted': ({ field, answer }) =>
    answer?.value === true
      ? null
      : {
          severity: 'error',
          code: 'declaration_not_ticked',
          message: 'The form requires the declaration box to be ticked.',
          fieldId: field.id,
        },
};

export function validateDemoForm(
  form: FormModel,
  answers: Answers,
  readiness: Readiness,
  revision: number,
  now: Date = new Date(),
): ValidationReport {
  const issues: ValidationIssue[] = [];

  for (const field of form.fields) {
    for (const ruleId of field.ruleIds) {
      const rule = RULES[ruleId];
      if (!rule) continue;
      const partial = rule({ field, answer: answers[field.id], answers });
      if (!partial) continue;
      issues.push({
        id: `${field.id}:${ruleId}`,
        sources: field.sources,
        ...partial,
      });
    }
  }

  for (const req of form.documentRequirements) {
    const applies =
      req.requiredStatus === 'optional'
        ? 'no'
        : req.requiredStatus === 'unknown'
          ? 'unresolved'
          : req.requiredStatus === 'required'
            ? 'yes'
            : evaluateCondition(req.condition, answers);

    if (applies === 'no') continue;

    if (applies === 'unresolved') {
      issues.push({
        id: `${req.id}:condition`,
        severity: 'manual_review',
        code: 'requirement_condition_unresolved',
        message: `Whether you need “${req.labelOriginal}” depends on an answer you have not given yet.`,
        requirementId: req.id,
        sources: req.sources,
      });
      continue;
    }

    if (!readiness[req.id]?.ready) {
      issues.push({
        id: `${req.id}:not-ready`,
        severity: 'error',
        code: 'document_not_ready',
        message: `You have not marked “${req.labelOriginal}” as ready. This records what you told us; it is not a check of the document.`,
        requirementId: req.id,
        sources: req.sources,
      });
    }
  }

  const counts = {
    errors: issues.filter((i) => i.severity === 'error' && !i.requirementId).length,
    warnings: issues.filter((i) => i.severity === 'warning').length,
    manualReviews: issues.filter((i) => i.severity === 'manual_review').length,
    checklistGaps: issues.filter((i) => Boolean(i.requirementId) && i.severity === 'error').length,
  };

  return { revision, checkedAt: now.toISOString(), issues, counts };
}
