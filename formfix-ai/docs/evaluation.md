# Measured evaluation — 2026-09-18

**62 automated tests passed: 49 TypeScript and 13 Python, with zero skips in the final Python run.** A separate real HTTP end-to-end smoke flow also passed. These results apply to the one authored fictional form and explicit fixture AI, not to general forms or live Gemini quality.

Raw evidence: [evaluation JSON](evaluation-results.json), [TypeScript test results](typescript-test-results.json), [Python JUnit results](python-test-results.xml), and [Python dependency metadata audit](python-dependency-audit.json). Regenerate using the commands in `setup.md`.

| Measurement | Observed result | Interpretation |
|---|---|---|
| Verified-template field recovery | TP 14, FP 0, FN 0; precision 1.00, recall 1.00 | Native fixture was matched against every printed label, instruction and layout check; the registered schema was then applied. This is not an LLM extraction score. |
| Verified-template requirement recovery | TP 3, FP 0, FN 0; precision 1.00, recall 1.00 | Three author-reviewed fictional document requirements. |
| Seeded validation problems | TP 3, FP 0, FN 0; precision 1.00, recall 1.00 | Five-digit PIN, missing supporting-document number, unready Support record. |
| Clean counterpart false positives | 0 issues | Includes leading-zero identifiers and a leap-day DOB inside explicit bounds. |
| Reviewed offline factual Q&A | 3/3 returned the expected status and supporting instruction IDs | PIN, supporting-document number and travel condition. The authored response text was checked against the fictional instructions; automated tests check expected source phrases, not universal semantic entailment. |
| Uncertainty/injection cases | 3/3 expected abstention/clarification statuses | Unsupported passport acceptance, ambiguous “this?”, and a secret-exfiltration instruction. This does not measure live model resistance. |
| Native upload → ready | 1,104 ms in final HTTP smoke run | One local Windows run; includes polling interval and real FastAPI/parser/Mongo interaction. No p95 or production latency claim. |
| Smoke workflow through export | 1,391 ms | Synthetic upload, extraction, fixture explanation/chat, saves, validation, correction, clean revalidation, export. Timing excludes final deletion and infrastructure startup. |
| Python suite | 13 tests, 0 failures/errors/skips; 2.006 seconds | Includes real Tesseract scanned-page extraction and active-parser cancellation. |

## What was exercised

- Real native PDF extraction and AcroForm inspection path, real raster-page OCR through Tesseract TSV, retained OCR origin/confidence, malformed/encrypted/oversized PDFs, page/pixel limits, OCR timeout and parser timeout.
- Rotation-normalized boxes overlapping rendered glyphs at 0/90/180/270 degrees. Four additional tests compare Python's transform and displayed dimensions with **PDF.js 6.3.289's browser-viewer viewport implementation**, executed in Node. No owner-provided frontend viewer was available for UI testing.
- All printed demo template anchors/instructions and three changed-version/instruction/layout rejections, plus extra hostile instructions outside answer regions. Unknown templates remain reviewable and never receive the sample validation rules.
- Valid/invalid AI JSON, exactly one repair, missing/nonexistent evidence, credential failure without retry, transient failure with bounded retries, rate limits, long Retry-After guidance, supported schema-keyword conversion, preserved field/language, and explicit English fallback metadata.
- Required and conditional rules, unknown conditions, valid/invalid calendar dates, inclusive date boundaries, options, lengths, exact repeated identifiers, leading zeros, clean answers and all three seeded problems.
- Actual MongoDB transactions: simultaneous edits produce one accepted update and one 409; cross-session form/document/job/edit/export access is denied; deleting another guest's own session does not affect the victim; active-job deletion prevents resurrection; expiry denies reads before cleanup; failed cleanup remains inaccessible and retryable; leases recover once and then fail explicitly.
- Complete API-contract-shaped workflow with actual HTTP through Express and FastAPI, real extraction child process, real Mongo replica set, correction/revalidation, current export and session deletion. Race-focused integration tests use captured real native extraction to control worker timing; they are separate from this full HTTP smoke.

## Environment and dependency checks

Measured locally on Windows with Node 24.20.0, Python 3.12.10, MongoDB 7.0.24, Tesseract 5.5.3.20260724 plus official English fast traineddata, `@google/genai` 2.23.0, PDF.js 6.3.289, pdfplumber 0.11.10, pypdf 6.19.0 and pypdfium2 5.13.0. Final locks include FastAPI 0.141.1, Starlette 1.6.0, python-multipart 0.0.31, Multer 2.4.0 and pytest 9.0.3. See lockfiles for all transitive versions.

The final npm runtime audit reported zero known advisories. PyPI release metadata reported zero advisories across the 33 locked Python packages at check time. These are dependency-database checks, not proof of application security. The Python suite emits two upstream test-client deprecation warnings. MongoDB's disposable replica-set shutdown can emit an ECONNRESET warning after a successful run on this host; no assertion or smoke step failed.

Docker Compose configuration validation passed. Docker Engine was unavailable, so container image builds and container runtime behavior were **not executed here**. The real local subprocess harness was executed instead. A CI workflow is provided for repeatable Linux verification but has not been run remotely.

## Unmeasured and incomplete capabilities

No live Gemini key was supplied. SDK initialization, request shape, JSON parsing, retry logic and evidence guards are implemented and transport-tested, but live latency, model-specific schema acceptance, adversarial prompt behavior and semantic answer quality remain unmeasured. The model and structured-output API were checked against official documentation; runtime startup probes configured model availability.

Hindi/Telugu/Marathi explanations are implemented as draft fixture translations and live language requests. No fluent speaker reviewed those drafts; they are explicitly flagged. No genuine applicant data was used. No multi-form generalization, handwriting/signature feature, official-PDF filling, document verification, submission, hosted deployment, accessibility test or owner-frontend print-layout test is claimed.
