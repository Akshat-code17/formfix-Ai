import {
  API,
  AnalyzeResponseSchema,
  AppConfigSchema,
  ApiErrorBodySchema,
  ChatAnswerSchema,
  CSRF_HEADER,
  CreateSessionResponseSchema,
  ERROR_CODES,
  ExplanationSchema,
  ExportSummarySchema,
  JobSchema,
  PatchResultSchema,
  SessionStateSchema,
  ValidationReportSchema,
  type AnalyzeResponse,
  type AnswerChange,
  type AppConfig,
  type ChatAnswer,
  type DocumentChange,
  type ErrorCode,
  type ExportSummary,
  type Explanation,
  type Job,
  type Language,
  type PatchResult,
  type SessionState,
  type ValidationReport,
} from '@formfix/contracts';
import { API_PREFIX, IS_DEMO } from './env';
import { Backend as B } from '@formfix/contracts';
import * as bridge from './backend-adapter';

/** A failure the UI can reason about, rather than a bare Error. */
export class FormFixApiError extends Error {
  readonly code: ErrorCode | string;
  readonly retryable: boolean;
  readonly requestId: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(init: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
    status: number;
    details?: Record<string, unknown>;
  }) {
    super(init.message);
    this.name = 'FormFixApiError';
    this.code = init.code;
    this.retryable = init.retryable;
    this.requestId = init.requestId;
    this.status = init.status;
    this.details = init.details;
  }

  get isConflict() {
    return this.status === 409 || this.code === ERROR_CODES.REVISION_CONFLICT;
  }

  get isSessionGone() {
    return (
      this.status === 401 ||
      this.code === ERROR_CODES.SESSION_EXPIRED ||
      this.code === ERROR_CODES.UNAUTHORIZED
    );
  }
}

/**
 * The CSRF token is held in memory only. The session itself lives in an
 * HttpOnly cookie the browser sets and we never read.
 */
let csrfToken: string | null = null;
let sessionCreation: Promise<void> | null = null;
export const setCsrfToken = (token: string | null) => {
  csrfToken = token;
};
export const getCsrfToken = () => csrfToken;

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  query?: Record<string, string | undefined>;
};

function withQuery(path: string, query?: RequestOptions['query']) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) params.set(k, v);
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

