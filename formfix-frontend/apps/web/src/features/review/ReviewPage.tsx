import type { ValidationIssue } from '@formfix/contracts';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CircleCheck, Download, Info, Printer, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SourceChip } from '../../components/common';
import { CheckboxControl } from '../../components/ui/controls';
import { Alert, Badge, Button, Panel } from '../../components/ui/primitives';
import { FormFixApiError, api } from '../../lib/api';
import { useSession } from '../../state/session';
import { useSourceView } from '../workspace/FormLayout';
import { PrintSummary } from './PrintSummary';

function IssueCard({
  issue,
  tone,
  fixHref,
  onOpenSource,
}: {
  issue: ValidationIssue;
  tone: 'danger' | 'warning' | 'neutral';
  fixHref: string;
  onOpenSource: (source: ValidationIssue['sources'][number]) => void;
}) {
  return (
    <li>
      <Panel
        className={
          tone === 'danger'
            ? 'border-danger-edge p-4'
            : tone === 'warning'
              ? 'border-amber-edge p-4'
              : 'p-4'
        }
      >
        <p className="font-medium">{issue.message}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" asChild>
            <Link to={fixHref}>Fix this</Link>
          </Button>
          {issue.sources.slice(0, 2).map((source) => (
            <SourceChip key={source.id} source={source} onOpen={onOpenSource} />
          ))}
        </div>
      </Panel>
    </li>
  );
}

