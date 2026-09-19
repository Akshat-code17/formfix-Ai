import { z } from 'zod';
import { SourceRefSchema } from './core.js';

/**
 * `error`        — a deterministic check the saved answer fails.
 * `warning`      — worth looking at, does not block.
 * `manual_review`— the checks cannot decide; a person must.
 */
export const IssueSeveritySchema = z.enum(['error', 'warning', 'manual_review']);
export type IssueSeverity = z.infer<typeof IssueSeveritySchema>;

export const ValidationIssueSchema = z.object({
  id: z.string().min(1),
  severity: IssueSeveritySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  fieldId: z.string().optional(),
  requirementId: z.string().optional(),
  sources: z.array(SourceRefSchema),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

export const ValidationCountsSchema = z.object({
  errors: z.number().int().min(0),
  warnings: z.number().int().min(0),
  manualReviews: z.number().int().min(0),
  checklistGaps: z.number().int().min(0),
});
export type ValidationCounts = z.infer<typeof ValidationCountsSchema>;

export const ValidationReportSchema = z.object({
  /** The session revision these results describe. Stale if it no longer matches. */
  revision: z.number().int().min(0),
  checkedAt: z.string(),
  issues: z.array(ValidationIssueSchema),
  counts: ValidationCountsSchema,
});
export type ValidationReport = z.infer<typeof ValidationReportSchema>;

/** A checklist gap is any issue attached to a document requirement. */
export function isChecklistGap(issue: ValidationIssue): boolean {
  return Boolean(issue.requirementId);
}
