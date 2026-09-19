import {
  API,
  CSRF_HEADER,
  ERROR_CODES,
  LanguageSchema,
  type AppConfig,
  type ExportSummary,
  type Language,
} from '@formfix/contracts';
import {
  DEMO_FORM_ID,
  demoAsk,
  demoExplanation,
  demoFormModel,
  validateDemoForm,
} from '@formfix/fixtures-demo';
import samplePdfUrl from '@formfix/fixtures-demo/assets/sample-form.pdf?url';
import { HttpResponse, delay, http, type HttpResponseResolver } from 'msw';
import { RETENTION_POLICY_FALLBACK_URL } from '../lib/env';
import { demoLab } from './demo-lab';
import { DEMO_CAPABILITIES, demoStore } from './demo-store';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_PAGES = 10;

const requestId = () => `req_${Math.random().toString(36).slice(2, 10)}`;

function apiError(
  status: number,
  code: string,
  message: string,
  opts: { retryable?: boolean; details?: Record<string, unknown> } = {},
) {
  return HttpResponse.json(
    {
      error: {
        code,
        message,
        retryable: opts.retryable ?? status >= 500,
        requestId: requestId(),
        details: opts.details,
      },
    },
    { status, headers: { 'x-request-id': requestId() } },
  );
}

async function pace(base = 180) {
  await delay(demoLab.isOn('slowNetwork') ? base + 2000 : base);
}

/** Wraps a resolver with the session, CSRF and outage checks the real API has. */
function guarded(
  resolver: HttpResponseResolver,
  opts: { mutation?: boolean } = {},
): HttpResponseResolver {
  return async (input) => {
    if (demoLab.isOn('sessionExpired')) {
      return apiError(401, ERROR_CODES.SESSION_EXPIRED, 'Your session has expired.', {
        retryable: false,
      });
    }
    const session = demoStore.current();
    if (!session) {
      return apiError(401, ERROR_CODES.SESSION_EXPIRED, 'Your session has expired.', {
        retryable: false,
      });
    }
    if (opts.mutation) {
      const token = input.request.headers.get(CSRF_HEADER);
      if (token !== session.csrfToken) {
        return apiError(403, ERROR_CODES.UNAUTHORIZED, 'This request could not be verified.', {
          retryable: false,
        });
      }
    }
    return resolver(input);
  };
}

function parseLanguage(value: string | null): Language {
  const parsed = LanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : 'en';
}