export function ReviewPage() {
  const session = useSession();
  const { showSource } = useSourceView();
  const form = session.state!.form;
  const report = session.report;

  const [selected, setSelected] = useState<Set<string>>(() => new Set(form.fields.map((f) => f.id)));
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fixHrefForField = (fieldId?: string) =>
    fieldId ? `/form/${session.formId}?field=${fieldId}` : `/form/${session.formId}`;

  const errors = (report?.issues ?? []).filter((i) => i.severity === 'error' && !i.requirementId);
  const gaps = (report?.issues ?? []).filter((i) => i.severity === 'error' && i.requirementId);
  const warnings = (report?.issues ?? []).filter((i) => i.severity === 'warning');
  const manual = (report?.issues ?? []).filter((i) => i.severity === 'manual_review');

  const download = useMutation({
    mutationFn: () => api.exportSummary(session.formId, [...selected]),
    onSuccess: (summary) => {
      setDownloadError(null);
      const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'formfix-review-summary.json';
      anchor.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) =>
      setDownloadError(
        error instanceof FormFixApiError ? error.message : 'The summary could not be downloaded.',
      ),
  });

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="no-print">
        <h1 className="text-2xl font-semibold">Form check</h1>
        <p className="mt-2 text-muted">
          These are deterministic checks against what the form itself says. They cannot tell you
          whether an application will be accepted.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            variant="primary"
            size="lg"
            loading={session.validationPending}
            onClick={session.runValidation}
          >
            {report ? 'Check again' : 'Run the check'}
          </Button>
          {report ? (
            <p className="text-sm text-muted">
              Last checked {new Date(report.checkedAt).toLocaleTimeString()}
            </p>
          ) : null}
        </div>

        {session.validationError ? (
          <Alert tone="danger" className="mt-4" title="The check did not run">
            <p>{session.validationError.message}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={session.runValidation}>
              Try again
            </Button>
          </Alert>
        ) : null}

        {report && session.reportStale ? (
          <Alert tone="warning" className="mt-4" title="These results are out of date">
            You have changed an answer since this check ran. Run it again to see where you stand.
          </Alert>
        ) : null}

        {report ? (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: 'Must fix', value: errors.length, tone: 'danger' as const },
                { label: 'Documents missing', value: gaps.length, tone: 'danger' as const },
                { label: 'Worth a look', value: warnings.length, tone: 'warning' as const },
                { label: 'Needs your judgement', value: manual.length, tone: 'warning' as const },
              ].map((item) => (
                <Panel key={item.label} className="p-3">
                  <dt className="text-sm text-muted">{item.label}</dt>
                  <dd
                    className={
                      item.value === 0
                        ? 'text-2xl font-semibold'
                        : item.tone === 'danger'
                          ? 'text-2xl font-semibold text-danger'
                          : 'text-2xl font-semibold text-amber'
                    }
                  >
                    {item.value}
                  </dd>
                </Panel>
              ))}
            </dl>

            {errors.length === 0 && gaps.length === 0 ? (
              <Alert
                tone="info"
                className="mt-5"
                title="No issues found by the configured checks"
                icon={<CircleCheck aria-hidden className="size-5 text-teal" />}
              >
                This is not approval and not a guarantee of acceptance. It means the checks that are
                configured found nothing to flag.
                {manual.length > 0
                  ? ' There are still items below that only you can settle.'
                  : ''}
              </Alert>
            ) : null}

            {errors.length > 0 ? (
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <XCircle aria-hidden className="size-5 text-danger" />
                  Must fix ({errors.length})
                </h2>
                <ul className="mt-3 space-y-3">
                  {errors.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      tone="danger"
                      fixHref={fixHrefForField(issue.fieldId)}
                      onOpenSource={showSource}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {gaps.length > 0 ? (
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <XCircle aria-hidden className="size-5 text-danger" />
                  Documents not marked ready ({gaps.length})
                </h2>
                <ul className="mt-3 space-y-3">
                  {gaps.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      tone="danger"
                      fixHref={`/form/${session.formId}/checklist`}
                      onOpenSource={showSource}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {warnings.length > 0 ? (
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <AlertTriangle aria-hidden className="size-5 text-amber" />
                  Worth a look ({warnings.length})
                </h2>
                <ul className="mt-3 space-y-3">
                  {warnings.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      tone="warning"
                      fixHref={fixHrefForField(issue.fieldId)}
                      onOpenSource={showSource}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {manual.length > 0 ? (
              <section className="mt-6">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Info aria-hidden className="size-5 text-amber" />
                  Only you can settle these ({manual.length})
                </h2>
                <p className="mt-1 text-sm text-muted">
                  The form does not say enough for an automatic check to decide.
                </p>
                <ul className="mt-3 space-y-3">
                  {manual.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      tone="neutral"
                      fixHref={
                        issue.requirementId
                          ? `/form/${session.formId}/checklist`
                          : fixHrefForField(issue.fieldId)
                      }
                      onOpenSource={showSource}
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : (
          <Alert tone="neutral" className="mt-5">
            Nothing has been checked yet. Run the check to see what the form itself requires.
          </Alert>
        )}

        <section className="mt-10 border-t border-line pt-6">
          <h2 className="text-lg font-semibold">Take a copy away</h2>
          <p className="mt-1 text-sm text-muted">
            A FormFix review summary lists what you entered and what the check found. It is not a
            completed official application and it has not been submitted anywhere.
          </p>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">
              Choose which answers to include ({selected.size} of {form.fields.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {form.fields.map((field) => (
                <li key={field.id}>
                  <CheckboxControl
                    id={`export-${field.id}`}
                    checked={selected.has(field.id)}
                    onCheckedChange={(next) =>
                      setSelected((current) => {
                        const copy = new Set(current);
                        if (next) copy.add(field.id);
                        else copy.delete(field.id);
                        return copy;
                      })
                    }
                    label={field.labelOriginal}
                  />
                </li>
              ))}
            </ul>
          </details>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer aria-hidden className="size-4" />
              Print or save as PDF
            </Button>
            <Button
              variant="secondary"
              loading={download.isPending}
              onClick={() => download.mutate()}
            >
              <Download aria-hidden className="size-4" />
              Download JSON
            </Button>
          </div>

          {downloadError ? (
            <Alert tone="danger" className="mt-3">
              {downloadError}
            </Alert>
          ) : null}

          <Badge tone="neutral" className="mt-4">
            No session identifier is included in either file.
          </Badge>
        </section>
      </div>

      <PrintSummary selectedFieldIds={selected} />
    </div>
  );
}
