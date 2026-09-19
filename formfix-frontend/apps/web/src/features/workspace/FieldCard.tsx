import { SCHEMA_VERSION, isRequiredNow, type Field } from '@formfix/contracts';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Info,
  MessageCircleQuestion,
  SkipForward,
} from 'lucide-react';
import { RequiredBadge, SourceChip, Translated } from '../../components/common';
import { Alert, Badge, Button, Panel, Spinner } from '../../components/ui/primitives';
import { FormFixApiError, api } from '../../lib/api';
import { useSession } from '../../state/session';
import { FieldControl } from './FieldControl';
import { useSourceView } from './FormLayout';

export function FieldCard({
  field,
  onPrevious,
  onNext,
  position,
}: {
  field: Field;
  onPrevious?: () => void;
  onNext?: () => void;
  position: { index: number; total: number };
}) {
  const session = useSession();
  const { activeSource, showSource, setChatOpen, setChatFieldId } = useSourceView();

  const explanation = useQuery({
    // Cached per form, field, language and schema version, so a model change
    // or a language switch never serves the previous text.
    queryKey: ['explanation', session.formId, field.id, session.language, SCHEMA_VERSION],
    queryFn: ({ signal }) =>
      // The signal is passed through, so switching language mid-flight
      // cancels the older request and a late reply cannot overwrite the
      // language the user actually chose.
      api.getExplanation(session.formId, field.id, session.language, signal),
    staleTime: 5 * 60_000,
    retry: (count, error) => error instanceof FormFixApiError && error.retryable && count < 2,
  });

  const value = session.valueOf(field.id);
  const skipped = session.isSkipped(field.id);
  const unsaved = session.hasUnsavedEdit(field.id);
  const requirement = isRequiredNow(field, session.effectiveAnswers);
  const issues = (session.report?.issues ?? []).filter((issue) => issue.fieldId === field.id);
  const errors = issues.filter((i) => i.severity === 'error');
  const manual = issues.filter((i) => i.severity === 'manual_review');
  const warnings = issues.filter((i) => i.severity === 'warning');
  const extraction = session.state?.form.extractionWarnings.filter((w) => w.fieldId === field.id) ?? [];

  const describedBy = [
    `${field.id}-guidance`,
    errors.length ? `${field.id}-errors` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const explanationError =
    explanation.error instanceof FormFixApiError ? explanation.error : null;

  return (
    <Panel className="enter-fade-up p-5 sm:p-6" aria-labelledby={`${field.id}-label`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">
            Question {position.index + 1} of {position.total}
          </p>
          {/* The label exactly as the form prints it, never rewritten. */}
          <h2 id={`${field.id}-label`} className="mt-1 text-xl font-semibold">
            {field.labelOriginal}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RequiredBadge
            status={field.requiredStatus}
            hint={field.condition?.describe}
          />
          {skipped ? <Badge tone="amber">Skipped</Badge> : null}
          {unsaved ? <Badge tone="neutral">Unsaved</Badge> : null}
        </div>
      </div>

      {field.requiredStatus === 'conditional' && field.condition ? (
        <p className="mt-2 text-sm text-muted">{field.condition.describe}</p>
      ) : null}
      {requirement === 'unresolved' && field.requiredStatus === 'conditional' ? (
        <p className="mt-1 text-sm text-amber">
          Answer question about the earlier choice first, and this will settle itself.
        </p>
      ) : null}

      <div id={`${field.id}-guidance`} className="mt-5 space-y-4">
        {explanation.isPending ? (
          <Spinner label="Getting the explanation" />
        ) : explanationError ? (
          <Alert
            tone="warning"
            title="The explanation is not available right now"
            icon={<AlertTriangle aria-hidden className="size-4" />}
          >
            <p>{explanationError.message}</p>
            <p className="mt-1">
              You can still read the original question above and enter your answer.
            </p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={() => void explanation.refetch()}
            >
              Try again
            </Button>
          </Alert>
        ) : explanation.data ? (
          <>
            {explanation.data.fallback ? <Alert tone="warning">Translation unavailable. Showing English.</Alert> : null}
            <section>
              <h3 className="text-sm font-semibold text-muted">What does this mean?</h3>
              <Translated language={explanation.data.language} className="mt-1 text-base">
                {explanation.data.meaning}
              </Translated>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-muted">What should I enter?</h3>
              <Translated language={explanation.data.language} className="mt-1 text-base">
                {explanation.data.whatToEnter}
              </Translated>
            </section>

            {explanation.data.example ? (
              <section className="rounded-lg border border-line bg-paper p-3">
                <h3 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  Made-up example — not your answer
                </h3>
                <p className="mt-1 font-mono text-sm whitespace-pre-line">
                  {explanation.data.example}
                </p>
              </section>
            ) : null}

            {explanation.data.needsReview ? (
              <Alert tone="warning" icon={<Info aria-hidden className="size-4" />}>
                This explanation needs human review. Demo translations have not been reviewed by a fluent speaker. Check the original before relying on it.
              </Alert>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="mt-6">
        <label
          htmlFor={field.type === 'radio' ? undefined : `field-${field.id}`}
          className="mb-2 block font-medium"
        >
          {field.type === 'checkbox' ? 'Your answer' : `Your answer — ${field.labelOriginal}`}
        </label>
        <FieldControl
          field={field}
          value={value}
          onChange={(next) => session.setAnswer(field.id, next)}
          describedBy={describedBy}
          invalid={errors.length > 0}
        />
      </div>

      {errors.length > 0 ? (
        <div id={`${field.id}-errors`} className="mt-3 space-y-2">
          {errors.map((issue) => (
            <Alert key={issue.id} tone="danger" title="This needs fixing">
              {issue.message}
            </Alert>
          ))}
        </div>
      ) : null}

      {warnings.map((issue) => (
        <Alert key={issue.id} tone="warning" className="mt-3" title="Worth a look">
          {issue.message}
        </Alert>
      ))}

      {manual.map((issue) => (
        <Alert key={issue.id} tone="warning" className="mt-3" title="The checks cannot settle this">
          {issue.message}
        </Alert>
      ))}

      {extraction.map((warning) => (
        <Alert key={warning.id} tone="warning" className="mt-3" title="Read from the form with low confidence">
          {warning.message}
        </Alert>
      ))}

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-sm font-semibold text-muted">Why is this asked? Read the original</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {field.sources.map((source) => (
            <SourceChip
              key={source.id}
              source={source}
              onOpen={showSource}
              active={activeSource?.id === source.id}
            />
          ))}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" onClick={onPrevious} disabled={!onPrevious}>
          <ChevronLeft aria-hidden className="size-4" />
          Previous
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!onNext}>
          Next
          <ChevronRight aria-hidden className="size-4" />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            session.setSkipped(field.id, !skipped);
            if (!skipped) onNext?.();
          }}
        >
          <SkipForward aria-hidden className="size-4" />
          {skipped ? 'Unskip' : 'Skip for now'}
        </Button>
        <Button
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            setChatFieldId(field.id);
            setChatOpen(true);
          }}
        >
          <MessageCircleQuestion aria-hidden className="size-4" />
          Ask about this
        </Button>
      </div>
    </Panel>
  );
}