export const handlers = [
  http.get(API.config(), async () => {
    await pace(120);
    const config: AppConfig = {
      mode: 'demo',
      limits: {
        maxFileBytes: MAX_FILE_BYTES,
        maxPages: MAX_PAGES,
        acceptedMimeTypes: ['application/pdf'],
        sessionTtlMinutes: demoStore.ttlMinutes,
      },
      supportedLanguages: ['en', 'hi', 'te', 'mr'],
      capabilities: DEMO_CAPABILITIES,
      retentionPolicyUrl: RETENTION_POLICY_FALLBACK_URL,
      sampleFormAvailable: true,
    };
    return HttpResponse.json(config);
  }),

  http.post(API.sessions(), async () => {
    await pace(140);
    // Resume rather than replace: a reload inside the session lifetime must
    // come back to the same answers, so an unexpired session is returned as
    // it stands and only a missing one is created.
    const session = demoStore.current() ?? demoStore.create();
    return HttpResponse.json(
      {
        sessionId: session.sessionId,
        csrfToken: session.csrfToken,
        expiresAt: new Date(session.expiresAt).toISOString(),
      },
      {
        // The real backend sets the session cookie here; the fixture backend
        // keeps the same shape so the client code path is identical.
        headers: { 'set-cookie': `formfix_session=${session.sessionId}; Path=/; HttpOnly; SameSite=Lax` },
      },
    );
  }),

  http.delete(
    API.currentSession(),
    guarded(async () => {
      await pace(200);
      demoStore.destroy();
      return new HttpResponse(null, { status: 204 });
    }, { mutation: true }),
  ),

  http.post(
    API.analyze(),
    guarded(async ({ request }) => {
      await pace(320);
      const contentType = request.headers.get('content-type') ?? '';

      if (contentType.includes('application/json')) {
        const body = (await request.json()) as { sample?: boolean; language?: string };
        if (!body.sample) {
          return apiError(400, 'bad_request', 'Send a file, or ask for the sample document.', {
            retryable: false,
          });
        }
        demoStore.setLanguage(parseLanguage(body.language ?? 'en'));
        demoStore.seedSampleAnswers();
        const job = demoStore.startJob();
        return HttpResponse.json({ formId: job.formId, jobId: job.jobId, status: 'queued' }, { status: 202 });
      }

      const form = await request.formData();
      const file = form.get('file');
      demoStore.setLanguage(parseLanguage(String(form.get('language') ?? 'en')));

      if (!(file instanceof File)) {
        return apiError(400, 'bad_request', 'No file was received.', { retryable: false });
      }
      if (file.type !== 'application/pdf') {
        return apiError(415, ERROR_CODES.UNSUPPORTED_TYPE, 'This build reads PDF files only.', {
          retryable: false,
        });
      }
      if (file.size > MAX_FILE_BYTES) {
        return apiError(413, ERROR_CODES.FILE_TOO_LARGE, 'That file is larger than 10 MB.', {
          retryable: false,
          details: { maxFileBytes: MAX_FILE_BYTES },
        });
      }

      // Demo mode has exactly one document it can describe truthfully. An
      // uploaded copy of the sample is recognised; anything else is refused
      // rather than answered with the wrong document's fields.
      const looksLikeSample = /sample-form/i.test(file.name);
      if (!looksLikeSample) {
        const job = demoStore.startJob({
          code: ERROR_CODES.UNSUPPORTED_TEMPLATE,
          message:
            'Demo data mode can only analyse the bundled sample document. Run the app in live mode against the backend to analyse your own form.',
        });
        return HttpResponse.json({ formId: job.formId, jobId: job.jobId, status: 'queued' }, { status: 202 });
      }

      demoStore.seedSampleAnswers();
      const job = demoStore.startJob();
      return HttpResponse.json({ formId: job.formId, jobId: job.jobId, status: 'queued' }, { status: 202 });
    }, { mutation: true }),
  ),

  http.get(
    '/api/jobs/:jobId',
    guarded(async ({ params }) => {
      await pace(120);
      const session = demoStore.current()!;
      const job = session.job;
      if (!job || job.jobId !== params.jobId) {
        return apiError(404, 'not_found', 'That analysis job is not in this session.', {
          retryable: false,
        });
      }
      const { status, stage } = demoStore.jobProgress(job);
      return HttpResponse.json({
        jobId: job.jobId,
        formId: job.formId,
        status,
        stage,
        error:
          status === 'failed' && job.failure
            ? { ...job.failure, retryable: false, requestId: requestId() }
            : undefined,
      });
    }),
  ),

  http.get(
    '/api/forms/:formId',
    guarded(async ({ params }) => {
      await pace(160);
      if (params.formId !== DEMO_FORM_ID) {
        return apiError(404, 'not_found', 'That form is not in this session.', { retryable: false });
      }
      const session = demoStore.current()!;
      if (!session.formReady && session.job) demoStore.jobProgress(session.job);
      if (!demoStore.current()!.formReady) {
        return apiError(409, 'not_ready', 'This document is still being analysed.', {
          retryable: true,
        });
      }
      return HttpResponse.json(demoStore.toSessionState());
    }),
  ),

  http.get(
    '/api/forms/:formId/document',
    guarded(async () => {
      const response = await fetch(samplePdfUrl);
      const bytes = await response.arrayBuffer();
      return new HttpResponse(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-length': String(bytes.byteLength),
          'cache-control': 'private, max-age=600',
        },
      });
    }),
  ),

  http.patch(
    '/api/forms/:formId/answers',
    guarded(async ({ request }) => {
      await pace(220);
      const body = (await request.json()) as {
        baseRevision: number;
        changes: { fieldId: string; value: unknown; skipped?: boolean }[];
      };

      if (demoLab.consume('failNextSave')) {
        return apiError(500, ERROR_CODES.INTERNAL, 'The save did not reach the server.', {
          retryable: true,
        });
      }

      const session = demoStore.current()!;
      if (demoLab.consume('conflictNextSave')) {
        // Simulate another writer moving the session on.
        demoStore.bumpRevision();
      }
      if (body.baseRevision !== session.revision) {
        return apiError(409, ERROR_CODES.REVISION_CONFLICT, 'This form changed since your last save.', {
          retryable: false,
          details: { currentRevision: session.revision },
        });
      }

      for (const change of body.changes) {
        demoStore.setAnswer(
          change.fieldId,
          change.value as never,
          change.skipped ?? false,
        );
      }
      const revision = demoStore.bumpRevision();
      return HttpResponse.json({ revision, state: demoStore.toSessionState() });
    }, { mutation: true }),
  ),

  http.patch(
    '/api/forms/:formId/documents',
    guarded(async ({ request }) => {
      await pace(200);
      const body = (await request.json()) as {
        baseRevision: number;
        changes: { requirementId: string; ready: boolean }[];
      };
      const session = demoStore.current()!;
      if (body.baseRevision !== session.revision) {
        return apiError(409, ERROR_CODES.REVISION_CONFLICT, 'This form changed since your last save.', {
          retryable: false,
          details: { currentRevision: session.revision },
        });
      }
      for (const change of body.changes) demoStore.setReadiness(change.requirementId, change.ready);
      const revision = demoStore.bumpRevision();
      return HttpResponse.json({ revision, state: demoStore.toSessionState() });
    }, { mutation: true }),
  ),

  http.post(
    '/api/forms/:formId/language',
    guarded(async ({ request }) => {
      await pace(150);
      const body = (await request.json()) as { language: string };
      demoStore.setLanguage(parseLanguage(body.language));
      const revision = demoStore.bumpRevision();
      return HttpResponse.json({ revision, state: demoStore.toSessionState() });
    }, { mutation: true }),
  ),

  http.get(
    '/api/forms/:formId/fields/:fieldId/explanation',
    guarded(async ({ params, request }) => {
      await pace(260);
      if (demoLab.isOn('providerOutage')) {
        return apiError(503, ERROR_CODES.PROVIDER_UNAVAILABLE, 'Explanations are unavailable right now.', {
          retryable: true,
        });
      }
      const language = parseLanguage(new URL(request.url).searchParams.get('language'));
      const explanation = demoExplanation(String(params.fieldId), language);
      if (!explanation) {
        return apiError(404, 'not_found', 'There is no explanation for that field.', {
          retryable: false,
        });
      }
      return HttpResponse.json(explanation);
    }),
  ),

  http.post(
    '/api/forms/:formId/ask',
    guarded(async ({ request }) => {
      await pace(700);
      if (demoLab.isOn('providerOutage')) {
        return apiError(503, ERROR_CODES.PROVIDER_UNAVAILABLE, 'The assistant is unavailable right now.', {
          retryable: true,
        });
      }
      const body = (await request.json()) as {
        question: string;
        fieldId?: string;
        language: string;
      };
      return HttpResponse.json(demoAsk(body.question, body.fieldId, parseLanguage(body.language)));
    }, { mutation: true }),
  ),

  http.post(
    '/api/forms/:formId/validate',
    guarded(async ({ request }) => {
      await pace(420);
      const body = (await request.json()) as { revision: number };
      const session = demoStore.current()!;
      if (body.revision !== session.revision) {
        return apiError(409, ERROR_CODES.REVISION_CONFLICT, 'Your answers changed while checking.', {
          retryable: false,
          details: { currentRevision: session.revision },
        });
      }
      return HttpResponse.json(
        validateDemoForm(demoFormModel, session.answers, session.documentReadiness, session.revision),
      );
    }, { mutation: true }),
  ),

  http.get(
    '/api/forms/:formId/export',
    guarded(async ({ request }) => {
      await pace(260);
      const session = demoStore.current()!;
      const url = new URL(request.url);
      const selected = (url.searchParams.get('fields') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const include = (fieldId: string) => selected.length === 0 || selected.includes(fieldId);

      const summary: ExportSummary = {
        artifact: 'formfix.review-summary',
        artifactVersion: 1,
        disclaimer:
          'This is a FormFix review summary. It is not a completed official application and it has not been submitted anywhere.',
        documentTitle: demoFormModel.title,
        synthetic: demoFormModel.synthetic,
        language: session.language,
        reviewedAt: new Date().toISOString(),
        answers: demoFormModel.fields
          .filter((f) => include(f.id))
          .map((f) => ({
            fieldId: f.id,
            labelOriginal: f.labelOriginal,
            value: session.answers[f.id]?.value ?? null,
            requiredStatus: f.requiredStatus,
          })),
        checklist: demoFormModel.documentRequirements.map((r) => ({
          requirementId: r.id,
          labelOriginal: r.labelOriginal,
          requiredStatus: r.requiredStatus,
          selfReportedReady: session.documentReadiness[r.id]?.ready ?? false,
        })),
        findings: validateDemoForm(
          demoFormModel,
          session.answers,
          session.documentReadiness,
          session.revision,
        ),
      };
      return HttpResponse.json(summary);
    }),
  ),
];
