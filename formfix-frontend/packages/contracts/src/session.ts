import { z } from 'zod';
import { FormModelSchema, LanguageSchema, type Field } from './core.js';

/**
 * The value a user entered. `null` means "no value" and is deliberately
 * distinct from the legitimate values `false` and `"0"`.
 * Identifiers stay strings so leading zeros survive.
 */
export const AnswerValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.boolean(),
  z.null(),
]);
export type AnswerValue = z.infer<typeof AnswerValueSchema>;

export const AnswerSchema = z.object({
  value: AnswerValueSchema,
  /** User pressed "Skip for now". Not an error, but not progress either. */
  skipped: z.boolean().default(false),
  updatedAt: z.string(),
});
export type Answer = z.infer<typeof AnswerSchema>;

export const AnswerChangeSchema = z.object({
  fieldId: z.string().min(1),
  value: AnswerValueSchema,
  skipped: z.boolean().optional(),
});
export type AnswerChange = z.infer<typeof AnswerChangeSchema>;

export const DocumentReadinessSchema = z.object({
  /** Self-reported by the user. This is NOT verification of any document. */
  ready: z.boolean(),
  updatedAt: z.string(),
});
export type DocumentReadiness = z.infer<typeof DocumentReadinessSchema>;

export const DocumentChangeSchema = z.object({
  requirementId: z.string().min(1),
  ready: z.boolean(),
});
export type DocumentChange = z.infer<typeof DocumentChangeSchema>;

/**
 * What this deployment can actually do. The UI must not advertise anything
 * that is false here.
 */
export const CapabilitiesSchema = z.object({
  explanations: z.boolean(),
  chat: z.boolean(),
  validation: z.boolean(),
  exportJson: z.boolean(),
  documentStream: z.boolean(),
  languages: z.array(LanguageSchema).min(1),
});
export type Capabilities = z.infer<typeof CapabilitiesSchema>;

export const SessionStateSchema = z.object({
  form: FormModelSchema,
  language: LanguageSchema,
  /** Monotonic. Every accepted mutation increments it. */
  revision: z.number().int().min(0),
  answers: z.record(z.string(), AnswerSchema),
  documentReadiness: z.record(z.string(), DocumentReadinessSchema),
  updatedAt: z.string(),
  expiresAt: z.string(),
  capabilities: CapabilitiesSchema,
});
export type SessionState = z.infer<typeof SessionStateSchema>;

/** True when the user has actually put something in the field. */
export function isAnswered(answer: import('./session.js').Answer | undefined): boolean {
  if (!answer) return false;
  const v = answer.value;
  if (v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true; // booleans, including false, are real answers
}

/**
 * Whether a `conditional` field or requirement currently applies.
 * Returns 'yes' | 'no' | 'unresolved' — unresolved when the controlling
 * field has not been answered yet.
 */
export function evaluateCondition(
  condition: { fieldId: string; equalsAny: string[] } | undefined,
  answers: Record<string, import('./session.js').Answer | undefined>,
): 'yes' | 'no' | 'unresolved' {
  if (!condition) return 'yes';
  const controller = answers[condition.fieldId];
  if (!isAnswered(controller)) return 'unresolved';
  const v = controller!.value;
  const values = Array.isArray(v) ? v : [String(v)];
  return values.some((x) => condition.equalsAny.includes(x)) ? 'yes' : 'no';
}

/** Does this field count towards "required fields answered"? */
export function isRequiredNow(
  field: Pick<Field, 'requiredStatus' | 'condition'>,
  answers: Record<string, Answer | undefined>,
): 'yes' | 'no' | 'unresolved' {
  if (field.requiredStatus === 'optional') return 'no';
  if (field.requiredStatus === 'unknown') return 'unresolved';
  if (field.requiredStatus === 'required') return 'yes';
  return evaluateCondition(field.condition, answers);
}
