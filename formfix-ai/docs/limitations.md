# Scope, privacy and remaining work

This is a runnable one-form prototype, not a production-ready service or a universal forms engine. The only verified template is authored fictional `ff-demo-2026-v1`. No institutional affiliation, legal eligibility, identity, document acceptance beyond printed demo instructions, signature authenticity or successful submission is established.

## Measured versus unmeasured

Real native parsing, real one-page raster OCR, four page rotations, actual Mongo transactions, and a complete Express-to-FastAPI HTTP flow were exercised. Gemini request construction/error behavior is tested with an injected transport; no live Gemini credentials were supplied. Prompt isolation and fixture injection tests do not prove a live model cannot be influenced. The matcher is intentionally strict and can send legitimate scanned/filled variants to review. The extraction precision/recall numbers measure recovery of the registered synthetic template, not learned generalization or arbitrary-form extraction.

No frontend was present. Public contracts and a frontend-shaped HTTP flow are provided, but the owner's UI, accessibility behavior and print layout were not tested. The renderer tests verify normalized rectangles against displayed PDF pixels; actual UI integration must use the same rotation-normalized page geometry. CropBox/non-zero MediaBox PDF variants need additional review before a new real template is registered.

English native/scanned input is the default. OCR uses English traineddata; multilingual *explanations* do not imply Hindi/Telugu/Marathi OCR support. No handwriting, signature placement/authentication or visual document verification is implemented. AcroForm metadata is inspected; official field filling and overflow handling are not implemented.

## Privacy and operational behavior

- Random generated storage paths, private volumes, signed opaque guest cookies, constant-time signature/CSRF checks, strict same-origin mutations and ownership checks cover documents, jobs, editing, sources and export.
- Request logging records request IDs, route templates, method/status/timing. Provider logging records operation, timing and token count when present. No request body, cookie, key, chat, answer, original filename or PDF content is logged.
- Expiry is enforced in authorization and transactions. Cleanup is application-driven rather than relying on TTL. Files and records are deleted before a success response; failed document-service/file cleanup returns retryable 503 with the session inaccessible. Shared generic template explanation caches expire independently and contain no applicant data.
- The parser service is authenticated and private. Cancellation terminates active parser subprocesses and waits for its temporary workspace cleanup; cancelled request IDs reject late arrivals for ten minutes. Worker commits are fenced by the Mongo session tombstone even after that interval. Transient upload buffers/in-flight HTTP transport data are not persistent provider records.
- Docker memory/CPU/PID limits, Python process limits on Linux, subprocess timeouts, page/pixel/text caps and one parser slot reduce resource exposure. They are not a substitute for a hardened parser isolation review. Windows local tests lack Linux resource-limit enforcement.
- Mongo, the worker and the private document service are required long-running components. A single-node replica set is for demo transaction semantics and is not highly available. Internal Mongo has no authentication in this isolated Compose demo and no published host port; production needs authenticated Mongo, TLS, backups/restore review and operational access control.
- The default proxy listens on localhost HTTP. Hosted HTTPS termination, account-specific retention policy, secret rotation, dependency review, load testing and failure recovery exercises remain deployment work. No external resources were provisioned.
- Retention cleanup normally runs every 30 seconds between jobs; a long in-flight job may delay the sweep. Access remains denied immediately on expiry. Startup/recovery removes expired owned data and ten-minute crash-orphan PDFs. Filesystem unlink does not promise secure erasure from host snapshots/backups.

## Next verified-template gate

Before enabling a real form: obtain the exact version and authorization to use it, independently review every field/condition/document instruction and source mapping, establish a gold corpus including real scan/layout variants, obtain fluent-speaker review, run live provider Q&A/injection/uncertainty evaluations, verify the actual frontend viewer and print layout, and approve applicable external data handling. Add features only when those measurements justify them.
