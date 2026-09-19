// Generated from formfix-ai/packages/contracts/index.ts; run scripts/sync-backend.mjs.
import { z } from "zod";
export const Id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export const Iso = z.string().datetime();
export const Language = z.enum(["en", "hi", "te", "mr"]);
export type Language = z.infer<typeof Language>;
export const Bbox = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1),
  })
  .strict();
export const SourceRef = z
  .object({
    id: Id,
    page: z.number().int().min(1).max(10),
    quote: z.string().min(1).max(4000),
    bbox: Bbox.optional(),
  })
  .strict();
export type SourceRef = z.infer<typeof SourceRef>;
export const Sources = z.array(SourceRef).max(100);
export const Condition = z
  .object({
    fieldId: Id,
    op: z.literal("equals"),
    value: z.union([z.string().max(200), z.boolean()]),
  })
  .strict();
export const RequiredStatus = z.enum([
  "required",
  "optional",
  "conditional",
  "unknown",
]);
export const Field = z
  .object({
    id: Id,
    sectionId: Id,
    labelOriginal: z.string().min(1).max(200),
    type: z.enum(["text", "date", "select", "boolean"]),
    requiredStatus: RequiredStatus,
    sources: Sources,
    inputRegion: z
      .object({ page: z.number().int().min(1).max(10), bbox: Bbox })
      .strict()
      .optional(),
    ruleIds: z.array(Id),
    options: z.array(z.string().max(100)).optional(),
    condition: Condition.optional(),
  })
  .strict();
export type Field = z.infer<typeof Field>;
export const Requirement = z
  .object({
    id: Id,
    label: z.string().max(300),
    requiredStatus: RequiredStatus,
    condition: Condition.optional(),
    sources: Sources,
  })
  .strict();
export const FormModel = z
  .object({
    schemaVersion: z.literal("1.0"),
    formId: Id,
    templateId: Id.optional(),
    title: z.string().max(300),
    pageCount: z.number().int().min(1).max(10),
    sections: z
      .array(z.object({ id: Id, title: z.string().max(200) }).strict())
      .max(30),
    fields: z.array(Field).max(100),
    documentRequirements: z.array(Requirement).max(50),
    extractionWarnings: z.array(z.string().max(500)).max(100),
  })
  .strict();
export type FormModel = z.infer<typeof FormModel>;
export const AnswerValue = z.union([
  z.string().max(2000),
  z.boolean(),
  z.null(),
]);
export const Answers = z.record(Id, AnswerValue);
export const ReadinessValue = z.enum([
  "ready",
  "not_ready",
  "unknown",
  "not_applicable",
]);
export const Readiness = z.record(Id, ReadinessValue);
export const Capabilities = z
  .object({
    typedAnswers: z.boolean(),
    groundedChat: z.boolean(),
    deterministicValidation: z.boolean(),
    jsonExport: z.boolean(),
    officialPdfFilling: z.literal(false),
    autoSubmission: z.literal(false),
    documentVerification: z.literal(false),
    mode: z.enum(["fixture", "live"]),
    templateVerified: z.boolean(),
  })
  .strict();
export const SessionState = z
  .object({
    form: FormModel,
    language: Language,
    revision: z.number().int().nonnegative(),
    answers: Answers,
    answerSkipped: z.record(Id, z.boolean()).optional(),
    documentReadiness: Readiness,
    updatedAt: Iso,
    expiresAt: Iso,
    capabilities: Capabilities,
  })
  .strict();
export type SessionState = z.infer<typeof SessionState>;
export const Fallback = z
  .object({
    requestedLanguage: Language,
    reason: z.literal("translation_unavailable"),
  })
  .strict();
export const Explanation = z
  .object({
    fieldId: Id,
    language: Language,
    meaning: z.string().max(3000),
    whatToEnter: z.string().max(3000),
    example: z.string().max(500).optional(),
    sources: Sources,
    needsReview: z.boolean(),
    fallback: Fallback.optional(),
  })
  .strict();
export type Explanation = z.infer<typeof Explanation>;
export const ChatAnswer = z
  .object({
    status: z.enum(["answered", "not_found", "needs_clarification"]),
    answer: z.string().max(6000),
    language: Language,
    sources: Sources,
    clarificationQuestion: z.string().max(500).optional(),
  })
  .strict();
export type ChatAnswer = z.infer<typeof ChatAnswer>;
export const Issue = z
  .object({
    id: Id,
    severity: z.enum(["error", "warning", "manual_review"]),
    code: Id,
    message: z.string().max(1000),
    fieldId: Id.optional(),
    requirementId: Id.optional(),
    sources: Sources,
  })
  .strict();