async function toApiError(response: Response): Promise<FormFixApiError> {
  let code = ERROR_CODES.INTERNAL as string;
  let message = 'Something went wrong on our side.';
  let retryable = response.status >= 500;
  let requestId = response.headers.get('x-request-id') ?? 'unknown';
  let details: Record<string, unknown> | undefined;

  try {
    const parsed = ApiErrorBodySchema.safeParse(await response.json());
    if (parsed.success) {
      ({ code, message, retryable, requestId } = parsed.data.error);
      details = parsed.data.error.details;
    }
  } catch {
    // Body was not JSON. Keep the generic message rather than inventing one.
  }

  return new FormFixApiError({ code, message, retryable, requestId, status: response.status, details });
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const method = options.method ?? 'GET';
  if (method !== 'GET' && path !== API.sessions() && !csrfToken)
    await api.createSession();
  const headers = new Headers();
  if (options.body !== undefined) headers.set('content-type', 'application/json');
  if (method !== 'GET' && csrfToken) headers.set(IS_DEMO ? CSRF_HEADER : 'x-csrf-token', csrfToken);

  let response: Response;
  try {
    response = await fetch(withQuery(`${API_PREFIX}${path}`, options.query), {
      method,
      headers,
      credentials: 'include',
      signal: options.signal,
      body: options.formData ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new FormFixApiError({
      code: ERROR_CODES.NETWORK,
      message: 'We could not reach the server. Check your connection and try again.',
      retryable: true,
      requestId: 'client',
      status: 0,
    });
  }

  if (!response.ok) throw await toApiError(response);
  return response;
}

async function json<T>(path: string, schema: { parse: (v: unknown) => T }, options?: RequestOptions) {
  const response = await request(path, options);
  try { return schema.parse(await response.json()); } catch {
    throw new FormFixApiError({ code: 'invalid_response', message: 'The server response did not match the expected contract.', retryable: false, requestId: response.headers.get('x-request-id') ?? 'client', status: response.status });
  }
}

export const api = {
  async getConfig(signal?: AbortSignal): Promise<AppConfig> {
    return json(API.config(), IS_DEMO ? AppConfigSchema : { parse: bridge.configFromBackend }, { signal });
  },

  /** Creates the guest session and stores the CSRF token for later mutations. */
  async createSession(): Promise<void> {
    if (!sessionCreation) {
      sessionCreation = (async () => {
        const result = await json(API.sessions(), IS_DEMO ? CreateSessionResponseSchema : B.SessionResult, { method: 'POST', body: {} });
        setCsrfToken(result.csrfToken);
      })().finally(() => { sessionCreation = null; });
    }
    await sessionCreation;
  },

  async analyze(file: File, language: Language): Promise<AnalyzeResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('language', language);
    return json(API.analyze(), AnalyzeResponseSchema, { method: 'POST', formData });
  },

  /** Starts the bundled sample document without asking the user to upload one. */
  async analyzeSample(language: Language): Promise<AnalyzeResponse> {
    if (!IS_DEMO) {
      const response = await fetch('/samples/backend-sample.pdf');
      if (!response.ok) throw new FormFixApiError({ code: 'sample_unavailable', message: 'The sample PDF is unavailable.', retryable: true, requestId: 'client', status: response.status });
      return api.analyze(new File([await response.blob()], 'sample-student-support.pdf', { type: 'application/pdf' }), language);
    }
    return json(API.analyze(), AnalyzeResponseSchema, {
      method: 'POST',
      body: { sample: true, language },
    });
  },

  async getJob(jobId: string, signal?: AbortSignal): Promise<Job> {
    return json(API.job(jobId), IS_DEMO ? JobSchema : { parse: raw => bridge.jobFromBackend(raw, jobId) }, { signal });
  },

  async getForm(formId: string, signal?: AbortSignal): Promise<SessionState> {
    return json(API.form(formId), IS_DEMO ? SessionStateSchema : { parse: bridge.stateFromBackend }, { signal });
  },

  documentUrl(formId: string) {
    return `${API_PREFIX}${API.document(formId)}`;
  },

  async patchAnswers(
    formId: string,
    baseRevision: number,
    changes: AnswerChange[],
    signal?: AbortSignal,
  ): Promise<PatchResult> {
    if (!IS_DEMO) {
      await json(API.answers(formId), B.SavedAnswers, { method: 'PATCH', body: bridge.answersToBackend(baseRevision, changes), signal });
      const state = await api.getForm(formId, signal);
      return { revision: state.revision, state };
    }
    return json(API.answers(formId), PatchResultSchema, {
      method: 'PATCH',
      body: { baseRevision, changes },
      signal,
    });
  },

  async patchDocuments(
    formId: string,
    baseRevision: number,
    changes: DocumentChange[],
    signal?: AbortSignal,
  ): Promise<PatchResult> {
    if (!IS_DEMO) {
      await json(API.documents(formId), B.SavedDocuments, { method: 'PATCH', body: bridge.documentsToBackend(baseRevision, changes), signal });
      const state = await api.getForm(formId, signal);
      return { revision: state.revision, state };
    }
    return json(API.documents(formId), PatchResultSchema, {
      method: 'PATCH',
      body: { baseRevision, changes },
      signal,
    });
  },

  async setLanguage(formId: string, language: Language): Promise<PatchResult> {
    if (!IS_DEMO) {
      const state = await json(API.language(formId), { parse: bridge.stateFromBackend }, { method: 'POST', body: { language } });
      return { revision: state.revision, state };
    }
    return json(API.language(formId), PatchResultSchema, { method: 'POST', body: { language } });
  },

  async getExplanation(
    formId: string,
    fieldId: string,
    language: Language,
    signal?: AbortSignal,
  ): Promise<Explanation> {
    return json(API.explanation(formId, fieldId), IS_DEMO ? ExplanationSchema : { parse: bridge.explanationFromBackend }, { query: { language }, signal });
  },

  async ask(
    formId: string,
    body: { question: string; fieldId?: string; language: Language },
    signal?: AbortSignal,
  ): Promise<ChatAnswer> {
    return json(API.ask(formId), ChatAnswerSchema, { method: 'POST', body, signal });
  },

  async validate(formId: string, revision: number, signal?: AbortSignal): Promise<ValidationReport> {
    return json(API.validate(formId), IS_DEMO ? ValidationReportSchema : { parse: bridge.reportFromBackend }, {
      method: 'POST',
      body: { revision },
      signal,
    });
  },

  async exportSummary(formId: string, fieldIds: string[]): Promise<ExportSummary> {
    return json(API.exportSummary(formId), IS_DEMO ? ExportSummarySchema : { parse: raw => bridge.exportFromBackend(raw, fieldIds) }, {
      query: { format: 'json', fields: fieldIds.join(',') },
    });
  },

  async deleteSession(): Promise<void> {
    await request(API.currentSession(), { method: 'DELETE' });
    setCsrfToken(null);
  },
};
