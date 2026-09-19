import type {
  Answer,
  AnswerValue,
  Language,
  SessionState,
  ValidationReport,
} from '@formfix/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { FormFixApiError, api } from '../lib/api';
import { prefs } from '../lib/prefs';

const SAVE_DEBOUNCE_MS = 600;
const MAX_CONFLICT_RETRIES = 2;

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved'; at: number }
  | { status: 'failed'; error: FormFixApiError };

type PendingAnswer = { value: AnswerValue; skipped: boolean };

type SessionContextValue = {
  formId: string;
  state: SessionState | undefined;
  isLoading: boolean;
  loadError: FormFixApiError | null;
  refetch: () => void;

  /** Saved value merged with anything the user has typed but not yet saved. */
  valueOf: (fieldId: string) => AnswerValue;
  answerOf: (fieldId: string) => Answer | undefined;
  /** Saved + pending answers, in the shape the shared helpers expect. */
  effectiveAnswers: Record<string, Answer | undefined>;
  isSkipped: (fieldId: string) => boolean;
  hasUnsavedEdit: (fieldId: string) => boolean;

  setAnswer: (fieldId: string, value: AnswerValue) => void;
  setSkipped: (fieldId: string, skipped: boolean) => void;
  setReadiness: (requirementId: string, ready: boolean) => void;

  saveState: SaveState;
  retrySave: () => void;
  unsavedCount: number;

  language: Language;
  setLanguage: (language: Language) => void;
  languagePending: boolean;

  report: ValidationReport | null;
  reportStale: boolean;
  runValidation: () => void;
  validationPending: boolean;
  validationError: FormFixApiError | null;
  clearReport: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const ctx = use(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside <SessionProvider>');
  return ctx;
}

export function SessionProvider({ formId, children }: { formId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ['form', formId] as const, [formId]);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => api.getForm(formId, signal),
    retry: (failureCount, error) =>
      error instanceof FormFixApiError && error.retryable && failureCount < 3,
    staleTime: 10_000,
  });

  const state = query.data;

  // ---- local drafts -------------------------------------------------------
  // What the user has typed. Always wins over the saved value, including
  // through a failed save or a revision conflict.
  const [drafts, setDrafts] = useState<Record<string, PendingAnswer>>({});
  const [readinessDrafts, setReadinessDrafts] = useState<Record<string, boolean>>({});

  // ---- save queue ---------------------------------------------------------
  const pendingAnswers = useRef(new Map<string, PendingAnswer>());
  const pendingDocs = useRef(new Map<string, boolean>());
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revisionRef = useRef(0);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });
  const [unsavedCount, setUnsavedCount] = useState(0);

  useEffect(() => {
    if (state) revisionRef.current = state.revision;
  }, [state?.revision, state]);

  const syncUnsavedCount = useCallback(() => {
    setUnsavedCount(pendingAnswers.current.size + pendingDocs.current.size);
  }, []);

  const flush = useCallback(
    async (attempt = 0): Promise<void> => {
      if (flushing.current) return;
      if (pendingAnswers.current.size === 0 && pendingDocs.current.size === 0) return;

      flushing.current = true;
      setSaveState({ status: 'saving' });

      // Snapshot and clear, so edits made during the request queue up for the
      // next pass instead of racing this one.
      const answerBatch = new Map(pendingAnswers.current);
      const docBatch = new Map(pendingDocs.current);
      pendingAnswers.current.clear();
      pendingDocs.current.clear();
      syncUnsavedCount();

      const restore = () => {
        // Newer edits take priority: only put back what has not been retyped.
        for (const [id, v] of answerBatch) if (!pendingAnswers.current.has(id)) pendingAnswers.current.set(id, v);
        for (const [id, v] of docBatch) if (!pendingDocs.current.has(id)) pendingDocs.current.set(id, v);
        syncUnsavedCount();
      };

      try {
        if (answerBatch.size > 0) {
          const result = await api.patchAnswers(
            formId,
            revisionRef.current,
            [...answerBatch].map(([fieldId, v]) => ({
              fieldId,
              value: v.value,
              skipped: v.skipped,
            })),
          );
          revisionRef.current = result.revision;
          queryClient.setQueryData(queryKey, result.state);
        }

        if (docBatch.size > 0) {
          const result = await api.patchDocuments(
            formId,
            revisionRef.current,
            [...docBatch].map(([requirementId, ready]) => ({ requirementId, ready })),
          );
          revisionRef.current = result.revision;
          queryClient.setQueryData(queryKey, result.state);
        }

        setSaveState({ status: 'saved', at: Date.now() });
        flushing.current = false;

        if (pendingAnswers.current.size > 0 || pendingDocs.current.size > 0) await flush(0);
        return;
      } catch (error) {
        flushing.current = false;
        restore();

        if (error instanceof FormFixApiError && error.isConflict && attempt < MAX_CONFLICT_RETRIES) {
          // Someone else moved the session on. Take their revision, keep our
          // edits, and replay them on top rather than dropping either side.
          const fresh = await queryClient.fetchQuery({
            queryKey,
            queryFn: ({ signal }) => api.getForm(formId, signal),
          });
          revisionRef.current = fresh.revision;
          return flush(attempt + 1);
        }

        setSaveState({
          status: 'failed',
          error:
            error instanceof FormFixApiError
              ? error
              : new FormFixApiError({
                  code: 'internal',
                  message: 'The save did not go through.',
                  retryable: true,
                  requestId: 'client',
                  status: 0,
                }),
        });
        return;
      }
    },
    [formId, queryClient, queryKey, syncUnsavedCount],
  );

  const scheduleFlush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void flush();
    }, SAVE_DEBOUNCE_MS);
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Last-chance save when the tab goes away, so a debounce in flight is not
  // silently lost. This is best effort and the UI never claims it succeeded.
  useEffect(() => {
    const onHide = () => {
      if (pendingAnswers.current.size > 0 || pendingDocs.current.size > 0) void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [flush]);

  const setAnswer = useCallback(
    (fieldId: string, value: AnswerValue) => {
      const skipped = false;
      setDrafts((d) => ({ ...d, [fieldId]: { value, skipped } }));
      pendingAnswers.current.set(fieldId, { value, skipped });
      syncUnsavedCount();
      scheduleFlush();
    },
    [scheduleFlush, syncUnsavedCount],
  );

  const setSkipped = useCallback(
    (fieldId: string, skipped: boolean) => {
      setDrafts((d) => {
        const current = d[fieldId];
        const value = current?.value ?? null;
        return { ...d, [fieldId]: { value, skipped } };
      });
      const existing = pendingAnswers.current.get(fieldId);
      pendingAnswers.current.set(fieldId, {
        value: existing?.value ?? drafts[fieldId]?.value ?? state?.answers[fieldId]?.value ?? null,
        skipped,
      });
      syncUnsavedCount();
      scheduleFlush();
    },
    [drafts, scheduleFlush, state?.answers, syncUnsavedCount],
  );

  const setReadiness = useCallback(
    (requirementId: string, ready: boolean) => {
      setReadinessDrafts((d) => ({ ...d, [requirementId]: ready }));
      pendingDocs.current.set(requirementId, ready);
      syncUnsavedCount();
      scheduleFlush();
    },
    [scheduleFlush, syncUnsavedCount],
  );

  const retrySave = useCallback(() => {
    void flush();
  }, [flush]);

  // ---- derived answers ----------------------------------------------------
  const effectiveAnswers = useMemo(() => {
    const merged: Record<string, Answer | undefined> = { ...(state?.answers ?? {}) };
    for (const [fieldId, draft] of Object.entries(drafts)) {
      merged[fieldId] = {
        value: draft.value,
        skipped: draft.skipped,
        updatedAt: new Date().toISOString(),
      };
    }
    return merged;
  }, [state?.answers, drafts]);

  const valueOf = useCallback(
    (fieldId: string): AnswerValue => effectiveAnswers[fieldId]?.value ?? null,
    [effectiveAnswers],
  );
  const answerOf = useCallback(
    (fieldId: string) => effectiveAnswers[fieldId],
    [effectiveAnswers],
  );
  const isSkipped = useCallback(
    (fieldId: string) => effectiveAnswers[fieldId]?.skipped === true,
    [effectiveAnswers],
  );
  const hasUnsavedEdit = useCallback(
    (fieldId: string) => pendingAnswers.current.has(fieldId),
    // unsavedCount is the signal that the map changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unsavedCount],
  );

  const effectiveReadiness = useMemo(() => {
    const merged = { ...(state?.documentReadiness ?? {}) };
    for (const [id, ready] of Object.entries(readinessDrafts)) {
      merged[id] = { ready, updatedAt: new Date().toISOString() };
    }
    return merged;
  }, [state?.documentReadiness, readinessDrafts]);

  // ---- language -----------------------------------------------------------
  const [languageOverride, setLanguageOverride] = useState<Language | null>(null);
  const languageMutation = useMutation({
    mutationFn: (language: Language) => api.setLanguage(formId, language),
    onSuccess: (result) => {
      revisionRef.current = result.revision;
      queryClient.setQueryData(queryKey, result.state);
      setLanguageOverride(null);
    },
  });

  const language = languageOverride ?? state?.language ?? prefs.getLanguage();

  const setLanguage = useCallback(
    (next: Language) => {
      // Switching language changes explanations only. Answers are canonical
      // values and are never translated or rewritten.
      setLanguageOverride(next);
      prefs.setLanguage(next);
      languageMutation.mutate(next);
    },
    [languageMutation],
  );

  // ---- validation ---------------------------------------------------------
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [validationError, setValidationError] = useState<FormFixApiError | null>(null);
  const validationMutation = useMutation({
    mutationFn: async () => {
      // Get every pending edit to the server first: the check runs against
      // saved state, never against what is still sitting in the browser.
      if (timer.current) clearTimeout(timer.current);
      await flush();
      // A save can already be running when Check is pressed. Await its queue,
      // and never validate an older revision after an unsuccessful save.
      const deadline = Date.now() + 30000;
      while (flushing.current && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 25));
      if (flushing.current || pendingAnswers.current.size || pendingDocs.current.size)
        throw new FormFixApiError({ code: 'unsaved_changes', message: 'Save your changes successfully before running the check.', retryable: true, requestId: 'client', status: 0 });
      try {
        return await api.validate(formId, revisionRef.current);
      } catch (error) {
        // The revision moved between the flush and the check — a language
        // change landing, for instance. Take the current one and check that,
        // rather than reporting a conflict the user cannot act on.
        if (!(error instanceof FormFixApiError) || !error.isConflict) throw error;
        const fresh = await queryClient.fetchQuery({
          queryKey,
          queryFn: ({ signal }) => api.getForm(formId, signal),
        });
        revisionRef.current = fresh.revision;
        return api.validate(formId, fresh.revision);
      }
    },
    onSuccess: (result) => {
      setReport(result);
      setValidationError(null);
    },
    onError: (error) => {
      setValidationError(error instanceof FormFixApiError ? error : null);
    },
  });

  const currentRevision = state?.revision ?? 0;
  const reportStale = report !== null && (report.revision !== currentRevision || unsavedCount > 0 || saveState.status === 'saving' || saveState.status === 'failed');

  const value: SessionContextValue = {
    formId,
    state: state ? { ...state, documentReadiness: effectiveReadiness } : undefined,
    isLoading: query.isLoading,
    loadError: query.error instanceof FormFixApiError ? query.error : null,
    refetch: () => void query.refetch(),

    valueOf,
    answerOf,
    effectiveAnswers,
    isSkipped,
    hasUnsavedEdit,

    setAnswer,
    setSkipped,
    setReadiness,

    saveState,
    retrySave,
    unsavedCount,

    language,
    setLanguage,
    languagePending: languageMutation.isPending,

    report,
    reportStale,
    runValidation: () => validationMutation.mutate(),
    validationPending: validationMutation.isPending,
    validationError,
    clearReport: () => setReport(null),
  };

  return <SessionContext value={value}>{children}</SessionContext>;
}
