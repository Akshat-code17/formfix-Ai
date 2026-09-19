import type { Language } from '@formfix/contracts';
import { useMutation } from '@tanstack/react-query';
import { ArrowRight, FileUp, Info, Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { LanguageSelect } from '../../components/common';
import { Alert, Button, Panel } from '../../components/ui/primitives';
import { FormFixApiError, api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { IS_DEMO } from '../../lib/env';
import { prefs } from '../../lib/prefs';
import { useApp } from '../../state/app';

const formatMb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

export function UploadPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { config, isLoading, error: configError, retry } = useApp();

  const [language, setLanguage] = useState<Language>(() => prefs.getLanguage());
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const resumeFormId = prefs.getLastFormId();
  const justDeleted = (location.state as { deleted?: boolean } | null)?.deleted === true;

  useEffect(() => {
    prefs.setLanguage(language);
  }, [language]);

  const analyze = useMutation({
    mutationFn: async (input: { file: File } | { sample: true }) =>
      'sample' in input ? api.analyzeSample(language) : api.analyze(input.file, language),
    onSuccess: (result) => {
      prefs.setLastFormId(result.formId);
      navigate(`/analysis/${result.jobId}`);
    },
  });

  const limits = config?.limits;

  /** Client-side checks are a courtesy; the server decides. */
  const validateLocally = (file: File): string | null => {
    if (!limits) return null;
    const type = file.type || '';
    if (!limits.acceptedMimeTypes.includes(type)) {
      return `${file.name} is not a PDF. This build reads PDF files only.`;
    }
    if (file.size > limits.maxFileBytes) {
      return `${file.name} is ${formatMb(file.size)}. The limit is ${formatMb(limits.maxFileBytes)}.`;
    }
    return null;
  };

  const submitFile = (file: File | undefined) => {
    if (!file) return;
    const problem = validateLocally(file);
    setLocalError(problem);
    if (problem) return;
    analyze.mutate({ file });
  };

  const apiError = analyze.error instanceof FormFixApiError ? analyze.error : null;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        {justDeleted ? (
          <Alert tone="info" className="mb-6" title="Session deleted">
            Your document, answers and checklist have been removed. You can start again below.
          </Alert>
        ) : null}

        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Understand your form. Complete it with confidence.
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          Get simple explanations, a document checklist, and a final check before you submit.
        </p>

        {configError ? (
          <Alert tone="danger" className="mt-8" title="We could not reach the server">
            <p>{configError.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={retry}>
              Try again
            </Button>
          </Alert>
        ) : null}

        <Panel className="mt-8 p-5 sm:p-6">
          <div className="grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <LanguageSelect
              value={language}
              onChange={setLanguage}
              available={config?.supportedLanguages ?? ['en']}
            />
            {config?.sampleFormAvailable ? (
              <Button
                variant="secondary"
                onClick={() => analyze.mutate({ sample: true })}
                loading={analyze.isPending && analyze.variables && 'sample' in analyze.variables}
              >
                Try a sample form
                <ArrowRight aria-hidden className="size-4" />
              </Button>
            ) : null}
          </div>

          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              submitFile(event.dataTransfer.files[0]);
            }}
            className={cn(
              'mt-5 rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-10',
              dragging ? 'border-teal bg-teal-soft' : 'border-line-strong bg-paper',
            )}
          >
            <FileUp aria-hidden className="mx-auto size-8 text-teal" />
            <p className="mt-3 text-base font-medium">Drag your form here</p>
            <p className="mt-1 text-sm text-muted">or choose it from your device</p>

            <input
              ref={inputRef}
              id="form-file"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => {
                submitFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <Button
              className="mt-4"
              variant="primary"
              onClick={() => inputRef.current?.click()}
              loading={analyze.isPending && analyze.variables && 'file' in analyze.variables}
            >
              <Upload aria-hidden className="size-4" />
              Choose a PDF
            </Button>

            {isLoading ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-muted">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Checking what this server allows…
              </p>
            ) : limits ? (
              <p className="mt-4 text-sm text-muted">
                PDF only · up to {formatMb(limits.maxFileBytes)} · up to {limits.maxPages} pages.
                These are the limits this server reported.
              </p>
            ) : null}
          </div>

          {localError ? (
            <Alert tone="danger" className="mt-4" title="That file cannot be used">
              {localError}
            </Alert>
          ) : null}

          {apiError ? (
            <Alert tone="danger" className="mt-4" title="The upload did not go through">
              <p>{apiError.message}</p>
              {apiError.retryable ? (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => analyze.reset()}>
                  Dismiss and try again
                </Button>
              ) : null}
            </Alert>
          ) : null}

          {IS_DEMO ? (
            <Alert tone="warning" className="mt-4" icon={<Info aria-hidden className="size-4" />}>
              Demo data mode analyses only the bundled sample document. Uploading a different file
              shows the “unsupported template” path rather than pretending to read it.
            </Alert>
          ) : null}
        </Panel>

        {resumeFormId ? (
          <Panel className="mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted">You have a form open in this session.</p>
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/form/${resumeFormId}`}>Continue where you left off</Link>
            </Button>
          </Panel>
        ) : null}

        <section className="mt-8 text-sm text-muted">
          <h2 className="text-base font-semibold text-ink">What happens to your document</h2>
          <p className="mt-2 max-w-2xl">
            Your answers are kept in a temporary session on the server, not in an account. Analysing
            a form may send its contents to an external AI service.{' '}
            <Link to="/retention" className="text-teal-ink underline">
              Read what is kept and for how long
            </Link>
            .
          </p>
        </section>
      </div>
    </AppShell>
  );
}
