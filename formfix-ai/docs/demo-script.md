# 3–4 minute demonstration

**Before starting:** run `docker compose up --build -d`, `npm ci`, `npm run build`, `npm run smoke`. Confirm `/api/config` reports `mode:'fixture'` for the offline demo. Keep `sample-student-support.pdf`, `seeded-errors.json`, `clean.json`, and the API collection/OpenAPI visible. There is no bundled product frontend; use the owner's UI once connected or the smoke script with a REST client. Do not present the proxy's plain health page as a finished UI.

**0:00–0:30 — Honest scope.** “FormFix AI explains what a form asks. This is a fictional six-page form, reviewed for this demo. It does not submit anything or certify documents. We are using the explicit offline fixture provider today.” Open the PDF and show its Demo Only label.

**0:30–1:10 — Real ingestion.** Create a guest session, upload the PDF, show 202 and the durable job state. Wait for `ready`. Show the 14 fields across three sections and the three readiness requirements. Open the PIN explanation and its printed source on page 2. Explain that native PDF text was used; OCR is used only for pages without usable text.

**1:10–1:40 — Language and grounded questions.** Request Hindi, Telugu or Marathi. Point out that original labels and source quotations are unchanged, translations are draft pending fluent-speaker review, and `needsReview=true` is explicit. Ask “How many PIN digits?” and show the six-digit source. Ask “Does the institution accept a passport?” and show `not_found`, rather than a made-up policy.

**1:40–2:25 — Three avoidable mistakes.** Save the provided synthetic error answers and readiness. Validate the persisted revision. Show exactly: five-digit PIN; missing Supporting-document number; Support record not marked ready. “The last item is self-reported readiness. No attachment was inspected.” No AI call is used for these checks.

**2:25–3:00 — Correct and revalidate.** Change PIN to `012345`, Supporting-document number to `SD-000123`, and Support record to ready. Show that leading zeros survive, revisions increase, the old report becomes invalid, and the new report has zero issues. Optionally submit a stale revision and show controlled 409.

**3:00–3:35 — Export and privacy.** Download JSON and show `kind:'review_summary_not_official_form'`, saved answers, readiness, revision and `validationCurrent:true`. Explain the frontend's later print layout is a review summary. Delete the guest session, then show that its form is inaccessible.

**3:35–4:00 — Limits.** State that measured results apply to one synthetic form, the Gemini adapter is real but a live key was not used in this build, translations await review, and new forms remain `needs_review` until their templates/rules are approved.

## Explicit offline fallback

If Gemini credentials, quota or network are unavailable, deliberately configure `DEMO_MODE=true` and `AI_PROVIDER=fixture`, then restart API and worker. Show the `fixture` mode label. The parser, Mongo persistence, revisions, validation, cancellation and export remain real; only explanation/Q&A use the fixed catalogue. Do not call this a live AI response. If all services are unavailable, walk through the PDF and recorded evaluation JSON as **recorded evidence**, without pretending a request just ran.