export const ValidationReport = z
  .object({
    revision: z.number().int().nonnegative(),
    checkedAt: Iso,
    issues: z.array(Issue),
    counts: z
      .object({
        error: z.number().int().nonnegative(),
        warning: z.number().int().nonnegative(),
        manual_review: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();
export type ValidationReport = z.infer<typeof ValidationReport>;
export const ErrorDetail = z
  .object({
    code: Id,
    message: z.string().max(1000),
    retryable: z.boolean(),
    requestId: Id,
    details: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
  })
  .strict();
export const ApiError = z.object({ error: ErrorDetail }).strict();
export const Revision = z.number().int().nonnegative();
export const AnswerPatch = z
  .object({ baseRevision: Revision, changes: Answers, skipped: z.record(Id, z.boolean()).optional() })
  .strict();
export const DocumentPatch = z
  .object({ baseRevision: Revision, changes: Readiness })
  .strict();
export const Ask = z
  .object({
    question: z.string().trim().min(1).max(1500),
    fieldId: Id.optional(),
    language: Language,
  })
  .strict();
export const LanguageInput = z.object({ language: Language }).strict();
export const ValidateInput = z.object({ revision: Revision }).strict();
export const JobResult = z
  .object({
    status: z.enum(["queued", "running", "ready", "needs_review", "failed"]),
    stage: z.enum(["queued", "extracting", "matching", "complete", "failed"]),
    formId: Id,
    error: ErrorDetail.optional(),
  })
  .strict();
export const AnalyzeResult = z
  .object({ formId: Id, jobId: Id, status: z.literal("queued") })
  .strict();
export const SessionResult = z
  .object({ csrfToken: z.string().min(32), expiresAt: Iso })
  .strict();
export const SavedAnswers = z
  .object({ revision: Revision, answers: Answers })
  .strict();
export const SavedDocuments = z
  .object({ revision: Revision, documentReadiness: Readiness })
  .strict();
export const Config = z
  .object({
    limits: z
      .object({
        maxBytes: z.number().int(),
        maxPages: z.number().int(),
        retentionHours: z.number(),
      })
      .strict(),
    supportedLanguages: z.array(Language),
    capabilities: Capabilities,
    mode: z.enum(["fixture", "live"]),
  })
  .strict();
export const ExportSummary = z
  .object({
    kind: z.literal("review_summary_not_official_form"),
    exportedAt: Iso,
    state: SessionState,
    latestValidation: ValidationReport.nullable(),
    validationCurrent: z.boolean(),
    unresolvedChecks: z.array(Issue),
    notes: z.array(z.string()),
  })
  .strict();
export const Block = SourceRef.extend({
  origin: z.enum(["native", "tesseract"]),
  ocrConfidence: z.number().min(0).max(100).nullable(),
}).strict();
export const Extraction = z
  .object({
    pages: z
      .array(
        z
          .object({
            page: z.number().int().min(1).max(10),
            width: z.number().positive(),
            height: z.number().positive(),
            rotation: z.union([
              z.literal(0),
              z.literal(90),
              z.literal(180),
              z.literal(270),
            ]),
            transform: z.array(z.number()).length(6),
            origin: z.enum(["native", "tesseract"]),
          })
          .strict(),
      )
      .min(1)
      .max(10),
    blocks: z.array(Block).max(20000),
    acroFields: z
      .array(
        z
          .object({ name: z.string().max(200), type: z.string().max(100) })
          .strict(),
      )
      .max(100),
    warnings: z.array(z.string().max(500)).max(100),
  })
  .strict();
export type Extraction = z.infer<typeof Extraction>;
export const ProposedStructure = z
  .object({
    sections: z
      .array(z.object({ id: Id, title: z.string().max(200) }).strict())
      .max(30),
    fields: z
      .array(
        z
          .object({
            id: Id,
            sectionId: Id,
            labelOriginal: z.string().max(200),
            type: z.enum(["text", "date", "select", "boolean"]),
            requiredStatus: RequiredStatus,
            sourceIds: z.array(Id).min(1),
            options: z.array(z.string().max(100)).optional(),
          })
          .strict(),
      )
      .max(100),
    requirements: z
      .array(
        z
          .object({
            id: Id,
            label: z.string().max(300),
            requiredStatus: RequiredStatus,
            sourceIds: z.array(Id).min(1),
          })
          .strict(),
      )
      .max(50),
    ambiguities: z.array(z.string().max(500)).max(50),
    candidateConstraints: z
      .array(
        z
          .object({
            description: z.string().max(500),
            sourceIds: z.array(Id).min(1),
            verified: z.literal(false),
          })
          .strict(),
      )
      .max(100),
  })
  .strict();
export const ExplanationWire = Explanation.omit({
  sources: true,
  fallback: true,
})
  .extend({ sourceIds: z.array(Id).min(1) })
  .strict();
export const ChatWire = ChatAnswer.omit({ sources: true })
  .extend({ sourceIds: z.array(Id) })
  .strict();
export const Rule = z
  .object({
    id: Id,
    version: z.literal(1),
    kind: z.enum([
      "required",
      "options",
      "length",
      "pattern",
      "date",
      "equals",
      "conditional",
    ]),
    fieldId: Id,
    params: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
        pattern: z.enum(["six_digits", "support_number"]).optional(),
        options: z.array(z.string()).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        otherField: Id.optional(),
        condition: Condition.optional(),
      })
      .strict(),
    sourceIds: z.array(Id).min(1),
    provenance: z.literal("template_verified"),
  })
  .strict();
export type Rule = z.infer<typeof Rule>;
