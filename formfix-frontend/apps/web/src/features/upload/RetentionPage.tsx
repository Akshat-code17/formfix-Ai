import { Link } from 'react-router-dom';
import { AppShell } from '../../components/AppShell';
import { Panel } from '../../components/ui/primitives';
import { IS_DEMO } from '../../lib/env';
import { useApp } from '../../state/app';

/**
 * The page the upload screen links to. It says what this build actually
 * does, and stops short of promising deletion behaviour the backend has not
 * been shown to implement.
 */
export function RetentionPage() {
  const { config } = useApp();
  const ttl = config?.limits.sessionTtlMinutes;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold">What FormFix keeps</h1>

        <Panel className="mt-6 space-y-5 p-6 text-base leading-relaxed">
          <section>
            <h2 className="font-semibold">Your session</h2>
            <p className="mt-1 text-muted">
              Uploading a form creates a guest session. There is no account and no email address.
              The session is identified by a cookie your browser stores and this page cannot read.
              {ttl ? ` The server reports a session lifetime of ${ttl} minutes.` : ''}
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Your answers</h2>
            <p className="mt-1 text-muted">
              Answers are stored on the server against that session, so they survive a reload. The
              browser keeps only your chosen explanation language and which form you last opened.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">AI processing</h2>
            <p className="mt-1 text-muted">
              When the server uses live AI, relevant document text is sent to an external AI service to produce the field
              list and the explanations. That service has its own retention terms. Connected fixture mode stores uploads and answers on the local server but makes no external AI calls.
            </p>
          </section>

          <section>
            <h2 className="font-semibold">Deleting</h2>
            <p className="mt-1 text-muted">
              “Delete my session” asks the server to remove the document, your answers and your
              checklist, and clears them from this browser. We do not claim anything beyond what
              that request returns: copies already made by a provider or a backup are outside what
              this app can see or promise.
            </p>
          </section>

          {IS_DEMO ? (
            <section className="rounded-xl border border-amber-edge bg-amber-soft p-4">
              <h2 className="font-semibold">In this demo build</h2>
              <p className="mt-1 text-muted">
                Nothing leaves your browser. The “server” is a fixture adapter running in a service
                worker, and the session lives in this tab’s session storage. No AI service is called
                and no document is uploaded anywhere.
              </p>
            </section>
          ) : null}
        </Panel>

        <p className="mt-6">
          <Link to="/" className="text-teal-ink underline">
            Back to the start
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
