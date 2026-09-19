# Connect the supplied frontend

The original `D:\formfix` was read but not modified because write permission was not granted. This directory is a connected copy, preserving the React screens and their public UI contracts. Keep it beside the updated `formfix-ai` backend directory.

## Run on this computer

From this directory in PowerShell:

```powershell
npm run dev:connected
```

Open **http://localhost:5174** and choose **Try a sample form**. Port 5173 is left available for your original frontend. The launcher starts Vite, Express, a real temporary MongoDB replica set, the worker, and FastAPI. It uses the Python environment and Tesseract already installed in the enclosing workspace. No Gemini key is needed for this explicitly labelled recorded-AI mode. The sample goes through real multipart upload, native PDF extraction, template matching and persistence; it starts with blank answers.

Keep the terminal open. Ctrl+C stops these processes and removes the launcher's temporary database and owned uploads. Answers survive browser reloads during a run. **Use the Docker setup below when data must survive a backend restart.** This launcher is only for local synthetic-data demonstrations.

## Setup after copying to another computer

Requires Node 22.19+ (tested locally with Node 24.20), Python 3.12 and Tesseract with English language data on PATH. Backend Python dependencies and Node dependencies are pinned in lockfiles. Keep the directories as siblings:

```text
formfix-ai/
formfix-frontend/
```

```powershell
cd formfix-ai
npm ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r services/document/requirements.lock
$env:PYTHON = (Resolve-Path .\.venv\Scripts\python.exe).Path
cd ../formfix-frontend
npm ci
npm run dev:connected
```

The temporary MongoDB launcher downloads MongoDB 7.0.24 on its first run when its binary is not cached. For automated browser tests, install Chromium once with `npx playwright install chromium`, then run `npm run test:connected`.

If the backend is elsewhere, set `FORMFIX_BACKEND_DIR` to its absolute directory. `PYTHON` selects the Python interpreter. Tesseract must be on PATH; `TESSDATA_PREFIX` may select its language-data directory. Do not point this demo launcher at a production database.

## Durable Docker stack with the frontend

Start Docker Desktop first. From `formfix-frontend`:

```powershell
Copy-Item .env.example .env.local
npm ci
npm run build
cd ../formfix-ai
node scripts/init-env.mjs
docker compose -f compose.yaml -f compose.frontend.yaml up --build
```

Open **http://localhost:8080**. The backend `.env` must have `APP_ORIGIN=http://localhost:8080`. The nginx proxy serves the frontend build and forwards `/api` to Express on the same browser origin. Mongo and uploads use persistent private Docker volumes; the document service is internal. `docker compose ... down` stops services while preserving volumes. The compose configuration has been validated locally; image build/start requires the owner's Docker engine and was not executed here.

For frontend hot reload against Docker, use the base backend compose stack, set its `APP_ORIGIN=http://localhost:5173`, recreate API/worker, then run `npm run dev` in the frontend with:

```dotenv
VITE_APP_MODE=live
API_PROXY_TARGET=http://127.0.0.1:8080
```

Open exactly `http://localhost:5173`, not `http://127.0.0.1:5173`. Origin checking is exact, and cookies are host scoped. Do not add broad CORS or expose FastAPI to the browser.

## Two distinct modes

| Command/config | Requests | AI |
| --- | --- | --- |
| `npm run dev:connected` | Real local API, Mongo and PDF parser | Recorded fixture responses; persistent visible badge |
| `npm run dev:demo` | Original browser-only MSW fallback | Original frontend fixtures; “Demo data” badge |
| Frontend `VITE_APP_MODE=live`, backend `DEMO_MODE=false` and `AI_PROVIDER=gemini` | Real configured API | Gemini, using server-only credentials |

`VITE_APP_MODE=live` selects real HTTP transport; it does not assert that Gemini is enabled. The connected badge reads the backend's advertised provider mode. Gemini configuration remains in the backend `.env`; never put `GEMINI_API_KEY`, session secrets, or document-service tokens in a `VITE_` variable. Live Gemini calls have not been tested without owner credentials. Hindi, Telugu and Marathi fixture translations are drafts without fluent-speaker review.

## Contract bridge

The existing `api` object remains the UI interface. `apps/web/src/lib/backend-adapter.ts` validates the actual backend wire response, maps it to the existing frontend contract, and validates the result. It converts answer records, readiness values, job stages, options, section metadata, validation counts and exports. Immutable source IDs, quotes and normalized bounding boxes pass through unchanged. Unsupported array answer values are rejected rather than coerced. Unknown conditions stay unresolved.

The backend wire schema is generated into `packages/contracts/src/backend.ts`; run `npm run sync:backend` after backend contract changes. The local launcher does this automatically and copies the verified six-page PDF. Existing browser-only fixtures have different field IDs and rules and are never used to seed the connected pipeline.

The browser sends relative `/api` requests with HttpOnly session cookies, recovers a CSRF token through `/api/sessions`, and sends `x-csrf-token` for mutations. Saves retain `baseRevision`; 409 conflicts are handled by the existing queue. Answer patches are followed by an authorized state read so screens receive their expected full-state response. Skip metadata persists. A check waits for active saves and refuses to validate after a save failure. Export preserves the chosen answer subset, template version, saved revision, readiness status and whether validation is current.

No connection errors fall back to MSW. Unknown forms open the original PDF for review without borrowing sample rules. The local demo IP budget is 600 requests/minute so automated desktop and mobile runs can share localhost; the regular backend default remains 120, configurable through `IP_REQUESTS_PER_MINUTE`.

## Troubleshooting

- **403 Origin/CSRF:** use the exact configured origin; restart the API after changing `APP_ORIGIN`. The Vite proxy preserves Origin.
- **503 or connection refused:** start the API, worker and document service; frontend mode does not start them unless using `dev:connected`.
- **Port occupied:** stop the previous connected launch in its terminal. The launcher deliberately does not terminate unrelated processes.
- **Needs review:** the document is not the backend's reviewed template/version. This is distinct from parser failure. Use “Try a sample form” to upload the verified backend sample.
- **Recorded AI badge:** the server is using its explicit fixture provider. Configure Gemini server-side to enable live AI.
- **Expired session after restart:** expected with the temporary local launcher. Start a fresh session or use Docker's durable stack.

This remains a one-form prototype. It does not submit an application, fill an official PDF, verify documents, or authenticate signatures.
