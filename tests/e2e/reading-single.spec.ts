import { expect, test, type Page } from '@playwright/test';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';

/**
 * `single` interaction coverage (SPEC §5). Uses sample-01 Q7 (multiple choice,
 * A–D). Radio groups have no native deselect, so the matrix here is select →
 * change → keyboard → mobile → persist.
 */

function q7Radio(page: Page, value: string) {
  return page.getByTestId('question-7').locator(`input[type=radio][value="${value}"]`);
}

test.describe('reading runner — single (desktop)', () => {
  test('selects an option', async ({ page }) => {
    await gotoReading(page);
    await q7Radio(page, 'A').check();
    await expect(q7Radio(page, 'A')).toBeChecked();
  });

  test('changes the answer to a different option', async ({ page }) => {
    await gotoReading(page);
    await q7Radio(page, 'A').check();
    await q7Radio(page, 'C').check();
    await expect(q7Radio(page, 'C')).toBeChecked();
    await expect(q7Radio(page, 'A')).not.toBeChecked();
  });

  test('is operable with the keyboard only', async ({ page }) => {
    await gotoReading(page);
    const first = q7Radio(page, 'A');
    await first.focus();
    await page.keyboard.press('ArrowDown');
    await expect(q7Radio(page, 'B')).toBeChecked();
  });

  test('persists the answer after reload', async ({ page }) => {
    await gotoReading(page);
    await q7Radio(page, 'C').check();
    await waitForAutosave(page);
    await page.reload();
    await expect(page.getByTestId('runner-content')).toBeVisible();
    await expect(q7Radio(page, 'C')).toBeChecked();
  });
});

test.describe('reading runner — single (mobile 360px)', () => {
  test.use(MOBILE);

  test('selects an option on a touch viewport', async ({ page }) => {
    await gotoReading(page);
    await showQuestions(page);
    await q7Radio(page, 'A').check();
    await expect(q7Radio(page, 'A')).toBeChecked();
  });
});
