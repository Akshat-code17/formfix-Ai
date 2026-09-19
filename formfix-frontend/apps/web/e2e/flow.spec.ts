import { expect, test, type Page } from '@playwright/test';

/** Start a session on the bundled sample and wait for the guide to open. */
async function openSample(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Try a sample form' }).click();
  await expect(page.getByRole('heading', { name: 'Reading your form' })).toBeVisible();
  await page.getByRole('button', { name: 'Open the guide' }).click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/form\/demo-student-support-v1$/);
}

const noHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
};

/** Below 1024px the workspace is one panel with Guide / Original / Ask tabs. */
const isNarrow = (page: Page) => (page.viewportSize()?.width ?? 1280) < 1024;

async function openChat(page: Page) {
  if (isNarrow(page)) await page.getByRole('tab', { name: 'Ask' }).click();
  else await page.getByRole('button', { name: 'Ask about this form' }).click();
}

async function closeChat(page: Page) {
  if (isNarrow(page)) await page.getByRole('tab', { name: 'Guide' }).click();
  else await page.getByRole('button', { name: 'Close' }).first().click();
}

/** Move to a question the way the current layout offers. */
async function goToField(page: Page, label: string) {
  if (isNarrow(page)) await page.getByLabel('Jump to a question').selectOption({ label });
  else await page.getByRole('button', { name: label, exact: true }).click();
}

