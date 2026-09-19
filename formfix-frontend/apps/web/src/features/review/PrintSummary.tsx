import type { AnswerValue, Field } from '@formfix/contracts';
import { requirementApplies } from '../../lib/progress';
import { useSession } from '../../state/session';

function renderValue(field: Field, value: AnswerValue): string {
  if (value === null) return '— not answered —';
  if (typeof value === 'boolean') return value ? 'Ticked' : 'Not ticked';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '— not answered —';
  if (value.trim() === '') return '— not answered —';
  const option = field.options?.find((o) => o.value === value);
  return option ? option.labelOriginal : value;
}

/**
 * The printed review summary. Screen-only chrome is hidden by `@media print`,
 * so what reaches paper is exactly this block — and it carries no session
 * identifier, no cookie value and no request id.
 */
export function PrintSummary({ selectedFieldIds }: { selectedFieldIds: Set<string> }) {
  const session = useSession();
  const form = session.state!.form;
  const report = session.report;
  const fields = form.fields.filter((f) => selectedFieldIds.has(f.id));

  return (
    <div className="print-only text-ink">
      <header className="border-b border-line pb-3">
        <h1 className="text-xl font-semibold">FormFix review summary</h1>
        <p className="mt-1 text-sm">
          This is a review summary. It is <strong>not</strong> a completed official application and
          it has not been submitted anywhere.
        </p>
        <dl className="mt-3 text-sm">
          <div>
            <dt className="inline font-medium">Document: </dt>
            <dd className="inline">{form.title}</dd>
          </div>
          {form.synthetic ? (
            <div>
              <dt className="inline font-medium">Note: </dt>
              <dd className="inline">
                Synthetic demonstration document. Not an official scheme.
              </dd>
            </div>
          ) : null}
          <div>
            <dt className="inline font-medium">Explanation language: </dt>
            <dd className="inline">{session.language}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Reviewed at: </dt>
            <dd className="inline">{new Date().toLocaleString()}</dd>
          </div>
        </dl>
      </header>

      <section className="mt-5">
        <h2 className="text-lg font-semibold">Answers</h2>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-line py-1 text-left">Question</th>
              <th className="border-b border-line py-1 text-left">Your answer</th>
              <th className="border-b border-line py-1 text-left">Status on the form</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field.id}>
                <td className="border-b border-line py-1 pr-3 align-top">{field.labelOriginal}</td>
                <td className="border-b border-line py-1 pr-3 align-top whitespace-pre-line">
                  {renderValue(field, session.valueOf(field.id))}
                </td>
                <td className="border-b border-line py-1 align-top">{field.requiredStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5">
        <h2 className="text-lg font-semibold">Documents</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {form.documentRequirements.map((requirement) => {
            const applies = requirementApplies(requirement, session.effectiveAnswers);
            const ready = session.state!.documentReadiness[requirement.id]?.ready === true;
            return (
              <li key={requirement.id}>
                <strong>{requirement.labelOriginal}</strong> — {requirement.requiredStatus}
                {applies === 'not_applicable' ? ' · does not apply' : ''}
                {applies === 'unresolved' ? ' · not settled' : ''}
                {' · '}
                {ready ? 'you said you have this ready' : 'not marked ready'}
                {requirement.alternatives.length
                  ? ` · form also accepts: ${requirement.alternatives.join(', ')}`
                  : ''}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-sm">
          Readiness is self-reported. No document was collected or verified.
        </p>
      </section>

      <section className="mt-5">
        <h2 className="text-lg font-semibold">What the check found</h2>
        {report ? (
          <>
            <p className="mt-1 text-sm">
              Checked at {new Date(report.checkedAt).toLocaleString()}
              {session.reportStale ? ' — answers have changed since, so this is out of date.' : ''}
            </p>
            {report.issues.length === 0 ? (
              <p className="mt-2 text-sm">No issues found by the configured checks.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {report.issues.map((issue) => (
                  <li key={issue.id}>
                    <strong>
                      {issue.severity === 'error'
                        ? 'Must fix'
                        : issue.severity === 'warning'
                          ? 'Worth a look'
                          : 'Needs your judgement'}
                      :
                    </strong>{' '}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm">The check has not been run.</p>
        )}
      </section>
    </div>
  );
}
