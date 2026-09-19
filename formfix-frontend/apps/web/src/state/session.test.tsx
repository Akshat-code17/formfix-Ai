import type { SessionState } from '@formfix/contracts';
import { demoFormModel } from '@formfix/fixtures-demo';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FormFixApiError } from '../lib/api';
import { SessionProvider, useSession } from './session';

const { getForm, patchAnswers, validate } = vi.hoisted(() => ({
  getForm: vi.fn(),
  patchAnswers: vi.fn(),
  validate: vi.fn(),
}));

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    api: { ...actual.api, getForm, patchAnswers, validate },
  };
});

const FORM_ID = demoFormModel.formId;

function stateAt(revision: number, answers: SessionState['answers'] = {}): SessionState {
  return {
    form: demoFormModel,
    language: 'en',
    revision,
    answers,
    documentReadiness: {},
    updatedAt: '2026-09-18T00:00:00.000Z',
    expiresAt: '2026-09-18T02:00:00.000Z',
    capabilities: {
      explanations: true,
      chat: true,
      validation: true,
      exportJson: true,
      documentStream: true,
      languages: ['en', 'hi', 'te', 'mr'],
    },
  };
}

function Harness() {
  const session = useSession();
  return (
    <div>
      <p data-testid="value">{String(session.valueOf('fld-city'))}</p>
      <p data-testid="status">{session.saveState.status}</p>
      <p data-testid="unsaved">{session.unsavedCount}</p>
      <button onClick={() => session.setAnswer('fld-city', 'Dharwad')}>type once</button>
      <button onClick={() => session.setAnswer('fld-city', 'Hubballi')}>type again</button>
      <button onClick={session.retrySave}>retry</button>
      <button onClick={session.runValidation}>check</button>
      <p data-testid="validation-error">{session.validationError?.message}</p>
    </div>
  );
}

function renderHarness() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider formId={FORM_ID}>
        <Harness />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getForm.mockResolvedValue(stateAt(4));
});

describe('the autosave queue', () => {
  it('waits for an active save before validating the accepted revision', async () => {
    const user = userEvent.setup();
    let resolveSave!: (value: unknown) => void;
    patchAnswers.mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; }));
    validate.mockResolvedValue({ revision: 5, checkedAt: new Date().toISOString(), issues: [], counts: { errors: 0, warnings: 0, manualReviews: 0, checklistGaps: 0 } });
    renderHarness();
    await screen.findByText('null');
    await user.click(screen.getByText('type once'));
    await waitFor(() => expect(patchAnswers).toHaveBeenCalledTimes(1));
    await user.click(screen.getByText('check'));
    expect(validate).not.toHaveBeenCalled();
    resolveSave({ revision: 5, state: stateAt(5) });
    await waitFor(() => expect(validate).toHaveBeenCalledWith(FORM_ID, 5));
  });

  it('does not validate if pending answers could not be saved', async () => {
    const user = userEvent.setup();
    patchAnswers.mockRejectedValue(new FormFixApiError({ code: 'network', message: 'Offline', retryable: true, requestId: 'test', status: 0 }));
    renderHarness();
    await screen.findByText('null');
    await user.click(screen.getByText('type once'));
    await user.click(screen.getByText('check'));
    await waitFor(() => expect(screen.getByTestId('validation-error')).toHaveTextContent('Save your changes'));
    expect(validate).not.toHaveBeenCalled();
  });
  it('debounces, then saves the latest value against the current revision', async () => {
    const user = userEvent.setup();
    patchAnswers.mockResolvedValue({ revision: 5, state: stateAt(5) });
    renderHarness();

    await screen.findByText('null');
    await user.click(screen.getByText('type once'));
    await user.click(screen.getByText('type again'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('saved'));

    // One request, carrying only the last value the user typed.
    expect(patchAnswers).toHaveBeenCalledTimes(1);
    expect(patchAnswers).toHaveBeenCalledWith(FORM_ID, 4, [
      { fieldId: 'fld-city', value: 'Hubballi', skipped: false },
    ]);
  });

  it('keeps the edit when the save fails, and sends it again on retry', async () => {
    const user = userEvent.setup();
    patchAnswers.mockRejectedValueOnce(
      new FormFixApiError({
        code: 'internal',
        message: 'The save did not reach the server.',
        retryable: true,
        requestId: 'req_test',
        status: 500,
      }),
    );
    renderHarness();

    await screen.findByText('null');
    await user.click(screen.getByText('type once'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('failed'));
    // The typed value is still on screen and still queued.
    expect(screen.getByTestId('value')).toHaveTextContent('Dharwad');
    expect(screen.getByTestId('unsaved')).toHaveTextContent('1');

    patchAnswers.mockResolvedValue({ revision: 5, state: stateAt(5) });
    await user.click(screen.getByText('retry'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('saved'));
    expect(patchAnswers).toHaveBeenLastCalledWith(FORM_ID, 4, [
      { fieldId: 'fld-city', value: 'Dharwad', skipped: false },
    ]);
  });

  it('takes the newer revision on a 409 and replays the pending edit on top of it', async () => {
    const user = userEvent.setup();
    patchAnswers.mockRejectedValueOnce(
      new FormFixApiError({
        code: 'revision_conflict',
        message: 'This form changed since your last save.',
        retryable: false,
        requestId: 'req_test',
        status: 409,
      }),
    );
    patchAnswers.mockResolvedValue({ revision: 10, state: stateAt(10) });
    // The session moved on while the user was typing.
    getForm.mockResolvedValueOnce(stateAt(4)).mockResolvedValue(stateAt(9));

    renderHarness();
    await screen.findByText('null');
    await user.click(screen.getByText('type once'));

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('saved'));

    expect(patchAnswers).toHaveBeenCalledTimes(2);
    expect(patchAnswers).toHaveBeenNthCalledWith(1, FORM_ID, 4, [
      { fieldId: 'fld-city', value: 'Dharwad', skipped: false },
    ]);
    // Replayed against the revision the server reported, edit intact.
    expect(patchAnswers).toHaveBeenNthCalledWith(2, FORM_ID, 9, [
      { fieldId: 'fld-city', value: 'Dharwad', skipped: false },
    ]);
    expect(screen.getByTestId('value')).toHaveTextContent('Dharwad');
  });
});