test.describe('the guided flow', () => {
  test('upload, read the source, ask, switch language, check, fix and export', async ({ page }) => {
    await openSample(page);

    // The demo badge is present for as long as fixtures are answering.
    await expect(page.getByText('Demo data')).toBeVisible();
    await expect(page.getByText('Synthetic demo document — not an official scheme')).toBeVisible();

    // --- the guide, with the original alongside it --------------------------
    await expect(page.getByRole('heading', { name: 'Full name of applicant' })).toBeVisible();
    await expect(page.getByText('What does this mean?')).toBeVisible();
    await page.getByRole('button', { name: /Page 1 · Question 1/ }).click();
    if (isNarrow(page)) await expect(page.getByRole('tab', { name: 'Original' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('source-highlight')).toBeVisible({ timeout: 15_000 });
    if (isNarrow(page)) await page.getByRole('tab', { name: 'Guide' }).click();

    // --- an unsupported question comes back honestly ------------------------
    await openChat(page);
    await page.getByLabel('Ask a question about this form').fill('Is Aadhaar accepted?');
    await page.getByRole('button', { name: 'Send question' }).click();
    await expect(page.getByText('Not in this form')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/never mentions Aadhaar/)).toBeVisible();
    await closeChat(page);

    // --- language switch leaves canonical answers alone ---------------------
    const nameField = page.getByLabel('Your answer — Full name of applicant');
    await expect(nameField).toHaveValue('Meera Anand Kulkarni');
    await page.getByLabel('Explanation language').selectOption('hi');
    await expect(page.getByText('फ़ॉर्म को आपका नाम')).toBeVisible({ timeout: 15_000 });
    await expect(nameField).toHaveValue('Meera Anand Kulkarni');
    // The original label is never translated.
    await expect(page.getByRole('heading', { name: 'Full name of applicant' })).toBeVisible();
    await page.getByLabel('Explanation language').selectOption('en');

    // --- the check finds the three seeded mistakes --------------------------
    await page.getByRole('link', { name: 'Form check' }).click();
    await page.getByRole('button', { name: 'Run the check' }).click();
    await expect(page.getByRole('heading', { name: /Must fix \(2\)/ })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/six-digit PIN code. You entered 5 characters/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Documents not marked ready \(1\)/ })).toBeVisible();

    // --- fix them -----------------------------------------------------------
    await page.getByRole('link', { name: 'Fix this' }).first().click();
    await expect(page).toHaveURL(/field=fld-pin/);
    await page.getByLabel('Your answer — PIN code').fill('580009');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.goto('/form/demo-student-support-v1?field=fld-doc-number');
    await page.getByLabel('Your answer — Supporting document reference number').fill('STU-2024-114520');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Documents' }).click();
    await page
      .getByRole('checkbox', { name: 'I have this ready' })
      .nth(1)
      .click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

    // --- and the result changes --------------------------------------------
    await page.getByRole('link', { name: 'Run the form check' }).click();
    await page.getByRole('button', { name: /Run the check|Check again/ }).click();
    await expect(page.getByText('No issues found by the configured checks')).toBeVisible({
      timeout: 15_000,
    });
    // Never phrased as approval, and the unsettled item is still shown.
    await expect(page.getByText(/not approval and not a guarantee/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Only you can settle these \(1\)/ })).toBeVisible();

    // --- export -------------------------------------------------------------
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('formfix-review-summary.json');
  });

  test('editing an answer marks the previous result stale', async ({ page }) => {
    await openSample(page);
    await page.getByRole('link', { name: 'Form check' }).click();
    await page.getByRole('button', { name: 'Run the check' }).click();
    await expect(page.getByRole('heading', { name: /Must fix/ })).toBeVisible({ timeout: 15_000 });

    // Navigate within the app: a full page load would drop the in-memory
    // report, and it is the staleness of a held report we are testing.
    await page.getByRole('link', { name: 'Guide' }).click();
    await goToField(page, 'City or town');
    await page.getByLabel('Your answer — City or town').fill('Hubballi');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('link', { name: 'Form check' }).click();
    await expect(page.getByText('These results are out of date')).toBeVisible();
  });

  test('reload keeps the answers already saved', async ({ page }) => {
    await openSample(page);
    await page.goto('/form/demo-student-support-v1?field=fld-city');
    await page.getByLabel('Your answer — City or town').fill('Belagavi');
    await expect(page.getByText('Saved', { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByLabel('Your answer — City or town')).toHaveValue('Belagavi', {
      timeout: 15_000,
    });
  });

  test('an expired session offers a way back rather than a dead end', async ({ page }) => {
    await openSample(page);
    await page.evaluate(() =>
      sessionStorage.setItem('formfix.demo.faults', JSON.stringify({ sessionExpired: true })),
    );
    await page.reload();
    await expect(page.getByText('Your session has ended')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Start a new session' })).toBeVisible();
  });
});

test.describe('layout', () => {
  for (const width of [360, 768, 1280]) {
    test(`fits ${width}px without sideways scrolling`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await noHorizontalOverflow(page);

      await openSample(page);
      await noHorizontalOverflow(page);

      await page.getByRole('link', { name: 'Documents' }).click();
      await expect(page.getByRole('heading', { name: 'Documents this form asks for' })).toBeVisible();
      await noHorizontalOverflow(page);
    });
  }

  test('offers Guide, Original and Ask tabs on a narrow screen', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await openSample(page);

    await expect(page.getByRole('tab', { name: 'Guide' })).toBeVisible();
    await page.getByRole('tab', { name: 'Ask' }).click();
    await expect(page.getByText('Asking about')).toBeVisible();

    // Moving between tabs keeps the question you were on.
    await page.getByRole('tab', { name: 'Guide' }).click();
    await expect(page.getByRole('heading', { name: 'Full name of applicant' })).toBeVisible();
  });
});

test.describe('keyboard', () => {
  test('reaches the sample form and the guide without a mouse', async ({ page }) => {
    await page.goto('/');
    // The skip link is reachable and shows itself once focused.
    const skip = page.getByRole('link', { name: 'Skip to main content' });
    await skip.focus();
    await expect(skip).toBeFocused();
    await expect(skip).toBeInViewport();

    // Tabbing forward reaches the sample button without a mouse.
    const sample = page.getByRole('button', { name: 'Try a sample form' });
    for (let i = 0; i < 15 && !(await sample.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press('Tab');
    }
    await expect(sample).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Open the guide' }).click({ timeout: 20_000 });

    const input = page.getByLabel('Your answer — Full name of applicant');
    await input.focus();
    await expect(input).toBeFocused();
  });
});
