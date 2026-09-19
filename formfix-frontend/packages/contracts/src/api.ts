import { z } from 'zod';
import { LanguageSchema } from './core.js';
import { CapabilitiesSchema, SessionStateSchema } from './session.js';
import { ValidationIssueSchema, ValidationReportSchema } from './validation.js';

export const AppModeSchema = z.enum(['live', 'demo']);
export type AppMode = z.infer<typeof AppModeSchema>;

export const AppConfigSchema = z.object({
  mode: AppModeSchema,
  limits: z.object({
    maxFileBytes: z.number().int().min(1),
    maxPages: z.number().int().min(1),
    acceptedMimeTypes: z.array(z.string().min(1)).min(1),
    sessionTtlMinutes: z.number().int().min(1),
  }),
  supportedLanguages: z.array(LanguageSchema).min(1),
  capabilities: CapabilitiesSchema,
  /** Where the real retention policy lives. Shown, never paraphrased. */
  retentionPolicyUrl: z.string().min(1),
  /** Whether a sample document is available to try without uploading. */
  sampleFormAvailable: z.boolean(),
});
export type AppConfig = z.infer<typeof AppConfigSchema>;

export const CreateSessionResponseSchema = z.object({
  sessionId: z.string().min(1),
  csrfToken: z.string().min(1),
  expiresAt: z.string(),
});
export type CreateSessionResponse = z.infer<typeof CreateSessionResponseSchema>;

export const JobStatusSchema = z.enum(['queued', 'running', 'ready', 'needs_review', 'failed']);
export type JobStatus = z.infer<typeof JobStatusSchema>;

/** Real server stages. The UI shows these, not invented percentages. */
export const JobStageSchema = z.enum(['uploaded', 'extracting', 'structuring', 'ready', 'failed']);
export type JobStage = z.infer<typeof JobStageSchema>;

export const AnalyzeResponseSchema = z.object({
  formId: z.string().min(1),
  jobId: z.string().min(1),
  status: JobStatusSchema,
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    requestId: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const JobSchema = z.object({
  jobId: z.string().min(1),
  status: JobStatusSchema,
  stage: JobStageSchema,
  formId: z.string().min(1),
  error: ApiErrorBodySchema.shape.error.optional(),
});
export type Job = z.infer<typeof JobSchema>;

export const AnswersPatchSchema = z.object({
  baseRevision: z.number().int().min(0),
  changes: z
    .array(
      z.object({
        fieldId: z.string().min(1),
        value: z.union([z.string(), z.array(z.string()), z.boolean(), z.null()]),
        skipped: z.boolean().optional(),
      }),
    )
    .min(1),
});
export type AnswersPatch = z.infer<typeof AnswersPatchSchema>;

export const DocumentsPatchSchema = z.object({
  baseRevision: z.number().int().min(0),
  changes: z
    .array(z.object({ requirementId: z.string().min(1), ready: z.boolean() }))
    .min(1),
});
export type DocumentsPatch = z.infer<typeof DocumentsPatchSchema>;

export const PatchResultSchema = z.object({
  revision: z.number().int().min(0),
  state: SessionStateSchema,
});
export type PatchResult = z.infer<typeof PatchResultSchema>;

export const ValidateRequestSchema = z.object({ revision: z.number().int().min(0) });
export type ValidateRequest = z.infer<typeof ValidateRequestSchema>;

export const ExportSummarySchema = z.object({
  artifact: z.literal('formfix.review-summary'),
  artifactVersion: z.number().int().min(1),
  /** Stated on every export: this is not a completed official application. */
  disclaimer: z.string().min(1),
  documentTitle: z.string().min(1),
  synthetic: z.boolean(),
  language: LanguageSchema,
  reviewedAt: z.string(),
  answers: z.array(
    z.object({
      fieldId: z.string(),
      labelOriginal: z.string(),
      value: z.union([z.string(), z.array(z.string()), z.boolean(), z.null()]),
      requiredStatus: z.string(),
    }),
  ),
  checklist: z.array(
    z.object({
      requirementId: z.string(),
      labelOriginal: z.string(),
      requiredStatus: z.string(),
      selfReportedReady: z.boolean(),
      readiness: z.enum(['ready', 'not_ready', 'unknown', 'not_applicable']).optional(),
    }),
  ),
  findings: ValidationReportSchema.nullable(),
  templateId: z.string().optional(),
  schemaVersion: z.number().int().optional(),
  revision: z.number().int().optional(),
  validationCurrent: z.boolean().optional(),
  unresolvedChecks: z.array(ValidationIssueSchema).optional(),
  notes: z.array(z.string()).optional(),
});
export type ExportSummary = z.infer<typeof ExportSummarySchema>;

/** Error codes the frontend handles by name. */
export const ERROR_CODES = {
  REVISION_CONFLICT: 'revision_conflict',
  SESSION_EXPIRED: 'session_expired',
  UNAUTHORIZED: 'unauthorized',
  FILE_TOO_LARGE: 'file_too_large',
  UNSUPPORTED_TYPE: 'unsupported_type',
  TOO_MANY_PAGES: 'too_many_pages',
  PASSWORD_PROTECTED: 'password_protected',
  UNREADABLE_DOCUMENT: 'unreadable_document',
  UNSUPPORTED_TEMPLATE: 'unsupported_template',
  PROVIDER_UNAVAILABLE: 'provider_unavailable',
  NETWORK: 'network',
  INTERNAL: 'internal',
} as const;
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export const API = {
  config: () => '/api/config',
  sessions: () => '/api/sessions',
  currentSession: () => '/api/sessions/current',
  analyze: () => '/api/forms/analyze',
  job: (jobId: string) => `/api/jobs/${jobId}`,
  form: (formId: string) => `/api/forms/${formId}`,
  document: (formId: string) => `/api/forms/${formId}/document`,
  answers: (formId: string) => `/api/forms/${formId}/answers`,
  documents: (formId: string) => `/api/forms/${formId}/documents`,
  language: (formId: string) => `/api/forms/${formId}/language`,
  explanation: (formId: string, fieldId: string) =>
    `/api/forms/${formId}/fields/${fieldId}/explanation`,
  ask: (formId: string) => `/api/forms/${formId}/ask`,
  validate: (formId: string) => `/api/forms/${formId}/validate`,
  exportSummary: (formId: string) => `/api/forms/${formId}/export`,
} as const;

export const CSRF_HEADER = 'x-formfix-csrf';
