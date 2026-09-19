# FormFix AI

**“Tell me what this form actually wants.”** Working backend for one fictional, six-page student-support form. Express/TypeScript, FastAPI, MongoDB, native PDF extraction, real Tesseract OCR adapter, Gemini adapter, versioned prompts, private storage, revision conflicts, deterministic validation and JSON review export.

The default is **explicit offline fixture mode**. It does not claim live AI generation. The Gemini adapter uses the official `@google/genai` SDK, but live calls need your own server-side credentials. This prototype has no auto-submission, official-PDF filling, signature authentication or document verification.

## Run the containers

Prerequisites: Docker Engine/Desktop running and Docker Compose v2. From this directory:

```sh
node scripts/init-env.mjs
docker compose up --build -d
docker compose ps
npm ci
npm run build
npm run smoke
```

The initialization command creates `.env` with fresh local secrets and `DEMO_MODE=true`, `AI_PROVIDER=fixture`. It refuses to overwrite an existing `.env`. The API is available through `http://localhost:8080/api`. `npm run smoke` uploads the PDF, waits for actual extraction, asks a cited question, detects the three intended mistakes, corrects them, revalidates, exports and deletes its session. It leaves a synthetic timing report in `work/`.

If Docker is unavailable, see the local subprocess harness in [setup](docs/setup.md). No deployment or paid resources are created by the repository.

## Read and inspect

- [Architecture and Mermaid diagram](docs/architecture.md)
- [Exact setup and testing commands](docs/setup.md)
- [API and frontend integration](docs/api.md) and [generated OpenAPI](docs/openapi.json)
- [Provider configuration and official references](docs/providers.md)
- [Measured evaluation and limitations](docs/evaluation.md)
- [Privacy and operational constraints](docs/limitations.md)
- [3–4 minute demo and offline fallback](docs/demo-script.md)
- [Fictional target PDF](fixtures/demo/sample-student-support.pdf), [verified gold template](fixtures/demo/verified-template.json), [three-error answers](fixtures/demo/seeded-errors.json), [clean answers](fixtures/demo/clean.json)

The English instructions and offline Q&A were checked against the authored fictional template. Hindi, Telugu and Marathi text is draft and has **not** had fluent-speaker review. Non-English fixture explanations return `needsReview=true`. No original frontend, proposal, idea document, real target form or live API credentials were supplied.
