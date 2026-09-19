import { test, expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Runs against real Express + MongoDB + FastAPI. No route mocking or MSW.
async function call(page: Page, operation: string, args: unknown[] = []) {
  return page.evaluate(async ({ operation, args }) => {
    // @ts-expect-error Vite serves this real browser module; not a Node import.
    const { api } = await import('/src/lib/api.ts');
    return api[operation](...args);
  }, { operation, args });
}
async function field(page: Page, formId: string, id: string) {
  await page.goto(`/form/${formId}?field=${id}`);
  await expect(page.getByText('Recorded AI · connected backend')).toBeVisible();
}
test('connected sample, evidence, save/reload, language, chat, correction, export and deletion', async ({ page }) => {
  await expect.poll(async () => { try { return (await page.request.get('/')).status(); } catch { return 0; } }).toBe(200);
  await page.goto('/');
  await expect(page.getByText('Recorded AI · connected backend')).toBeVisible();
  await page.getByRole('button', { name: 'Try a sample form' }).click();
  await page.getByRole('button', { name: 'Open the guide' }).click({ timeout: 30000 });
  const formId = new URL(page.url()).pathname.split('/')[2]!;
  expect(formId).not.toBe('demo-student-support-v1');
  await expect(page.getByRole('heading', { name: 'Full name', exact: true })).toBeVisible();
  await expect(page.getByText('What does this mean?')).toBeVisible();
  const state = await call(page, 'getForm', [formId]);
  expect(state.form.fields).toHaveLength(14);
  expect(state.form.documentRequirements).toHaveLength(3);
  expect(state.form.fields.find((f: { id: string }) => f.id === 'travel_reason').condition.equalsAny).toEqual(['travel']);
  const source = page.getByRole('button', { name: /Page 1/ }).first();
  await source.click();
  await expect(page.getByTestId('source-highlight')).toBeVisible({ timeout: 15000 });

  // Synthetic data only; seeded through the same browser API used by autosave.
  const answers = { full_name: 'Fictional Student', birth_date: '2004-02-29', student_id: '000042',
    address: '7 Imaginary Lane, Demo Town', pin: '12345', contact: '', course: 'Science',
    study_year: '2', start_date: '2026-06-01', support_type: 'standard', travel_reason: '',
    support_number: '', confirm_student_id: '000042', declaration_date: '2026-09-18' };
  const saved = await call(page, 'patchAnswers', [formId, state.revision,
    Object.entries(answers).map(([fieldId, value]) => ({ fieldId, value }))]);
  const ready = await call(page, 'patchDocuments', [formId, saved.revision,
    [{ requirementId: 'enrollment', ready: true }, { requirementId: 'support_record', ready: false }]]);
  const bad = await call(page, 'validate', [formId, ready.revision]);
  expect(bad.issues).toHaveLength(3);
  const conflict = await page.evaluate(async ({ formId, revision }) => {
    // @ts-expect-error Vite browser import
    const { api } = await import('/src/lib/api.ts');
    try { await api.patchAnswers(formId, revision, [{ fieldId: 'pin', value: '999999' }]); }
    catch (e) { return (e as { status: number }).status; }
  }, { formId, revision: state.revision });
  expect(conflict).toBe(409);

  await field(page, formId, 'pin');
  await page.getByLabel('Your answer — PIN').fill('012345');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Your answer — PIN')).toHaveValue('012345');
  await page.getByLabel('Explanation language').selectOption('hi');
  await expect.poll(async () => (await call(page, 'getForm', [formId])).language).toBe('hi');
  await expect(page.getByLabel('Your answer — PIN')).toHaveValue('012345');
  const explanation = await call(page, 'getExplanation', [formId, 'pin', 'hi']);
  expect(explanation.language).toBe('hi');
  expect(explanation.sources.length).toBeGreaterThan(0);
  const unknown = await call(page, 'ask', [formId, { question: 'Is Aadhaar accepted?', language: 'en' }]);
  expect(unknown.status).toBe('not_found');
  await field(page, formId, 'support_number');
  await page.getByLabel('Your answer — Supporting-document number').fill('SD-000123');
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  const current = await call(page, 'getForm', [formId]);
  const docs = await call(page, 'patchDocuments', [formId, current.revision, [{ requirementId: 'support_record', ready: true }]]);
  const clean = await call(page, 'validate', [formId, docs.revision]);
  expect(clean.issues).toEqual([]);
  const exported = await call(page, 'exportSummary', [formId, ['pin', 'student_id']]);
  expect(exported.validationCurrent).toBe(true);
  expect(exported.answers.map((a: { value: string }) => a.value)).toEqual(['000042', '012345']);
  expect(exported.templateId).toBe('ff-demo-2026-v1');
  await page.goto(`/form/${formId}/review`);
  await page.getByRole('button', { name: 'Run the check' }).click();
  await expect(page.getByRole('button', { name: 'Check again' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  expect((await download).suggestedFilename()).toBe('formfix-review-summary.json');
  await call(page, 'deleteSession');
  expect((await page.request.get(`/api/forms/${formId}`)).status()).toBe(401);
});

test('a different form opens for manual review without sample rules or a blank screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Recorded AI · connected backend')).toBeVisible();
  // The original frontend fixture has a different template/version from the backend gold schema.
  await page.locator('input[type=file]').setInputFiles(fileURLToPath(new URL('../../../fixtures/demo/assets/sample-form.pdf', import.meta.url)));
  await page.getByRole('button', { name: 'Open the guide' }).click({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'This form needs manual review' })).toBeVisible();
  const formId = new URL(page.url()).pathname.split('/')[2]!;
  const state = await call(page, 'getForm', [formId]);
  expect(state.form.fields).toEqual([]);
  expect(state.form.templateId).toBeUndefined();
  await call(page, 'deleteSession');
});
