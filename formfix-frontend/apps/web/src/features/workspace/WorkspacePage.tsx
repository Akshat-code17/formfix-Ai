import { isAnswered, isRequiredNow } from '@formfix/contracts';
import { Check, FileText, MessageCircleQuestion, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Meter, Panel } from '../../components/ui/primitives';
import { api } from '../../lib/api';
import { cn } from '../../lib/cn';
import { prefs } from '../../lib/prefs';
import { computeProgress, fieldsBySection, orderedFields } from '../../lib/progress';
import { useMediaQuery } from '../../lib/use-media-query';
import { useSession } from '../../state/session';
import { ChatDrawer, ChatPanel } from './ChatDrawer';
import { FieldCard } from './FieldCard';
import { useSourceView } from './FormLayout';
import { PdfViewer } from './PdfViewer';

type MobileTab = 'guide' | 'original' | 'ask';

function ProgressSummary() {
  const session = useSession();
  const form = session.state!.form;
  const progress = computeProgress(form, session.effectiveAnswers);

  return (
    <div className="space-y-2">
      <p className="text-sm">
        <span className="font-semibold">
          {progress.answeredTotal} of {progress.fieldsTotal}
        </span>{' '}
        questions answered
      </p>
      <Meter
        value={progress.requiredAnswered}
        max={progress.requiredTotal}
        label={`Required questions answered: ${progress.requiredAnswered} of ${progress.requiredTotal}`}
      />
      <p className="text-xs text-muted">
        {progress.requiredAnswered} of {progress.requiredTotal} required questions answered.
        {progress.unresolvedCount > 0
          ? ` ${progress.unresolvedCount} more cannot be settled yet.`
          : ''}
      </p>
      {/* Answering is not the same as passing the checks, so the two are
          never merged into one number. */}
      <p className="text-xs text-muted">
        Answered is not the same as checked — run the form check when you are ready.
      </p>
    </div>
  );
}

