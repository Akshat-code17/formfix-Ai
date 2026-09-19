# API contract and frontend coordination

`packages/contracts/index.ts` is the source of truth. `schema.json` and `docs/openapi.json` are generated. Browser callers use relative `/api` URLs with `credentials: 'same-origin'`. Creation and mutations require the exact `Origin` header; browsers supply it. Save the returned CSRF token in memory and send `X-CSRF-Token` on mutations. Session creation is idempotent for an existing valid cookie and returns its token (200 rather than 201).

| Method | Route | Input / response |
|---|---|---|
| GET | `/api/config` | `Config`: limits, languages, mode and capabilities |
| POST | `/api/sessions` | No body; `SessionResult`, opaque signed HttpOnly cookie |
| POST | `/api/forms/analyze` | Multipart `file`, `language`; 202 `{formId,jobId,status:'queued'}` |
| GET | `/api/jobs/:jobId` | `JobResult`: queued/running/ready/needs_review/failed and stage |
| GET | `/api/forms/:formId` | `SessionState`; 409 while processing |
| GET | `/api/forms/:formId/document` | Owned original PDF, private/no-store |
| GET | `/api/forms/:formId/sources` | Additive `Extraction`: pages, canonical source blocks, OCR origin/score, AcroForm metadata |
| PATCH | `/api/forms/:formId/answers` | `{baseRevision,changes:{fieldId:string\|boolean\|null}}`; `{revision,answers}` |
| PATCH | `/api/forms/:formId/documents` | `{baseRevision,changes:{requirementId:readiness}}`; `{revision,documentReadiness}` |
| POST | `/api/forms/:formId/language` | `{language}`; updated `SessionState` |
| GET | `/api/forms/:formId/fields/:fieldId/explanation?language=hi` | `Explanation`; optional fallback metadata |
| POST | `/api/forms/:formId/ask` | `{question,fieldId?,language}`; `ChatAnswer` |
| POST | `/api/forms/:formId/validate` | `{revision}`; `ValidationReport` |
| GET | `/api/forms/:formId/export?format=json` | Attachment `ExportSummary` |
| DELETE | `/api/sessions/current` | 204 after cleanup, or retryable 503 |

IDs are stable template identifiers (`pin`, `support_number`, `support_record`) or random UUIDs for owned objects. Requirement IDs are not field IDs. Coordinates always reference the displayed page after its PDF rotation. The frontend should position a source highlight at `left=x*displayWidth`, `top=y*displayHeight`, with similarly scaled width/height; do not apply rotation a second time. Use `inputRegion` only for an answer region, never for quoting evidence. English PDF source quotations remain verbatim in every UI language.

Save answer revisions sequentially. On 409, reload state, show the accepted values and reconcile the user's pending edit. Do not blindly retry the stale revision. Changing language does not change the answer revision or invalidate a validation report; it updates the preference atomically. Answer/readiness edits increment revision and remove the previous report. Validation uses only persisted state and does not call AI.

`requiredStatus` is `required`, `optional`, `conditional`, or `unknown`. Readiness values are `ready`, `not_ready`, `unknown`, `not_applicable`. Issue severities are `error`, `warning`, `manual_review`. Chat statuses are `answered`, `not_found`, `needs_clarification`. Unknown forms have `templateVerified=false`; their proposed constraints are not executed. The source endpoint makes successful extraction useful even when fixture-mode structural inference is unavailable.

The connected frontend is supplied in the sibling `formfix-frontend` directory. Its existing UI contract is preserved with a validated adapter; see its `docs/CONNECT_BACKEND.md`. Verified conditional fields now expose an optional declarative `condition`, resolved from registered template rules. Answer patches optionally accept `skipped: {fieldId: boolean}` alongside the corresponding `changes`; state returns optional `answerSkipped` metadata. Skipping does not change requiredness or bypass validation. Generated JSON schemas include these additions.

All errors use `{error:{code,message,retryable,requestId,details?}}`. Codes are safe, stable identifiers. HTTP status distinctions: 401 guest missing/expired; 403 CSRF/origin; 404 not owned/not found; 409 stale/not ready; 413 body/file size; 415 type/magic; 422 malformed request or unusable synchronous content; 429 rate/budget; 503 dependency/AI/cleanup failure. A PDF rejected by the asynchronous parser is a `failed` job with a specific code such as `ENCRYPTED_PDF` or `MALFORMED_PDF`, not a `needs_review` template. Error messages do not echo document content.

Example browser requests (no credentials embedded):

```js
const session = await fetch('/api/sessions', {method:'POST'}).then(r=>r.json());
const body = new FormData(); body.set('file', chosenPdf); body.set('language','en');
const upload = await fetch('/api/forms/analyze', {
  method:'POST', headers:{'X-CSRF-Token':session.csrfToken}, body
}).then(r=>r.json());
const job = await fetch(`/api/jobs/${upload.jobId}`).then(r=>r.json());
// Poll with bounded backoff until ready, needs_review or failed.
const state = await fetch(`/api/forms/${upload.formId}`).then(r=>r.json());
await fetch(`/api/forms/${upload.formId}/answers`, {
  method:'PATCH', headers:{'Content-Type':'application/json','X-CSRF-Token':session.csrfToken},
  body:JSON.stringify({baseRevision:state.revision,changes:{pin:'012345'}})
});
```

For a credential-free terminal smoke request: `curl http://localhost:8080/api/config`. For the complete cookie/CSRF/upload/correction flow, run `npm run smoke`; it handles secrets in memory. Render exported data as text, never HTML. The frontend owns accessibility and print-to-PDF layout; no frontend was provided to test keyboard navigation, screen-reader labels or its particular PDF viewer. The export is a review summary, not a filled official form.
