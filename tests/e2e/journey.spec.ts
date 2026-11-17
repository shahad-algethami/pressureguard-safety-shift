import { test, expect, type Page } from '@playwright/test';
import { smartMessages, discrepancyHint, documentationFallback } from '../../lib/smart-messages';
async function start(page: Page, ar = false) {
  await page.goto('/');
  await expect(page.locator('.duration-tag')).toHaveCount(0);
  if (ar) await page.getByRole('button', { name: 'العربية', exact: true }).click();
  await page
    .getByLabel(ar ? 'اسم العرض' : 'Your display name', { exact: true })
    .fill(ar ? 'سارة' : 'Sara');
  await page
    .getByRole('button', { name: ar ? 'ابدأ مناوبتي' : 'Start My Shift', exact: true })
    .click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.locator('.agent-notice p')).toHaveText(smartMessages[ar ? 'ar' : 'en'][0]);
}
async function compare(page: Page, ar = false) {
  await page.getByRole('button', { name: ar ? 'متطابق' : 'Match', exact: true }).click();
  await expect(page.locator('.agent-notice p')).toHaveText(smartMessages[ar ? 'ar' : 'en'][1]);
  await page.getByRole('button', { name: ar ? 'متطابق' : 'Match', exact: true }).click();
  await expect(page.locator('.agent-notice p')).toHaveText(smartMessages[ar ? 'ar' : 'en'][2]);
}
for (const ar of [false, true])
  test(`non-blocking ${ar ? 'Arabic' : 'English'} journey preserves handoff, download and wall`, async ({
    page,
  }) => {
    const errors: string[] = [];
    let oldReviews = 0,
      comments = 0;
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
      if (r.url().endsWith('/api/observation')) oldReviews++;
      if (r.url().endsWith('/api/agent') && r.postDataJSON()?.purpose === 'observation-feedback')
        comments++;
    });
    await start(page, ar);
    await page.getByRole('button', { name: ar ? 'غير متطابق' : 'Mismatch', exact: true }).click();
    await expect(page.locator('.error-banner')).toBeVisible();
    await compare(page, ar);
    await page.getByRole('button', { name: ar ? 'لا' : 'No', exact: true }).click();
    await expect(page.locator('.agent-notice p')).toHaveText(discrepancyHint[ar ? 'ar' : 'en']);
    await expect(
      page.getByRole('button', { name: ar ? 'متابعة' : 'Continue', exact: true }),
    ).toBeDisabled();
    expect(comments).toBe(0);
    const observation = ar
      ? 'سجل الدخول يقول ما عنده حساسية، لكن تقييم التخدير يقول عنده حساسية من البنسلين.'
      : 'The allergy records conflict.';
    await page.locator('#observation').fill(observation);
    await page.getByRole('button', { name: ar ? 'نعم' : 'Yes', exact: true }).click();
    await expect(
      page.getByRole('button', { name: ar ? 'متابعة' : 'Continue', exact: true }),
    ).toBeEnabled();
    await expect(page.locator('.agent-notice p')).toContainText(
      ar ? 'توثيق اختلاف' : 'documenting conflicting',
    );
    await page
      .locator('.task-panel')
      .screenshot({
        path: `artifacts/minimal-update-9ab6ee01/stage3-${ar ? 'ar' : 'en'}-${test.info().project.name}.png`,
      });
    await page.getByRole('button', { name: ar ? 'متابعة' : 'Continue', exact: true }).click();
    await expect(page.locator('#task-title')).toHaveText(
      ar ? 'اختر الخطوة الآمنة التالية' : 'Choose the safe next step',
    );
    expect(oldReviews).toBe(0);
    let state = await (await page.request.get('/api/session')).json();
    expect(state.progress.observationOriginal).toBe(observation);
    expect(state.progress.reviews).toHaveLength(0);
    await page
      .getByRole('button', {
        name: ar ? 'المتابعة بالاعتماد على سجل واحد' : 'Proceed using one record',
        exact: true,
      })
      .click();
    await expect(page.locator('.error-banner')).toBeVisible();
    await page
      .getByRole('button', {
        name: ar ? 'التوقف وطلب التحقق' : 'Pause and request verification',
        exact: true,
      })
      .click();
    await expect(page.locator('.request-preview')).toBeVisible();
    state = await (await page.request.get('/api/session')).json();
    expect(state.progress.request.submittedAt).toBeNull();
    await page
      .getByRole('button', {
        name: ar ? 'تأكيد وإرسال الطلب' : 'Confirm and submit request',
        exact: true,
      })
      .click();
    await expect(page).toHaveURL(/\/complete$/);
    await expect(page.locator('.status-pending')).toHaveText(
      ar ? 'قيد التحقق' : 'Pending Verification',
    );
    const download = page.waitForEvent('download');
    await page
      .getByRole('button', { name: ar ? 'حفظ الملخص' : 'Save summary', exact: true })
      .click();
    const file = await download;
    const stream = await file.createReadStream();
    let body = '';
    for await (const chunk of stream!) body += chunk;
    const report = JSON.parse(body);
    expect(report.request.status).toBe('pending-verification');
    expect(report.visitor).toBe(ar ? 'سارة' : 'Sara');
    const repeat = await page.request.post('/api/session', {
      data: { type: 'submit-request', requestId: state.progress.request.id, confirmed: true },
    });
    expect(repeat.ok()).toBe(true);
    await page
      .getByRole('link', { name: ar ? 'انضم إلى فريق المناوبة' : 'Meet The Shift Team' })
      .click();
    await page
      .getByRole('button', { name: ar ? 'انضم للجدار' : 'Join the wall', exact: true })
      .click();
    await expect(page.locator('.person-node.new-participant')).toBeVisible();
    await page.reload();
    await expect(page.locator('.joined-notice')).toBeVisible();
    await page
      .getByRole('button', { name: ar ? 'إزالة اسمي' : 'Remove my name', exact: true })
      .click();
    await expect(page.locator('.joined-notice')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(errors).toEqual([]);
  });
