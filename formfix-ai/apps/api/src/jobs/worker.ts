import type { Store, Job } from "../repositories/store.js";
import type { Settings } from "../config.js";
import type { AiProvider } from "../providers/ai.js";
import { extract } from "../providers/document.js";
import { matchTemplate, unknownForm, ref } from "../services/template.js";
import {
  FormModel,
  ProposedStructure,
  SessionState,
  type Extraction,
} from "../../../../packages/contracts/index.js";
import { capabilities } from "../routes/app.js";
import { AppError, envelope } from "../security/errors.js";
import { resolveSources } from "../providers/ai.js";
export async function processJob(
  store: Store,
  c: Settings,
  provider: AiProvider,
  job: Job,
  extractor: (path: string, c: Settings) => Promise<Extraction> = extract,
) {
  const heartbeat = setInterval(
    () =>
      void store.jobs
        .updateOne(
          { _id: job._id, leaseToken: job.leaseToken, status: "running" },
          { $set: { leaseUntil: new Date(Date.now() + 120000) } },
        )
        .catch(() => {}),
    30000,
  );
  try {
    const f = await store.form(job.owner, job.formId);
    const ex = await extractor(f.path, c);
    await store.jobs.updateOne(
      { _id: job._id, leaseToken: job.leaseToken, status: "running" },
      { $set: { stage: "matching" } },
    );
    let model = matchTemplate(ex, job.formId);
    if (!model) {
      model = unknownForm(ex, job.formId);
      try {
        await store.budget(job.owner, "aiUsed", c.AI_SESSION_BUDGET);
        const sources = ex.blocks.map(ref).slice(0, 150);
        const proposal = await provider.extractFormStructure(
          { sources },
          ProposedStructure,
        );
        model.sections = proposal.sections;
        model.fields = proposal.fields.map(({ sourceIds, ...f }) => ({
          ...f,
          requiredStatus: "unknown" as const,
          ruleIds: [],
          sources: resolveSources(sourceIds, sources),
        }));
        model.documentRequirements = proposal.requirements.map(
          ({ sourceIds, ...d }) => ({
            ...d,
            requiredStatus: "unknown" as const,
            sources: resolveSources(sourceIds, sources),
          }),
        );
        model.extractionWarnings.push(
          ...proposal.ambiguities.slice(0, 30),
          ...proposal.candidateConstraints
            .slice(0, 20)
            .map((r) => "Unverified candidate: " + r.description),
        );
        const sectionIds = new Set(model.sections.map((s) => s.id));
        if (
          new Set(model.fields.map((f) => f.id)).size !== model.fields.length ||
          model.fields.some((f) => !sectionIds.has(f.sectionId))
        )
          throw new Error("Invalid relationships");
      } catch {
        model = unknownForm(ex, job.formId);
        model.extractionWarnings.push(
          "AI proposal unavailable; original document and extracted source blocks retained for manual review.",
        );
      }
    }
    const state = SessionState.parse({
      form: FormModel.parse(model),
      language: job.language,
      revision: 0,
      answers: {},
      documentReadiness: {},
      updatedAt: new Date().toISOString(),
      expiresAt: f.expiresAt.toISOString(),
      capabilities: capabilities(c, !!model.templateId),
    });
    await store.commit(job, state, ex);
  } catch (e) {
    const error = envelope(
      e instanceof AppError
        ? e
        : new AppError(
            503,
            "PROCESSING_FAILED",
            "Processing failed; retry the upload.",
            true,
          ),
    ).error;
    await store.jobs.updateOne(
      {
        _id: job._id,
        owner: job.owner,
        leaseToken: job.leaseToken,
        status: "running",
      },
      { $set: { status: "failed", stage: "failed", error } },
    );
  } finally {
    clearInterval(heartbeat);
  }
}
