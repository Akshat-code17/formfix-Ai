import {
  SCHEMA_VERSION,
  type Answer,
  type Capabilities,
  type DocumentReadiness,
  type JobStage,
  type JobStatus,
  type Language,
  type SessionState,
} from '@formfix/contracts';
import {
  DEMO_FORM_ID,
  demoFormModel,
  demoSeededAnswers,
  demoSeededReadiness,
} from '@formfix/fixtures-demo';

const STORE_KEY = 'formfix.demo.session';
const SESSION_TTL_MINUTES = 90;

export const DEMO_CAPABILITIES: Capabilities = {
  explanations: true,
  chat: true,
  validation: true,
  exportJson: true,
  documentStream: true,
  languages: ['en', 'hi', 'te', 'mr'],
};

export type DemoJob = {
  jobId: string;
  formId: string;
  startedAt: number;
  /** Set when the upload was rejected outright. */
  failure?: { code: string; message: string };
};

export type DemoSession = {
  sessionId: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
  revision: number;
  language: Language;
  answers: Record<string, Answer>;
  documentReadiness: Record<string, DocumentReadiness>;
  job: DemoJob | null;
  /** Which page count the extraction reported, for the ready screen. */
  formReady: boolean;
};

let session: DemoSession | null = null;

function persist() {
  try {
    sessionStorage.setItem(STORE_KEY, JSON.stringify(session));
  } catch {
    // Non-fatal: the demo just will not survive a reload.
  }
}

function restore(): DemoSession | null {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoSession;
    if (parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

const id = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

export const demoStore = {
  current(): DemoSession | null {
    if (!session) session = restore();
    return session;
  },

  create(): DemoSession {
    const now = Date.now();
    session = {
      sessionId: id('sess'),
      csrfToken: id('csrf'),
      createdAt: now,
      expiresAt: now + SESSION_TTL_MINUTES * 60_000,
      revision: 0,
      language: 'en',
      answers: {},
      documentReadiness: {},
      job: null,
      formReady: false,
    };
    persist();
    return session;
  },

  /**
   * The sample session starts part-filled so the final check has the three
   * seeded mistakes to find. The screen says so before the user gets there.
   */
  seedSampleAnswers() {
    const s = this.current();
    if (!s) return;
    s.answers = structuredClone(demoSeededAnswers);
    s.documentReadiness = structuredClone(demoSeededReadiness);
    s.revision += 1;
    persist();
  },

  startJob(failure?: DemoJob['failure']): DemoJob {
    const s = this.current();
    if (!s) throw new Error('no session');
    s.job = { jobId: id('job'), formId: DEMO_FORM_ID, startedAt: Date.now(), failure };
    s.formReady = false;
    persist();
    return s.job;
  },

  /** Stage is derived from elapsed time, so navigating away cannot cancel it. */
  jobProgress(job: DemoJob): { status: JobStatus; stage: JobStage } {
    if (job.failure) {
      const elapsed = Date.now() - job.startedAt;
      return elapsed < 900
        ? { status: 'running', stage: 'extracting' }
        : { status: 'failed', stage: 'failed' };
    }
    const elapsed = Date.now() - job.startedAt;
    if (elapsed < 600) return { status: 'queued', stage: 'uploaded' };
    if (elapsed < 1800) return { status: 'running', stage: 'extracting' };
    if (elapsed < 3000) return { status: 'running', stage: 'structuring' };

    const s = this.current();
    if (s && !s.formReady) {
      s.formReady = true;
      persist();
    }
    // The demo document has two extraction items a person should look at,
    // so the job finishes as `needs_review`, not a clean `ready`.
    return { status: 'needs_review', stage: 'ready' };
  },

  bumpRevision(): number {
    const s = this.current();
    if (!s) throw new Error('no session');
    s.revision += 1;
    persist();
    return s.revision;
  },

  setAnswer(fieldId: string, value: Answer['value'], skipped: boolean) {
    const s = this.current();
    if (!s) return;
    s.answers[fieldId] = { value, skipped, updatedAt: new Date().toISOString() };
  },

  setReadiness(requirementId: string, ready: boolean) {
    const s = this.current();
    if (!s) return;
    s.documentReadiness[requirementId] = { ready, updatedAt: new Date().toISOString() };
  },

  setLanguage(language: Language) {
    const s = this.current();
    if (!s) return;
    s.language = language;
    persist();
  },

  save() {
    persist();
  },

  destroy() {
    session = null;
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch {
      // ignore
    }
  },

  toSessionState(): SessionState {
    const s = this.current();
    if (!s) throw new Error('no session');
    return {
      form: { ...demoFormModel, schemaVersion: SCHEMA_VERSION },
      language: s.language,
      revision: s.revision,
      answers: s.answers,
      documentReadiness: s.documentReadiness,
      updatedAt: new Date().toISOString(),
      expiresAt: new Date(s.expiresAt).toISOString(),
      capabilities: DEMO_CAPABILITIES,
    };
  },

  ttlMinutes: SESSION_TTL_MINUTES,
};
