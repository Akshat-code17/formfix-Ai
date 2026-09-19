import { z } from 'zod';
import { LanguageSchema, SourceRefSchema } from './core.js';

export const ExplanationSchema = z.object({
  fieldId: z.string().min(1),
  language: LanguageSchema,
  /** "What does this mean?" in plain language. */
  meaning: z.string().min(1),
  /** "What should I enter?" — specific guidance. */
  whatToEnter: z.string().min(1),
  /** A clearly fictional example. Never written into the user's answer. */
  example: z.string().optional(),
  sources: z.array(SourceRefSchema),
  /** The extractor was not confident; a human should look at this. */
  needsReview: z.boolean(),
  schemaVersion: z.number().int().min(1),
  fallback: z.object({ requestedLanguage: LanguageSchema, reason: z.literal('translation_unavailable') }).optional(),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const ChatStatusSchema = z.enum(['answered', 'not_found', 'needs_clarification']);
export type ChatStatus = z.infer<typeof ChatStatusSchema>;

export const ChatAnswerSchema = z.object({
  status: ChatStatusSchema,
  /** Plain text or restricted Markdown. Never raw HTML. */
  answer: z.string().min(1),
  language: LanguageSchema,
  sources: z.array(SourceRefSchema),
  clarificationQuestion: z.string().optional(),
});
export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;

export const AskRequestSchema = z.object({
  question: z.string().min(1).max(1000),
  fieldId: z.string().optional(),
  language: LanguageSchema,
});
export type AskRequest = z.infer<typeof AskRequestSchema>;
