import { createHash } from "node:crypto";
import {
  Explanation,
  ChatAnswer,
  type Language,
  type SessionState,
  type SourceRef,
} from "../../../../packages/contracts/index.js";
import type { AiProvider, Context } from "../providers/ai.js";
import { resolveSources } from "../providers/ai.js";
import type { Store } from "../repositories/store.js";
import { PROMPT_VERSION } from "../providers/prompts/v1.js";
import { AppError } from "../security/errors.js";
export function context(
  state: SessionState,
  fieldId?: string,
  question = "",
): Context {
  const field = fieldId
    ? state.form.fields.find((f) => f.id === fieldId)
    : undefined;
  if (fieldId && !field)
    throw new AppError(404, "FIELD_NOT_FOUND", "Unknown field.");
  const all = [
    ...state.form.fields.flatMap((f) => f.sources),
    ...state.form.documentRequirements.flatMap((d) => d.sources),
  ];
  const words = question
    .toLowerCase()
    .split(/\W+/)
    .filter((x) => x.length > 2);
  const ranked = all
    .map((s) => ({
      s,
      score: words.filter((w) => s.quote.toLowerCase().includes(w)).length,
    }))
    .sort((a, b) => b.score - a.score);
  const matchedFields = state.form.fields.filter((f) =>
    words.some(
      (w) => f.labelOriginal.toLowerCase().includes(w) || f.id.includes(w),
    ),
  );
  const selected = [
    ...(field?.sources ?? []),
    ...matchedFields.flatMap((f) => f.sources),
    ...state.form.documentRequirements.flatMap((d) => d.sources),
    ...ranked
      .filter((x) => x.score > 0)
      .slice(0, 20)
      .map((x) => x.s),
  ];
  return {
    field,
    templateId: state.form.templateId,
    sources: [...new Map(selected.map((s) => [s.id, s])).values()].slice(0, 35),
  };
}
export async function explain(
  store: Store,
  provider: AiProvider,
  state: SessionState,
  fieldId: string,
  language: Language,
) {
  const c = context(state, fieldId);
  const hash = createHash("sha256")
    .update(JSON.stringify(c.sources))
    .digest("hex");
  // Shared cache stores generic responses only; source hash prevents mixing filled/scanned variants.
  const key = [
    state.form.templateId ?? state.form.formId,
    state.form.schemaVersion,
    fieldId,
    language,
    PROMPT_VERSION,
    provider.model,
    hash,
  ].join(":");
  const cache = store.db.collection<{
    _id: string;
    value: Explanation;
    expiresAt: Date;
  }>("explanations");
  const cached = await cache.findOne({
    _id: key,
    expiresAt: { $gt: new Date() },
  });
  if (cached) return Explanation.parse(cached.value);
  let value: Explanation;
  try {
    const { sourceIds, ...wire } = await provider.explainField(c, language);
    value = Explanation.parse({
      ...wire,
      sources: resolveSources(sourceIds, c.sources),
    });
  } catch (e) {
    if (
      language === "en" ||
      (e instanceof AppError &&
        (e.code === "AI_CREDENTIALS" || e.status === 429))
    )
      throw e;
    const { sourceIds, ...wire } = await provider.explainField(c, "en");
    value = Explanation.parse({
      ...wire,
      language: "en",
      sources: resolveSources(sourceIds, c.sources),
      fallback: {
        requestedLanguage: language,
        reason: "translation_unavailable",
      },
    });
  }
  // Only cache the blank, verified fictional template's exact instruction sources. Never unknown or applicant content.
  if (
    state.form.templateId &&
    c.sources.every((s) => !s.quote.includes("\n")) &&
    !value.fallback
  )
    await cache.updateOne(
      { _id: key },
      {
        $set: {
          value,
          expiresAt: new Date(
            Math.min(Date.now() + 86400000, Date.parse(state.expiresAt)),
          ),
        },
      },
      { upsert: true },
    );
  return value;
}
export async function ask(
  provider: AiProvider,
  state: SessionState,
  question: string,
  language: Language,
  fieldId?: string,
) {
  const c = context(state, fieldId, question);
  const { sourceIds, ...wire } = await provider.answerQuestion(
    c,
    question,
    language,
  );
  return ChatAnswer.parse({
    ...wire,
    sources: resolveSources(sourceIds, c.sources),
  });
}
