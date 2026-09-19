import * as Dialog from '@radix-ui/react-dialog';
import { useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Trash2, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FormFixApiError, api } from '../lib/api';
import { cn } from '../lib/cn';
import { useApp } from '../state/app';
import { IS_DEMO } from '../lib/env';
import { prefs } from '../lib/prefs';
import { FAULT_LABELS, demoLab, type DemoFaultKey } from '../mocks/demo-lab';
import { Alert, Button } from './ui/primitives';

function Brand() {
  return (
    <a href="/" className="flex items-center gap-2.5 no-underline">
      <span
        aria-hidden
        className="grid size-8 place-items-center rounded-lg bg-teal text-sm font-semibold text-white"
      >
        FF
      </span>
      <span className="leading-tight">
        <span className="block font-semibold text-ink">FormFix</span>
        <span className="hidden text-xs text-muted sm:block">
          Tell me what this form actually wants
        </span>
      </span>
    </a>
  );
}

/** Says "Demo data" for as long as the fixture backend is answering. */
function ModeBadge() {
  const { config } = useApp();
  if (!IS_DEMO && config?.mode !== 'demo') return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-edge bg-amber-soft px-2.5 py-1 text-xs font-semibold text-amber">
      <span aria-hidden className="size-1.5 rounded-full bg-amber" />
      {IS_DEMO ? 'Demo data' : 'Recorded AI · connected backend'}
    </span>
  );
}

function DemoControlsDialog() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  if (!IS_DEMO) return null;

  const toggle = (key: DemoFaultKey) => {
    demoLab.toggle(key);
    force((n) => n + 1);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary">
          <FlaskConical aria-hidden className="size-4" />
          Demo controls
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(34rem,calc(100vw-2rem))] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-line bg-panel p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="text-lg font-semibold">Demo controls</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted">
                These switches make the fixture backend fail on purpose, so the recovery paths can
                be shown rather than described. They exist in demo mode only.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" aria-label="Close">
                <X aria-hidden className="size-5" />
              </Button>
            </Dialog.Close>
          </div>

          <ul className="mt-5 space-y-2">
            {(Object.keys(FAULT_LABELS) as DemoFaultKey[]).map((key) => {
              const on = demoLab.isOn(key);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    aria-pressed={on}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left',
                      on ? 'border-amber bg-amber-soft' : 'border-line bg-panel hover:bg-paper',
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="font-medium">{FAULT_LABELS[key].title}</span>
                      <span className="text-xs font-semibold text-muted">{on ? 'ON' : 'off'}</span>
                    </span>
                    <span className="mt-1 block text-sm text-muted">{FAULT_LABELS[key].detail}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          <Button
            className="mt-4"
            variant="secondary"
            size="sm"
            onClick={() => {
              demoLab.clear();
              force((n) => n + 1);
            }}
          >
            Switch all off
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DeleteSessionDialog() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.deleteSession();
      // Nothing about this form stays in the browser afterwards.
      queryClient.clear();
      prefs.clearAll();
      setOpen(false);
      navigate('/', { replace: true, state: { deleted: true } });
    } catch (cause) {
      setError(
        cause instanceof FormFixApiError
          ? cause.message
          : 'The session could not be deleted. Try again in a moment.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="ghost">
          <Trash2 aria-hidden className="size-4" />
          <span className="hidden sm:inline">Delete my session</span>
          <span className="sm:hidden">Delete</span>
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/35" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-50 w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-panel p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">Delete this session?</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted">
            This removes the uploaded document, your answers and your checklist from the server, and
            clears them from this browser. It cannot be undone.
          </Dialog.Description>
          {error ? (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          ) : null}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="secondary">Keep my session</Button>
            </Dialog.Close>
            <Button variant="danger" loading={busy} onClick={confirm}>
              Delete everything
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function AppShell({
  children,
  nav,
  sessionActive,
}: {
  children: ReactNode;
  nav?: { to: string; label: string }[];
  sessionActive?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 sm:py-3">
          <Brand />
          <ModeBadge />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DemoControlsDialog />
            {sessionActive ? <DeleteSessionDialog /> : null}
          </div>
        </div>

        {nav?.length ? (
          <nav
            aria-label="Sections of this form"
            className="mx-auto w-full max-w-[1400px] overflow-x-auto px-4 pb-2"
          >
            <ul className="flex gap-1">
              {nav.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end
                    className={({ isActive }) =>
                      cn(
                        'inline-flex min-h-10 items-center rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap no-underline',
                        isActive
                          ? 'bg-teal-soft text-teal-ink'
                          : 'text-muted hover:bg-panel hover:text-ink',
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main id="main" className="min-h-0 flex-1">
        {children}
      </main>
    </div>
  );
}
