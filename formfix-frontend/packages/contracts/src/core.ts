import { z } from 'zod';

/** Schema version of the FormModel shape. Bumping invalidates cached explanations. */
export const SCHEMA_VERSION = 1;

export const LanguageSchema = z.enum(['en', 'hi', 'te', 'mr']);
export type Language = z.infer<typeof LanguageSchema>;

export const LANGUAGES: Language[] = ['en', 'hi', 'te', 'mr'];

export const LANGUAGE_LABELS: Record<Language, { native: string; english: string }> = {
  en: { native: 'English', english: 'English' },
  hi: { native: 'हिन्दी', english: 'Hindi' },
  te: { native: 'తెలుగు', english: 'Telugu' },
  mr: { native: 'मराठी', english: 'Marathi' },
};

/**
 * A rectangle on a page, normalised to 0..1 from the TOP-LEFT of the displayed,
 * rotation-normalised page. Renderers multiply by the rendered viewport size.
 */
export const BBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});
export type BBox = z.infer<typeof BBoxSchema>;

/**
 * A citation back into the original document. `page` is ONE-BASED.
 * `bbox` is optional: when the extractor could not locate a region we still
 * carry the page and the quote, and the viewer must not draw a guessed box.
 */
export const SourceRefSchema = z.object({
  id: z.string().min(1),
  page: z.number().int().min(1),
  quote: z.string().min(1),
  bbox: BBoxSchema.optional(),
  /** Optional short human label, e.g. "Address instructions". */
  label: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRefSchema>;

export const FieldTypeSchema = z.enum([
  'text',
  'textarea',
  'date',
  'numeric_string',
  'select',
  'radio',
  'checkbox',
]);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const RequiredStatusSchema = z.enum(['required', 'optional', 'conditional', 'unknown']);
export type RequiredStatus = z.infer<typeof RequiredStatusSchema>;

export const FieldOptionSchema = z.object({
  value: z.string().min(1),
  labelOriginal: z.string().min(1),
});
export type FieldOption = z.infer<typeof FieldOptionSchema>;

export const SectionSchema = z.object({
  id: z.string().min(1),
  titleOriginal: z.string().min(1),
  order: z.number().int().min(0),
  pageStart: z.number().int().min(1),
  pageEnd: z.number().int().min(1),
});
export type Section = z.infer<typeof SectionSchema>;

/**
 * A condition under which a `conditional` field or requirement applies.
 * Deliberately tiny and deterministic — no expression language.
 */
export const ConditionSchema = z.object({
  fieldId: z.string().min(1),
  equalsAny: z.array(z.string().min(1)).min(1),
  /** Plain-language restatement of the condition, shown to the user. */
  describe: z.string().min(1),
});
export type Condition = z.infer<typeof ConditionSchema>;

export const FieldSchema = z.object({
  id: z.string().min(1),
  sectionId: z.string().min(1),
  /** Verbatim label as printed on the form. Never rewritten by translation. */
  labelOriginal: z.string().min(1),
  type: FieldTypeSchema,
  requiredStatus: RequiredStatusSchema,
  sources: z.array(SourceRefSchema),
  /** Where the answer is written on the original page, when known. */
  inputRegion: z
    .object({ page: z.number().int().min(1), bbox: BBoxSchema })
    .optional(),
  ruleIds: z.array(z.string().min(1)),
  options: z.array(FieldOptionSchema).optional(),
  condition: ConditionSchema.optional(),
  order: z.number().int().min(0),
});
export type Field = z.infer<typeof FieldSchema>;

export const DocumentRequirementSchema = z.object({
  id: z.string().min(1),
  labelOriginal: z.string().min(1),
  /** Why the form asks for it, only when the form actually says so. */
  purposeOriginal: z.string().optional(),
  requiredStatus: RequiredStatusSchema,
  /** Alternatives the form explicitly names. Never inferred. */
  alternatives: z.array(z.string().min(1)),
  sources: z.array(SourceRefSchema),
  condition: ConditionSchema.optional(),
  /** Field holding this document's reference number, when the form has one. */
  numberFieldId: z.string().optional(),
});
export type DocumentRequirement = z.infer<typeof DocumentRequirementSchema>;

export const ExtractionWarningSchema = z.object({
  id: z.string().min(1),
  fieldId: z.string().optional(),
  requirementId: z.string().optional(),
  page: z.number().int().min(1).optional(),
  code: z.string().min(1),
  message: z.string().min(1),
});
export type ExtractionWarning = z.infer<typeof ExtractionWarningSchema>;

export const FormModelSchema = z.object({
  schemaVersion: z.number().int().min(1),
  formId: z.string().min(1),
  templateId: z.string().optional(),
  title: z.string().min(1),
  pageCount: z.number().int().min(1),
  sections: z.array(SectionSchema),
  fields: z.array(FieldSchema),
  documentRequirements: z.array(DocumentRequirementSchema),
  extractionWarnings: z.array(ExtractionWarningSchema),
  /** True when the document is synthetic demo material, not a real scheme. */
  synthetic: z.boolean().default(false),
});
export type FormModel = z.infer<typeof FormModelSchema>;