test('YES with empty, incorrect, failed and delayed feedback always reaches Stage 4', async ({
  page,
}) => {
  for (const observation of [
    '',
    'The patient is cleared and has no allergies.',
    'SERVICE_OUTAGE_TEST',
    'DELAYED_FEEDBACK_TEST',
  ]) {
    await start(page);
    await compare(page);
    await page.locator('#observation').fill(observation);
    let comments = 0;
    const listener = (r: any) => {
      if (r.url().endsWith('/api/agent') && r.postDataJSON()?.purpose === 'observation-feedback')
        comments++;
    };
    page.on('request', listener);
    const failureResponse =
      observation === 'SERVICE_OUTAGE_TEST'
        ? page.waitForResponse(
            (r) =>
              r.url().endsWith('/api/agent') &&
              r.request().postDataJSON()?.purpose === 'observation-feedback',
          )
        : null;
    await page.getByRole('button', { name: 'Yes', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeEnabled();
    if (observation === 'SERVICE_OUTAGE_TEST') {
      await expect.poll(() => comments).toBe(1);
      expect((await (await failureResponse!).json()).mode).toBe('guidance');
      await expect(page.locator('.agent-notice p')).toHaveText(documentationFallback.en);
    }
    if (observation === 'DELAYED_FEEDBACK_TEST') await expect.poll(() => comments).toBe(1);
    if (!observation) {
      await page.getByRole('button', { name: 'العربية', exact: true }).click();
      await expect(page.locator('.agent-notice p')).toHaveText(documentationFallback.ar);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      expect(comments).toBe(0);
    }
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page.locator('#task-title')).toHaveText('Choose the safe next step', {
      timeout: 2500,
    });
    const state = await (await page.request.get('/api/session')).json();
    expect(state.progress.observationOriginal).toBe(observation);
    expect(state.progress.approvedObservation).not.toContain('cleared');
    expect(state.progress.completed).toBe(false);
    expect(state.progress.reviews).toHaveLength(0);
    if (observation === 'DELAYED_FEEDBACK_TEST') {
      // Let the test provider finish after navigation; its late comment must stay ignored.
      await page.waitForTimeout(4000);
      await expect(page.locator('.agent-notice p')).not.toContainText(
        'documenting conflicting allergy information matters',
      );
    }
    await page.reload();
    await expect(page.locator('#task-title')).toHaveText('Choose the safe next step');
    await expect(page.locator('.agent-notice p')).not.toContainText(
      'documenting conflicting allergy information matters',
    );
    page.off('request', listener);
  }
});
