# Setup and reproducible checks

## Container path

Use Node 22.19+ and Docker Compose v2. Images are version-tagged in `compose.yaml`. npm dependencies have an npm lockfile; Python direct and transitive dependencies are pinned in `requirements.lock`. Debian supplies Tesseract/English data at image build time; this apt package is not content-digest locked, so record the actual engine version after building.

```sh
node scripts/init-env.mjs
docker compose up --build -d
docker compose ps
docker compose logs --tail=40 api worker document
npm ci
npm run build
npm run schemas
npm run smoke
```

Do not put keys in shell examples or commit `.env`. Mongo self-initializes `rs0` through its healthcheck. No host Mongo/document ports are exposed. API readiness checks Mongo and document service; live API startup also checks configured model availability. Worker health checks its heartbeat, including a grace interval for parser work. Default retention is 24 hours. Stop using `docker compose down`; add `--volumes` only when deliberately discarding all local persisted data.

The proxy exposes localhost HTTP for local use. Cookies are HttpOnly and SameSite=Strict; Secure is enabled automatically when `APP_ORIGIN` begins with `https://`. For an owner-approved hosted deployment, terminate HTTPS, set the exact HTTPS origin, mount the frontend under the same origin, and keep API/internal ports private. Compose sets one trusted proxy hop because nginx overwrites forwarded IPs. Direct local execution defaults to no trusted proxy. No broad CORS is enabled.

## Tests without Docker

Use Python 3.12, Node 22.19+, and Tesseract with English traineddata. Install Tesseract using your OS package manager; on Debian/Ubuntu use `apt-get install tesseract-ocr tesseract-ocr-eng`. On Windows, the Tesseract project links the UB Mannheim installer. A portable binary may be selected with `TESSERACT_CMD`; use `TESSDATA_PREFIX` if traineddata is not beside the executable. No OCR API key is required.

```sh
python -m venv .venv
# POSIX:
. .venv/bin/activate
# Windows PowerShell instead: .\.venv\Scripts\Activate.ps1
python -m pip install -r services/document/requirements.lock
npm ci
python scripts/prepare-tests.py
npm run build
npm test
python -m pytest services/document -q --junitxml=work/python-results.xml
npm run test:e2e
npm run evaluate
```

The harness starts a real disposable single-node MongoDB replica set, a real FastAPI HTTP server, an Express HTTP server and the worker loop. It uses the explicit fixture AI provider. `mongodb-memory-server` downloads an official MongoDB 7.0.24 binary on first use; despite its name, these tests exercise a real server and transactions. The Windows binary download is about 600 MB. Set `PYTHON` to an absolute interpreter path if `python` does not refer to the prepared environment. Set `MONGOMS_SYSTEM_BINARY` to an existing compatible `mongod` if network downloads are unavailable. Temporary DBs stop at test completion.

For Python tests inside the existing document container (fixture paths are mounted at the source layout):

```sh
docker compose run --rm --no-deps -v "${PWD}:/repo" -w /repo document python -m pytest services/document -q --junitxml=/tmp/python-results.xml
```

The OCR test explicitly skips when Tesseract is absent; a skip is not an OCR pass. Native, malformed/encrypted input, all rotations, parser timeout, OCR timeout and cancellation tests are separate. The real local end-to-end harness is separate from integration tests that inject captured *real* extraction JSON for fast deterministic race testing.

## Run separate local processes

Start a Mongo replica set first (`mongod --replSet rs0 --bind_ip 127.0.0.1 --dbpath <private-directory>`, then `mongosh --eval 'rs.initiate()'`). Generate `.env`, set local `MONGODB_URI`, `DOCUMENT_SERVICE_URL=http://127.0.0.1:8000`, `UPLOAD_DIR` to a private absolute directory, and `APP_ORIGIN=http://localhost:3000`. Export `DOCUMENT_SERVICE_TOKEN` into the Python process using your environment manager.

```sh
python -m uvicorn main:app --app-dir services/document --host 127.0.0.1 --port 8000 --no-access-log
# second terminal, after npm run build:
npm start
# third terminal:
npm run worker
# fourth terminal, APP_ORIGIN=http://localhost:3000 in environment:
npm run smoke
```

Rebuild after changing TypeScript or fixture JSON. `scripts/generate_demo.py` regenerates the authored PDF/template/answers deterministically; changes require re-review of gold instructions and tests. Schema changes require `npm run build && npm run schemas`. The runtime validates both incoming requests and outgoing API responses. Logs omit bodies, filenames, questions, answers, cookies and credentials.
