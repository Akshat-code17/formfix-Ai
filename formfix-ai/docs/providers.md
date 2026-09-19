# Gemini adapter and evidence handling

Checked on 2026-09-18 against official documentation and the installed SDK types:

- [`@google/genai` SDK / Models.generateContent](https://googleapis.github.io/js-genai/release_docs/classes/models.Models.html)
- [GenerateContentConfig, including responseJsonSchema and abortSignal](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini 2.5 Flash model page](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash), which lists `gemini-2.5-flash` and structured output support
- [FastAPI upload handling](https://fastapi.tiangolo.com/tutorial/request-files/)
- [Tesseract command-line and TSV formats](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html)
- [Gemini API additional terms](https://ai.google.dev/gemini-api/terms)

## Live configuration

Set these server-side in `.env`: `DEMO_MODE=false`, `AI_PROVIDER=gemini`, your `GEMINI_API_KEY`, and an accessible `AI_MODEL` (the documented default is `gemini-2.5-flash`). The pinned SDK is `@google/genai@2.23.0`. No pricing or free-tier assumptions are embedded. Startup refuses missing credentials, checks `models.get`, and never falls back silently to fixture responses. A model metadata probe confirms access; only an actual structured call can confirm that your account/model combination accepts the schema. No live key was supplied, so such a call remains unmeasured here.

The implementation constructs `new GoogleGenAI({apiKey,httpOptions})`, calls `models.generateContent({model,contents,config})`, uses `responseMimeType:'application/json'` plus `responseJsonSchema`, reads `response.text`, parses JSON and validates using Zod. Runtime validation also checks requested field/language, allowed source IDs, mandatory evidence for answered questions and clarification text when needed. Canonical quotes are always resolved by the server from stored source IDs. The model never provides authoritative quotations.

The provider interface has real `extractFormStructure`, `explainField`, `answerQuestion`, and `translateExplanation` methods. Direct language generation is the normal path. Explanation failures in a requested non-English language retry an English explanation and explicitly return `language:'en'` with `fallback:{requestedLanguage,reason:'translation_unavailable'}`. If English also fails, the route fails rather than inventing success. No separate translation API is used.

Versioned prompts are in `apps/api/src/providers/prompts/v1.ts`. Document/question data is JSON in a separate content input; system instructions prohibit following embedded directives. No model tools, URL retrieval, executable outputs or provider file uploads are enabled. Structure extraction receives bounded source blocks, not applicant answers. Unknown rules remain proposals. Explanation/chat retrieval uses a deterministic field-to-source map plus lexical relevance and document notes. Known field labels pull their associated instruction lines, so a PIN question need not repeat the rule's wording.

## Limits and retries

Context is capped at 60,000 serialized characters, questions at 1,500, and generated output at 6,000 tokens. Concurrent provider calls are capped per process (default two); there is no unbounded waiting queue. HTTP timeouts and operation-specific abort signals bound requests (30 seconds for text operations, 60 for extraction; SDK HTTP timeout 45 seconds). Gemini cancellation bounds the local wait and does not promise cancellation of already-started provider computation.

SDK automatic retries are disabled (`attempts:1`); the adapter owns at most three transient attempts, exponential jitter, retry guidance and one constrained malformed-JSON repair. A requested delay above 30 seconds is surfaced as retry-later rather than retried prematurely. Authentication/permission failures and malformed requests do not trigger blind retries. The SDK receives the supported JSON Schema subset; strict Zod string/literal constraints still run locally. Rate/budget failures use 429; configuration/provider failures use actionable 503 codes. Schema success and real citations do **not** establish semantic truth. Representative authored Q&A is evaluated separately; live hallucination resistance and multilingual quality still require an owner-run evaluation.

## Offline provider and languages

`FixtureProvider` requires `DEMO_MODE=true` and `AI_PROVIDER=fixture`. It provides deterministic field explanations and a small disclosed question catalogue (PIN, supporting-document number, travel condition). Other questions return uncertainty. It does not generate unknown-form structure. `Config.mode` and `SessionState.capabilities.mode` expose `fixture`; present that label in the frontend.

Generic cache keys include template ID, schema version, field, language, prompt version, model and canonical source hash. Only generic verified-template instructions are cacheable. Answers and chat are neither shared-cached nor sent as context. English fixture instructions/Q&A were author-checked; Hindi/Telugu/Marathi fixture translations are drafts without fluent-speaker review. Source quotations remain in the original English. No native-language quality claim is made.

## Provider data policy

Google's applicable Gemini terms vary by service and account/billing context. Review the linked current terms before sending real applicant data, including treatment of unpaid versus paid services, abuse monitoring, service logs, retention and regional obligations. This prototype makes no contractual promise about Google's independent logs, human review or backups. Local session deletion affects owned application storage and temporary parser data only. No provider file objects are created, so there are no Files API objects to delete. Use synthetic data for demonstrations.
