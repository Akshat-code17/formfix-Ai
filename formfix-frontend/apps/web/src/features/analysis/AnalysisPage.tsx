import type { JobStage } from '@formfix/contracts';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Alert, Button, Panel } from '../../components/ui/primitives';
import { FormFixApiError, api } from '../../lib/api';
import { cn } from '../../lib/cn';

/** The stages the server actually reports. No invented percentages. */
const STAGES: { key: JobStage; label: string; detail: string }[] = [
  { key: 'uploaded', label: 'Received', detail: 'The document reached the server.' },
  { key: 'extracting', label: 'Reading the pages', detail: 'Pulling out the text and its positions.' },
  { key: 'structuring', label: 'Finding the fields', detail: 'Grouping questions into sections.' },
  { key: 'ready', label: 'Ready', detail: 'The guide is prepared.' },
];

export function AnalysisPage() {
  const { jobId = '' } = useParams();
  const navigate = useNavigate();

  const job = useQuery({
    queryKey: ['job', jobId],
    queryFn: ({ signal }) => api.getJob(jobId, signal),
    // Polling continues from wherever the server is. Leaving this page does
    // not cancel the job; coming back picks the same job up again.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'ready' || status === 'needs_review' || status === 'failed' ? false : 700;
    },
    // The job runs on the server whether or not this tab has focus, so the
    // poll must keep going when the user switches away and comes back.
    refetchIntervalInBackground: true,
    retry: 1,
  });

  const done = job.data?.status === 'ready' || job.data?.status === 'needs_review';

  const form = useQuery({
    queryKey: ['form', job.data?.formId],
    queryFn: ({ signal }) => api.getForm(job.data!.formId, signal),
    enabled: done && Boolean(job.data?.formId),
  });

  const currentStageIndex = STAGES.findIndex((s) => s.key === (job.data?.stage ?? 'uploaded'));
  const failed = job.data?.status === 'failed';
  const loadError = job.error instanceof FormFixApiError ? job.error : null;

  return (
    <AppShell sessionActive>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Reading your form</h1>
        <p className="mt-2 text-muted">
          This runs on the server. You can leave this page and come back — the work carries on.
        </p>

        {loadError ? (
          <Alert tone="danger" className="mt-6" title="We lost track of this analysis">
            <p>{loadError.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" asChild>
              <Link to="/">Start again</Link>
            </Button>
          </Alert>
        ) : null}

        <Panel className="mt-6 p-5">
          <ol className="space-y-3">
            {STAGES.map((stage, index) => {
              const state =
                failed && index >= currentStageIndex
                  ? 'failed'
                  : index < currentStageIndex || (done && stage.key === 'ready')
                    ? 'done'
                    : index === currentStageIndex
                      ? 'active'
                      : 'waiting';
              return (
                <li key={stage.key} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border',
                      state === 'done'
                        ? 'border-teal bg-teal text-white'
                        : state === 'active'
                          ? 'border-teal bg-teal-soft text-teal-ink'
                          : state === 'failed'
                            ? 'border-danger-edge bg-danger-soft text-danger'
                            : 'border-line bg-paper text-muted',
                    )}
                  >
                    {state === 'done' ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : state === 'active' ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : state === 'failed' ? (
                      <AlertTriangle className="size-3.5" />
                    ) : null}
                  </span>
                  <div>
                    <p className={cn('font-medium', state === 'waiting' && 'text-muted')}>
                      {stage.label}
                      {state === 'active' ? <span className="sr-only"> — in progress</span> : null}
                    </p>
                    <p className="text-sm text-muted">{stage.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="sr-only" aria-live="polite">
            {failed ? 'Analysis failed.' : done ? 'Analysis finished.' : `Stage: ${job.data?.stage ?? 'starting'}`}
          </p>
        </Panel>

        {failed ? (
          <Alert tone="danger" className="mt-6" title="This document could not be analysed">
            <p>{job.data?.error?.message ?? 'The analysis did not finish.'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" asChild>
                <Link to="/">Try a different file</Link>
              </Button>
            </div>
          </Alert>
        ) : null}

        {done && form.data ? (
          <Panel className="enter-fade-up mt-6 p-5">
            <h2 className="text-lg font-semibold">What we found</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted">Questions</dt>
                <dd className="text-2xl font-semibold">{form.data.form.fields.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Documents asked for</dt>
                <dd className="text-2xl font-semibold">{form.data.form.documentRequirements.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-muted">Items needing review</dt>
                <dd className="text-2xl font-semibold">{form.data.form.extractionWarnings.length}</dd>
              </div>
            </dl>

            {form.data.form.extractionWarnings.length > 0 ? (
              <Alert tone="warning" className="mt-4" title="Some things we could not settle">
                <ul className="list-disc space-y-1 pl-5">
                  {form.data.form.extractionWarnings.map((warning) => (
                    <li key={warning.id}>{warning.message}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  These are gaps in what we could read from the document, not mistakes in your
                  answers.
                </p>
              </Alert>
            ) : null}

            {form.data.form.synthetic ? (
              <Alert tone="warning" className="mt-4" title="Synthetic document">
                “{form.data.form.title}” is a made-up document written for this demo. It is not an
                official scheme and no institution issues it.
              </Alert>
            ) : null}

            <Button
              className="mt-5"
              variant="primary"
              size="lg"
              onClick={() => navigate(`/form/${form.data!.form.formId}`)}
            >
              Open the guide
            </Button>
          </Panel>
        ) : null}
      </div>
    </AppShell>
  );
}
