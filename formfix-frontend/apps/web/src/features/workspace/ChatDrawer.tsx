import type { ChatAnswer, Field } from '@formfix/contracts';

import * as Dialog from '@radix-ui/react-dialog';
import { CircleHelp, CircleSlash, Send, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { MarkdownLite, SourceChip } from '../../components/common';
import { Alert, Badge, Button, Panel, Spinner } from '../../components/ui/primitives';
import { FormFixApiError, api } from '../../lib/api';
import { SUGGESTED_QUESTIONS } from '../../lib/suggested-questions';
import { useSession } from '../../state/session';
import { useSourceView } from './FormLayout';

type Turn =
  | { role: 'user'; id: string; text: string }
  | { role: 'assistant'; id: string; answer: ChatAnswer }
  | { role: 'error'; id: string; error: FormFixApiError; question: string };

const STATUS_BADGE: Record<ChatAnswer['status'], { label: string; tone: 'teal' | 'amber' | 'neutral' }> = {
  answered: { label: 'Found in the form', tone: 'teal' },
  not_found: { label: 'Not in this form', tone: 'amber' },
  needs_clarification: { label: 'Needs more detail', tone: 'neutral' },
};

function ChatBody({ field }: { field: Field | undefined }) {
  const session = useSession();
  const { showSource } = useSourceView();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [turns, pending]);

  // A drawer that closes mid-request must not leave one running.
  useEffect(() => () => abortRef.current?.abort(), []);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    // Cancel anything still in flight: a late reply to an older question
    // must never land under a newer one.
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const id = crypto.randomUUID();
    setTurns((t) => [...t, { role: 'user', id, text: trimmed }]);
    setDraft('');
    setPending(true);

    try {
      const answer = await api.ask(
        session.formId,
        { question: trimmed, fieldId: field?.id, language: session.language },
        controller.signal,
      );
      setTurns((t) => [...t, { role: 'assistant', id: `${id}-a`, answer }]);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') return;
      setTurns((t) => [
        ...t,
        {
          role: 'error',
          id: `${id}-e`,
          question: trimmed,
          error:
            cause instanceof FormFixApiError
              ? cause
              : new FormFixApiError({
                  code: 'internal',
                  message: 'The assistant did not answer.',
                  retryable: true,
                  requestId: 'client',
                  status: 0,
                }),
        },
      ]);
    } finally {
      if (abortRef.current === controller) {
        setPending(false);
        abortRef.current = null;
      }
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line px-4 py-3">
        <p className="text-sm text-muted">
          {field ? (
            <>
              Asking about <span className="font-medium text-ink">{field.labelOriginal}</span>
            </>
          ) : (
            'Asking about the form as a whole'
          )}
        </p>
        <p className="mt-1 text-xs text-muted">
          Answers come from this document only. Nothing here changes your answers or submits
          anything.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div>
            <p className="text-sm font-medium text-muted">Try asking</p>
            <ul className="mt-2 space-y-2">
              {SUGGESTED_QUESTIONS[session.language].map((question) => (
                <li key={question}>
                  <button
                    type="button"
                    onClick={() => void ask(question)}
                    lang={session.language}
                    className="w-full rounded-lg border border-line-strong bg-panel px-3 py-2.5 text-left text-base hover:border-teal hover:bg-teal-soft"
                  >
                    {question}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {turns.map((turn) => {
          if (turn.role === 'user') {
            return (
              <p
                key={turn.id}
                className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-teal-soft px-3.5 py-2.5"
              >
                {turn.text}
              </p>
            );
          }

          if (turn.role === 'error') {
            return (
              <Alert key={turn.id} tone="danger" title="That question did not get through">
                <p>{turn.error.message}</p>
                {turn.error.retryable ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => void ask(turn.question)}
                  >
                    Ask again
                  </Button>
                ) : null}
              </Alert>
            );
          }

          const badge = STATUS_BADGE[turn.answer.status];
          return (
            <Panel key={turn.id} className="max-w-[92%] p-3.5">
              <Badge tone={badge.tone}>
                {turn.answer.status === 'not_found' ? (
                  <CircleSlash aria-hidden className="size-3" />
                ) : turn.answer.status === 'needs_clarification' ? (
                  <CircleHelp aria-hidden className="size-3" />
                ) : null}
                {badge.label}
              </Badge>

              <div className="mt-2">
                <MarkdownLite text={turn.answer.answer} language={turn.answer.language} />
              </div>

              {turn.answer.clarificationQuestion ? (
                <p lang={turn.answer.language} className="mt-2 font-medium">
                  {turn.answer.clarificationQuestion}
                </p>
              ) : null}

              {turn.answer.sources.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {turn.answer.sources.map((source) => (
                    <SourceChip key={source.id} source={source} onOpen={showSource} />
                  ))}
                </div>
              ) : null}
            </Panel>
          );
        })}

        {pending ? (
          <div className="flex items-center gap-2">
            <Spinner label="Looking through the form" />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                abortRef.current?.abort();
                abortRef.current = null;
                setPending(false);
              }}
            >
              Stop
            </Button>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        className="border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Ask a question about this form
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void ask(draft);
              }
            }}
            rows={2}
            placeholder="Ask about this form…"
            className="min-h-11 flex-1 resize-y rounded-lg border border-line-strong bg-panel px-3 py-2.5 text-base"
          />
          <Button type="submit" variant="primary" size="icon" disabled={!draft.trim() || pending} aria-label="Send question">
            <Send aria-hidden className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Desktop: a drawer over the workspace. Mobile: rendered inline by the Ask tab. */
export function ChatDrawer() {
  const session = useSession();
  const { chatOpen, setChatOpen, chatFieldId } = useSourceView();
  const field = session.state?.form.fields.find((f) => f.id === chatFieldId);

  return (
    <Dialog.Root open={chatOpen} onOpenChange={setChatOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25" />
        <Dialog.Content className="fixed top-0 right-0 z-50 flex h-dvh w-[min(30rem,100vw)] flex-col border-l border-line bg-panel shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <Dialog.Title className="text-lg font-semibold">Talk to the form</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close">
                <X aria-hidden className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Ask questions about this document. Answers cite the page they came from.
          </Dialog.Description>
          <div className="min-h-0 flex-1">
            <ChatBody field={field} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ChatPanel({ fieldId }: { fieldId: string | null }) {
  const session = useSession();
  const field = session.state?.form.fields.find((f) => f.id === fieldId);
  return <ChatBody field={field} />;
}
