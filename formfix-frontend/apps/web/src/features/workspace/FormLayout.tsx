import type { SourceRef } from '@formfix/contracts';
import { Check, CloudOff, Loader2 } from 'lucide-react';
import { createContext, use, useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { LanguageSelect } from '../../components/common';
import { Alert, Button, Panel, Spinner } from '../../components/ui/primitives';
import { prefs } from '../../lib/prefs';
import { useApp } from '../../state/app';
import { SessionProvider, useSession } from '../../state/session';

type SourceViewValue = {
  activeSource: SourceRef | null;
  showSource: (source: SourceRef) => void;
  clearSource: () => void;
  /**
   * True only between a citation being clicked and the workspace bringing the
   * original into view. Without it, simply returning to the workspace with an
   * old citation still selected would yank the user to the document again.
   */
  revealPending: boolean;
  consumeReveal: () => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  chatFieldId: string | null;
  setChatFieldId: (fieldId: string | null) => void;
};

const SourceViewContext = createContext<SourceViewValue | null>(null);

export function useSourceView(): SourceViewValue {
  const ctx = use(SourceViewContext);
  if (!ctx) throw new Error('useSourceView must be used inside <FormLayout>');
  return ctx;
}

/** Saving / Saved / Save failed — reported as it actually is. */
function SaveStatus() {
  const { saveState, retrySave, unsavedCount } = useSession();

  if (saveState.status === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        Saving…
      </span>
    );
  }

  if (saveState.status === 'failed') {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 text-sm text-danger">
        <CloudOff aria-hidden className="size-4" />
        <span>Save failed — your {unsavedCount === 1 ? 'edit is' : 'edits are'} still here.</span>
        <Button size="sm" variant="secondary" onClick={retrySave}>
          Retry
        </Button>
      </span>
    );
  }

  if (saveState.status === 'saved' && unsavedCount === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted">
        <Check aria-hidden className="size-4 text-teal" />
        Saved
      </span>
    );
  }

  if (unsavedCount > 0) {
    return <span className="text-sm text-muted">Not saved yet</span>;
  }

  return null;
}

function LayoutInner({ formId }: { formId: string }) {
  const { config } = useApp();
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [activeSource, setActiveSource] = useState<SourceRef | null>(null);
  const [revealPending, setRevealPending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatFieldId, setChatFieldId] = useState<string | null>(null);

  const showSource = useCallback(
    (source: SourceRef) => {
      setActiveSource(source);
      setRevealPending(true);
      // Citations are clickable everywhere; the original only lives on the
      // guide screen, so go there before highlighting.
      if (!location.pathname.endsWith(`/form/${formId}`)) navigate(`/form/${formId}`);
    },
    [formId, location.pathname, navigate],
  );

  useEffect(() => {
    prefs.setLastFormId(formId);
  }, [formId]);

  if (session.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Spinner label="Opening your form" />
      </div>
    );
  }

  if (session.loadError) {
    const expired = session.loadError.isSessionGone;
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-12">
        <Alert tone="danger" title={expired ? 'Your session has ended' : 'We could not open this form'}>
          <p>{session.loadError.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {expired ? (
              <Button size="sm" variant="primary" asChild>
                <Link to="/">Start a new session</Link>
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={session.refetch}>
                Try again
              </Button>
            )}
          </div>
        </Alert>
      </div>
    );
  }

  if (!session.state) return null;

  return (
    <SourceViewContext
      value={{
        activeSource,
        showSource,
        clearSource: () => setActiveSource(null),
        revealPending,
        consumeReveal: () => setRevealPending(false),
        chatOpen,
        setChatOpen,
        chatFieldId,
        setChatFieldId,
      }}
    >
      <Panel className="no-print mx-auto mt-3 flex w-full max-w-[1400px] flex-wrap items-center gap-3 rounded-none border-x-0 px-4 py-2 sm:rounded-[14px] sm:border-x">
        <div className="min-w-0">
          <p className="truncate font-medium">{session.state.form.title}</p>
          {session.state.form.synthetic ? (
            <p className="text-xs text-amber">Synthetic demo document — not an official scheme</p>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <SaveStatus />
          <LanguageSelect
            compact
            value={session.language}
            onChange={session.setLanguage}
            available={config?.capabilities.languages ?? ['en']}
            pending={session.languagePending}
          />
        </div>
      </Panel>

      <Outlet />
    </SourceViewContext>
  );
}

export function FormLayout() {
  const { formId = '' } = useParams();

  const nav = [
    { to: `/form/${formId}`, label: 'Guide' },
    { to: `/form/${formId}/checklist`, label: 'Documents' },
    { to: `/form/${formId}/review`, label: 'Form check' },
  ];

  return (
    <SessionProvider formId={formId}>
      <AppShell nav={nav} sessionActive>
        <LayoutInner formId={formId} />
      </AppShell>
    </SessionProvider>
  );
}

