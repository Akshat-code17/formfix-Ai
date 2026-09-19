import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import fs from "node:fs";
import {
  ExplanationWire,
  ChatWire,
  ProposedStructure,
  type Language,
  type SourceRef,
  type Field,
  type Explanation,
} from "../../../../packages/contracts/index.js";
import { prompts } from "./prompts/v1.js";
import { AppError } from "../security/errors.js";
import type { Settings } from "../config.js";
import { gold, evidence } from "../services/template.js";
export type Context = {
  sources: SourceRef[];
  field?: Field;
  templateId?: string;
  nearbyInstructions?: SourceRef[];
};
export interface AiProvider {
  readonly model: string;
  extractFormStructure(
    context: Context,
    schema: typeof ProposedStructure,
  ): Promise<z.infer<typeof ProposedStructure>>;
  explainField(
    context: Context,
    language: Language,
  ): Promise<z.infer<typeof ExplanationWire>>;
  answerQuestion(
    context: Context,
    question: string,
    language: Language,
  ): Promise<z.infer<typeof ChatWire>>;
  translateExplanation(
    explanation: Explanation,
    targetLanguage: Language,
  ): Promise<z.infer<typeof ExplanationWire>>;
}
export function checkEvidence<T extends { sourceIds: string[] }>(
  wire: T,
  context: Context,
) {
  const ids = new Set(context.sources.map((s) => s.id));
  if (wire.sourceIds.some((id) => !ids.has(id)))
    throw new AppError(
      503,
      "INVALID_CITATION",
      "AI response cited evidence outside the supplied context.",
      true,
    );
  return wire;
}
export function resolveSources(ids: string[], sources: SourceRef[]) {
  return [...new Set(ids)].map((id) => {
    const s = sources.find((s) => s.id === id);
    if (!s)
      throw new AppError(
        503,
        "INVALID_CITATION",
        "AI citation could not be resolved.",
        true,
      );
    return s;
  });
}
export function geminiSchema(schema: z.ZodType): unknown {
  const allowed = new Set([
    "type",
    "format",
    "title",
    "description",
    "enum",
    "items",
    "minItems",
    "maxItems",
    "minimum",
    "maximum",
    "anyOf",
    "oneOf",
    "properties",
    "additionalProperties",
    "required",
  ]);
  function clean(value: any): any {
    if (Array.isArray(value)) return value.map(clean);
    if (!value || typeof value !== "object") return value;
    const result: any = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === "properties") {
        result[k] = Object.fromEntries(
          Object.entries(v as object).map(([name, child]) => [
            name,
            clean(child),
          ]),
        );
      } else if (
        k === "const" &&
        (typeof v === "string" || typeof v === "number")
      )
        result.enum = [v];
      else if (allowed.has(k)) result[k] = clean(v);
    }
    return result;
  }
  // Gemini accepts a JSON Schema subset. Zod enforces omitted string limits/patterns/literals locally.
  return clean(zodToJsonSchema(schema, { $refStrategy: "none" }));
}
const dictionaries = JSON.parse(
  fs.readFileSync(
    new URL("../../../../fixtures/demo/translations.json", import.meta.url),
    "utf8",
  ),
);
const translatedInstructions = JSON.parse(
  fs.readFileSync(
    new URL(
      "../../../../fixtures/demo/instructions-translated.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
export class FixtureProvider implements AiProvider {
  readonly model = "fixture-reviewed-en-draft-translations-v1";
  async extractFormStructure(_c: Context, _s: typeof ProposedStructure) {
    return ProposedStructure.parse({
      sections: [],
      fields: [],
      requirements: [],
      ambiguities: [
        "Offline fixture provider cannot infer unknown form structure.",
      ],
      candidateConstraints: [],
    });
  }
  async explainField(c: Context, l: Language) {
    const f = c.field!;
    if (c.templateId !== gold.templateId)
      throw new AppError(
        503,
        "FIXTURE_UNAVAILABLE",
        "Offline explanations exist only for the verified demo.",
      );
    const t = dictionaries[l];
    const i = gold.fields.findIndex((x) => x.id === f.id);
    return ExplanationWire.parse({
      fieldId: f.id,
      language: l,
      meaning: `${f.labelOriginal}: ${t.intro} ${t.labels[i]}.`,
      whatToEnter:
        l === "en"
          ? evidence.find((e) => e.id === `rule_${f.id}`)!.quote
          : translatedInstructions[l][i],
      sourceIds: f.sources.map((s) => s.id),
      needsReview: l !== "en",
    });
  }
  async answerQuestion(c: Context, q: string, l: Language) {
    const t = dictionaries[l];
    let key: string | undefined;
    let field: string | undefined;
    // Deliberately small, disclosed offline catalogue. Never execute document/question instructions.
    if (
      /(secret|api.?key|ignore|system prompt|password|instruction.*override)/i.test(
        q,
      )
    )
      return ChatWire.parse({
        status: "not_found",
        answer: t.notFound,
        language: l,
        sourceIds: [],
      });
    if (/\bpin\b|पिन|పిన్/i.test(q)) {
      key = "pin";
      field = "pin";
    } else if (
      /supporting.document number|SD-|दस्तावेज़.*संख्या|పత్రం.*సంఖ్య|कागदपत्र.*क्रमांक/i.test(
        q,
      )
    ) {
      key = "support";
      field = "support_number";
    } else if (/travel|यात्रा|ప్రయాణ|प्रवास/i.test(q)) {
      key = "travel";
      field = "travel_reason";
    }
    if (key && c.templateId === gold.templateId) {
      const sources = c.sources.filter((s) =>
        field === "pin"
          ? s.quote.includes("six ASCII digits") && !s.quote.includes("SD-")
          : field === "support_number"
            ? s.quote.includes("SD-") ||
              s.quote.includes("does not establish readiness")
            : s.quote.includes("Required only when Support type is travel"),
      );
      if (sources.length)
        return ChatWire.parse({
          status: "answered",
          answer: t[key],
          language: l,
          sourceIds: sources.map((s) => s.id),
        });
    }
    if (/^(this|that|it|यह|हे|ఇది)[ ?]*$/i.test(q.trim()))
      return ChatWire.parse({
        status: "needs_clarification",
        answer: t.clarify,
        clarificationQuestion: t.clarify,
        language: l,
        sourceIds: [],
      });
    return ChatWire.parse({
      status: "not_found",
      answer: t.notFound,
      language: l,
      sourceIds: [],
    });
  }
  async translateExplanation(e: Explanation, l: Language) {
    const f = gold.fields.find((f) => f.id === e.fieldId)!;
    return this.explainField(
      { field: f, templateId: gold.templateId, sources: e.sources },
      l,
    );
  }
}
export function retryDelay(error: any, attempt: number) {
  const retryInfo = error?.error?.details?.find((d: any) =>
    d["@type"]?.endsWith("RetryInfo"),
  )?.retryDelay;
  const seconds =
    typeof retryInfo === "string" ? Number.parseFloat(retryInfo) : undefined;
  const header = error?.headers?.get?.("retry-after");
  const headerSeconds = header ? Number(header) : undefined;
  return Math.max(
    seconds ? seconds * 1000 : 0,
    headerSeconds
      ? headerSeconds * 1000
      : header
        ? Math.max(0, Date.parse(header) - Date.now())
        : 0,
    300 * 2 ** attempt + Math.random() * 300,
  );
}
export class GeminiProvider implements AiProvider {
  private ai: GoogleGenAI;
  private active = 0;
  readonly model: string;
  constructor(private c: Settings) {
    this.model = c.AI_MODEL;
    this.ai = new GoogleGenAI({
      apiKey: c.GEMINI_API_KEY,
      httpOptions: { timeout: 45000, retryOptions: { attempts: 1 } },
    });
  }
  async probe() {
    await this.ai.models.get({ model: this.model });
  }
  private async invoke<T>(
    op: keyof typeof prompts,
    context: unknown,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const input = JSON.stringify(context);
    if (input.length > 60000)
      throw new AppError(
        422,
        "AI_CONTEXT_LIMIT",
        "AI evidence context exceeds limit.",
      );
    if (this.active >= this.c.AI_CONCURRENCY)
      throw new AppError(
        429,
        "AI_BUSY",
        "AI request concurrency limit reached.",
        true,
      );
    this.active++;
    const started = Date.now();
    try {
      let repair = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await this.ai.models.generateContent({
            model: this.model,
            contents: input,
            config: {
              systemInstruction:
                prompts[op] +
                (repair
                  ? " Previous output was invalid. Re-check all required schema fields and evidence IDs; return one valid JSON object."
                  : ""),
              responseMimeType: "application/json",
              responseJsonSchema: geminiSchema(schema),
              temperature: 0,
              maxOutputTokens: 6000,
              abortSignal: AbortSignal.timeout(
                op === "extract" ? 60000 : 30000,
              ),
            },
          });
          console.info(
            JSON.stringify({
              operation: "ai_" + op,
              ms: Date.now() - started,
              provider: "gemini",
              tokens: response.usageMetadata?.totalTokenCount,
            }),
          );
          try {
            return schema.parse(JSON.parse(response.text ?? ""));
          } catch {
            if (repair)
              throw new AppError(
                503,
                "INVALID_AI_OUTPUT",
                "AI returned invalid structured output after one repair.",
                true,
              );
            repair = true;
            attempt--;
            continue;
          }
        } catch (e: any) {
          if (e instanceof AppError) throw e;
          const status = Number(e.status ?? e.code);
          if ([429, 500, 502, 503, 504].includes(status) && attempt < 2) {
            const delay = retryDelay(e, attempt);
            if (delay > 30000)
              throw new AppError(
                status === 429 ? 429 : 503,
                "AI_RETRY_LATER",
                "Provider requests a longer retry delay. Retry later.",
                true,
              );
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (status === 401 || status === 403)
            throw new AppError(
              503,
              "AI_CREDENTIALS",
              "Gemini credentials are invalid or unauthorized. Check server configuration.",
            );
          throw new AppError(
            status === 429 ? 429 : 503,
            status === 429 ? "AI_RATE_LIMIT" : "AI_UNAVAILABLE",
            "Gemini request failed. Check model access, configuration, and provider status.",
            status === 429 || status >= 500 || !status,
          );
        }
      }
      throw new AppError(
        503,
        "AI_UNAVAILABLE",
        "AI retry budget exhausted.",
        true,
      );
    } finally {
      this.active--;
    }
  }
  async extractFormStructure(c: Context, s: typeof ProposedStructure) {
    const r = await this.invoke("extract", c, s);
    for (const x of [...r.fields, ...r.requirements, ...r.candidateConstraints])
      checkEvidence(x, c);
    return r;
  }
  async explainField(c: Context, l: Language) {
    const r = checkEvidence(
      await this.invoke(
        "explain",
        { context: c, language: l },
        ExplanationWire,
      ),
      c,
    );
    if (r.fieldId !== c.field?.id || r.language !== l)
      throw new AppError(
        503,
        "INVALID_AI_OUTPUT",
        "AI changed field identity or requested language.",
      );
    return r;
  }
  async answerQuestion(c: Context, q: string, l: Language) {
    const r = checkEvidence(
      await this.invoke(
        "ask",
        { context: c, question: q, language: l },
        ChatWire,
      ),
      c,
    );
    if (
      r.language !== l ||
      (r.status === "answered" && !r.sourceIds.length) ||
      (r.status === "needs_clarification" && !r.clarificationQuestion)
    )
      throw new AppError(
        503,
        "INVALID_AI_OUTPUT",
        "AI omitted required evidence or clarification.",
      );
    return r;
  }
  async translateExplanation(e: Explanation, l: Language) {
    const { sources, ...rest } = e;
    const r = await this.invoke(
      "translate",
      {
        explanation: { ...rest, sourceIds: sources.map((s) => s.id) },
        targetLanguage: l,
      },
      ExplanationWire,
    );
    checkEvidence(r, { sources });
    if (
      r.fieldId !== e.fieldId ||
      r.language !== l ||
      JSON.stringify([...r.sourceIds].sort()) !==
        JSON.stringify(sources.map((s) => s.id).sort())
    )
      throw new AppError(
        503,
        "INVALID_TRANSLATION",
        "Translation changed protected identifiers.",
      );
    return r;
  }
}
export const createProvider = (c: Settings): AiProvider =>
  c.AI_PROVIDER === "fixture" ? new FixtureProvider() : new GeminiProvider(c);