function SectionSidebar({
  currentFieldId,
  onSelect,
}: {
  currentFieldId: string;
  onSelect: (fieldId: string) => void;
}) {
  const session = useSession();
  const form = session.state!.form;
  const groups = useMemo(() => fieldsBySection(form), [form]);

  return (
    <nav aria-label="Questions in this form" className="space-y-5">
      {groups.map(({ section, fields }) => (
        <div key={section.id}>
          <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">
            {section.titleOriginal}
          </h2>
          <ul className="mt-2 space-y-1">
            {fields.map((field) => {
              const answered = isAnswered(session.effectiveAnswers[field.id]);
              const required = isRequiredNow(field, session.effectiveAnswers);
              const active = field.id === currentFieldId;
              return (
                <li key={field.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(field.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'flex w-full min-h-11 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm',
                      active ? 'bg-teal-soft text-teal-ink' : 'hover:bg-paper',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'grid size-5 shrink-0 place-items-center rounded-full border text-[10px]',
                        answered
                          ? 'border-teal bg-teal text-white'
                          : required === 'yes'
                            ? 'border-line-strong'
                            : 'border-line',
                      )}
                    >
                      {answered ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="truncate">{field.labelOriginal}</span>
                    {session.isSkipped(field.id) ? (
                      <span className="ml-auto text-xs text-amber">skipped</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function WorkspacePage() {
  const session = useSession();
  const { activeSource } = useSourceView();
  if (!session.state!.form.fields.length) return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <Panel className="p-5">
        <h1 className="text-xl font-semibold">This form needs manual review</h1>
        <p className="mt-2">No verified field guide is available for this document. Read the original below; the sample form's rules do not apply.</p>
        <ul className="mt-3 list-disc pl-5">{session.state!.form.extractionWarnings.map(w => <li key={w.id}>{w.message}</li>)}</ul>
      </Panel>
      <Panel className="h-[75vh] overflow-hidden p-0">
        <PdfViewer url={api.documentUrl(session.formId)} activeSource={activeSource} />
      </Panel>
    </div>
  );
  return <GuidedWorkspacePage />;
}

function GuidedWorkspacePage() {
  const session = useSession();
  const { activeSource, chatFieldId, setChatFieldId, setChatOpen, revealPending, consumeReveal } =
    useSourceView();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [searchParams, setSearchParams] = useSearchParams();
  const [sourceOpen, setSourceOpen] = useState(() => prefs.getSourcePanelOpen());
  const [mobileTab, setMobileTab] = useState<MobileTab>('guide');

  const form = session.state!.form;
  const fields = useMemo(() => orderedFields(form), [form]);
  const requestedId = searchParams.get('field');
  const currentField = fields.find((f) => f.id === requestedId) ?? fields[0]!;
  const index = fields.indexOf(currentField);

  const selectField = (fieldId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('field', fieldId);
    setSearchParams(next, { replace: true });
    setChatFieldId(fieldId);
  };

  useEffect(() => {
    if (!chatFieldId) setChatFieldId(currentField.id);
  }, [chatFieldId, currentField.id, setChatFieldId]);

  // A citation opened from anywhere pulls the original into view — but only
  // the once, when it was actually clicked.
  useEffect(() => {
    if (!revealPending || !activeSource) return;
    if (isDesktop) setSourceOpen(true);
    else setMobileTab('original');
    consumeReveal();
  }, [revealPending, activeSource, isDesktop, consumeReveal]);

  useEffect(() => {
    prefs.setSourcePanelOpen(sourceOpen);
  }, [sourceOpen]);

  const editor = (
    <div className="space-y-4">
      <FieldCard
        field={currentField}
        position={{ index, total: fields.length }}
        onPrevious={index > 0 ? () => selectField(fields[index - 1]!.id) : undefined}
        onNext={index < fields.length - 1 ? () => selectField(fields[index + 1]!.id) : undefined}
      />
      {index === fields.length - 1 ? (
        <Panel className="flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-muted">That is the last question.</p>
          <Button variant="primary" asChild>
            <Link to={`/form/${session.formId}/review`}>Go to the form check</Link>
          </Button>
        </Panel>
      ) : null}
    </div>
  );

  const viewer = (
    <Panel className="h-[min(78vh,900px)] overflow-hidden p-0">
      <PdfViewer url={api.documentUrl(session.formId)} activeSource={activeSource} />
    </Panel>
  );

  if (!isDesktop) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-4">
        <Panel className="p-4">
          <ProgressSummary />
          <label htmlFor="section-jump" className="mt-4 block text-sm font-medium">
            Jump to a question
          </label>
          <select
            id="section-jump"
            value={currentField.id}
            onChange={(event) => selectField(event.target.value)}
            className="mt-1 min-h-11 w-full rounded-lg border border-line-strong bg-panel px-3 py-2 text-base"
          >
            {fieldsBySection(form).map(({ section, fields: sectionFields }) => (
              <optgroup key={section.id} label={section.titleOriginal}>
                {sectionFields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.labelOriginal}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Panel>

        <div role="tablist" aria-label="Workspace panels" className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-panel p-1 ring-1 ring-line">
          {(
            [
              ['guide', 'Guide', null],
              ['original', 'Original', <FileText key="i" aria-hidden className="size-4" />],
              ['ask', 'Ask', <MessageCircleQuestion key="i" aria-hidden className="size-4" />],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              role="tab"
              type="button"
              id={`tab-${key}`}
              aria-selected={mobileTab === key}
              aria-controls={`panel-${key}`}
              onClick={() => setMobileTab(key)}
              className={cn(
                'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium',
                mobileTab === key ? 'bg-teal-soft text-teal-ink' : 'text-muted',
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div
          id={`panel-${mobileTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${mobileTab}`}
          className="mt-4"
        >
          {/* Switching tabs never remounts the answer: drafts live in the
              session, so the current field and what was typed both survive. */}
          {mobileTab === 'guide' ? editor : null}
          {mobileTab === 'original' ? viewer : null}
          {mobileTab === 'ask' ? (
            <Panel className="h-[min(70vh,700px)] overflow-hidden p-0">
              <ChatPanel fieldId={chatFieldId} />
            </Panel>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-4">
      <div
        className={cn(
          'grid gap-4',
          sourceOpen
            ? 'grid-cols-[minmax(200px,230px)_minmax(0,1fr)_minmax(0,1fr)]'
            : 'grid-cols-[minmax(200px,230px)_minmax(0,1fr)]',
        )}
      >
        <Panel className="h-fit p-4">
          <ProgressSummary />
          <div className="mt-5">
            <SectionSidebar currentFieldId={currentField.id} onSelect={selectField} />
          </div>
        </Panel>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setSourceOpen((open) => !open)}
              aria-pressed={sourceOpen}
            >
              {sourceOpen ? (
                <PanelRightClose aria-hidden className="size-4" />
              ) : (
                <PanelRightOpen aria-hidden className="size-4" />
              )}
              {sourceOpen ? 'Hide the original' : 'Show the original'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setChatFieldId(currentField.id);
                setChatOpen(true);
              }}
            >
              <MessageCircleQuestion aria-hidden className="size-4" />
              Ask about this form
            </Button>
          </div>
          {editor}
        </div>

        {sourceOpen ? <div className="min-w-0">{viewer}</div> : null}
      </div>

      <ChatDrawer />
    </div>
  );
}
