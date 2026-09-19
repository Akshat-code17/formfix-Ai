import { isAnswered } from '@formfix/contracts';
import { Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import { RequiredBadge, SourceChip } from '../../components/common';
import { CheckboxControl } from '../../components/ui/controls';
import { Alert, Badge, Button, Panel } from '../../components/ui/primitives';
import { checklistProgress, requirementApplies } from '../../lib/progress';
import { useSession } from '../../state/session';
import { useSourceView } from '../workspace/FormLayout';

export function ChecklistPage() {
  const session = useSession();
  const { showSource, activeSource } = useSourceView();
  const form = session.state!.form;
  const readiness = session.state!.documentReadiness;
  const progress = checklistProgress(form, session.effectiveAnswers, readiness);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold">Documents this form asks for</h1>
      <p className="mt-2 text-muted">
        {progress.ready} of {progress.total} marked ready by you.
        {progress.unresolved > 0
          ? ` ${progress.unresolved} cannot be settled until earlier answers are given.`
          : ''}
      </p>

      <Alert tone="info" className="mt-4" icon={<Info aria-hidden className="size-4" />}>
        Ticking an item records what you told us. FormFix does not collect the documents themselves
        and cannot check that a document is genuine or that any institution will accept it.
      </Alert>

      <ul className="mt-5 space-y-4">
        {form.documentRequirements.map((requirement) => {
          const applies = requirementApplies(requirement, session.effectiveAnswers);
          const ready = readiness[requirement.id]?.ready === true;
          const numberField = requirement.numberFieldId
            ? form.fields.find((f) => f.id === requirement.numberFieldId)
            : undefined;
          const numberAnswered = numberField
            ? isAnswered(session.effectiveAnswers[numberField.id])
            : false;

          return (
            <li key={requirement.id}>
              <Panel className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-lg font-semibold">{requirement.labelOriginal}</h2>
                  <div className="flex flex-wrap gap-2">
                    <RequiredBadge status={requirement.requiredStatus} />
                    {applies === 'not_applicable' ? (
                      <Badge tone="neutral">Does not apply to you</Badge>
                    ) : null}
                    {applies === 'unresolved' ? <Badge tone="amber">Not settled yet</Badge> : null}
                  </div>
                </div>

                {requirement.purposeOriginal ? (
                  <p className="mt-2 text-muted">
                    Why the form asks for it: “{requirement.purposeOriginal}”
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-muted">
                    The form does not say why this is needed.
                  </p>
                )}

                {requirement.condition ? (
                  <p className="mt-2 text-sm">{requirement.condition.describe}</p>
                ) : null}

                {requirement.alternatives.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-line bg-paper p-3">
                    <p className="text-sm font-medium">The form also accepts instead:</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-muted">
                      {requirement.alternatives.map((alternative) => (
                        <li key={alternative}>{alternative}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">
                    The form names no alternative to this document.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {requirement.sources.map((source) => (
                    <SourceChip
                      key={source.id}
                      source={source}
                      onOpen={showSource}
                      active={activeSource?.id === source.id}
                    />
                  ))}
                </div>

                {applies !== 'not_applicable' ? (
                  <div className="mt-4 rounded-lg border border-line bg-paper p-3">
                    <CheckboxControl
                      id={`ready-${requirement.id}`}
                      checked={ready}
                      onCheckedChange={(next) => session.setReadiness(requirement.id, next)}
                      label={
                        <span>
                          I have this ready
                          <span className="mt-0.5 block text-sm text-muted">
                            Self-reported. Nothing is uploaded or verified.
                          </span>
                        </span>
                      }
                    />
                  </div>
                ) : null}

                {numberField ? (
                  <p className="mt-3 text-sm text-muted">
                    Having the document and writing its reference number are separate things.{' '}
                    {numberAnswered
                      ? 'You have entered a reference number.'
                      : 'You have not entered a reference number yet.'}{' '}
                    <Link
                      to={`/form/${session.formId}?field=${numberField.id}`}
                      className="text-teal-ink underline"
                    >
                      Go to “{numberField.labelOriginal}”
                    </Link>
                  </p>
                ) : null}
              </Panel>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" asChild>
          <Link to={`/form/${session.formId}/review`}>Run the form check</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to={`/form/${session.formId}`}>Back to the guide</Link>
        </Button>
      </div>
    </div>
  );
}
