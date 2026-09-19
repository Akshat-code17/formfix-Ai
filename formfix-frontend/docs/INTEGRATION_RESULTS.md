# Frontend integration verification

Measured locally on Windows with Node 24.20.0, Chromium/Playwright 1.63.0, React 19.3.0, Vite 8.3.0, FastAPI and MongoDB 7.0.24. The connected run finished at 2026-09-19 03:54 IST. This is a local one-template test, not a production benchmark.

| Check | Measured result |
| --- | --- |
| Frontend Vitest | 35/35 passed, including wire-schema rejection, canonical values, skip metadata, fallback language, export filtering, and save/validation races |
| Backend Vitest | 49/49 passed after contract extensions, including revision conflicts, ownership, deletion, expiry, provider failure and deterministic validation |
| Production frontend build | Passed; Vite warns that the main PDF-capable bundle exceeds 500 KB |
| Connected desktop complete flow | Passed, 18.167 seconds |
| Connected mobile complete flow | Passed, 12.779 seconds |
| Desktop unsupported-form review | Passed, 4.807 seconds |
| Mobile unsupported-form review | Passed, 5.693 seconds |
| Connected browser suite | 4/4 passed; 48.060 seconds including browser overhead; no flaky retries |
| Final focused offline/MSW flow | 2/2 passed with exit 0; desktop 15.8 seconds, mobile 16.5 seconds, 38.4 seconds total |
| Combined Docker Compose configuration | Validated; Docker configuration-read warning in sandbox; images not built or started |

The connected browser tests use real HTTP through the Vite same-origin proxy, real Express routes, a real temporary MongoDB replica set, FastAPI and the PDF parser. AI responses use the explicitly labelled fixture provider. They do not intercept routes or replay upload responses with MSW.

Each supported-form flow checks 14 fields and three requirements, opens a source highlight on the PDF, saves synthetic answers through the browser's API adapter, detects all three seeded errors, gets a controlled 409 for a stale edit, corrects the PIN and document number through visible inputs, reloads to confirm leading zeros survive, changes language without rewriting answers, gets `not_found` for an unsupported question, fixes readiness, and revalidates to zero findings. It checks selected-answer export and current-validation metadata, clicks the actual JSON download button, deletes the session, then confirms the form becomes inaccessible. The test seeds the initial synthetic answer set and performs some checklist/chat operations through the same imported browser API client rather than manually typing every field.

The unsupported-form test uploads the original frontend's different sample PDF. The backend does not apply its verified demo rules, and the UI opens the manual-review screen instead of crashing on an empty field list.

Raw connected results: [connected-results.json](connected-results.json). Prior extraction precision/recall, OCR and provider-adapter evaluations remain in the backend's `docs/evaluation.md`; this integration run does not establish generalization beyond the verified template. Live Gemini was not called. The three non-English fixture translations still need fluent-speaker review.

The temporary MongoDB test helper emits a shutdown `ECONNRESET` diagnostic on this Windows host after successful tests. The connected harness exits with status 0 and cleans up its owned services. The local preview uses temporary storage; the Docker stack supplies persistent volumes.

An additional full offline/MSW run initially completed all 18 test assertions but hung during Windows teardown. A subsequent six-worker run experienced a long host stall and finished with 12 passing and six mobile setup/navigation timeouts. The test launcher now owns Vite directly and uses one browser worker. Do not count either of those broad runs as a clean successful suite. The stall also interrupted the temporary preview Mongo connection; the preview was restarted, and its launcher now closes Vite if the backend exits. Persistent Docker deployment remains the recommended longer-running setup.

After that change, the targeted original offline upload/explain/chat/language/check/correct/export journey passed on desktop and mobile using `npm run test:e2e -- --grep "upload, read"`. The final run had no concurrent source changes. A previous focused attempt overlapped a schema-sync hot reload and lost the mobile screen's in-memory validation result; schema synchronization now avoids rewriting unchanged schema files. The complete 18-case suite has not been rerun with one worker.
