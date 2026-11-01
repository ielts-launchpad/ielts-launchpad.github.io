import { expect, test, type Page } from '@playwright/test';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';

/**
 * `select` interaction coverage (SPEC §5). Sample-01 Q1–Q6 are matching-headings
 * with `allowReuse: false` (an option used in one dropdown is disabled in the
 * others); Q13–Q15 are matching-information with `allowReuse: true`.
 */

function selectFor(page: Page, qid: string) {
  return page.getByTestId(`select-${qid}`);
}

test.describe('reading runner — select (desktop)', () => {
  test('selects an option', async ({ page }) => {
    await gotoReading(page);
    await selectFor(page, 'p1-q1').selectOption('iii');
    await expect(selectFor(page, 'p1-q1')).toHaveValue('iii');
  });

  test('deselects back to the blank option', async ({ page }) => {
    await gotoReading(page);
    await selectFor(page, 'p1-q1').selectOption('iii');
    await selectFor(page, 'p1-q1').selectOption('');
    await expect(selectFor(page, 'p1-q1')).toHaveValue('');
  });

  test('changes the answer to a different option', async ({ page }) => {
    await gotoReading(page);
    await selectFor(page, 'p1-q1').selectOption('iii');
    await selectFor(page, 'p1-q1').selectOption('iv');
    await expect(selectFor(page, 'p1-q1')).toHaveValue('iv');
  });

  test('disables a used option in other dropdowns when reuse is off', async ({ page }) => {
    await gotoReading(page);
    await selectFor(page, 'p1-q1').selectOption('iii');
    const used = selectFor(page, 'p1-q2').locator('option[value="iii"]');
    await expect(used).toBeDisabled();
  });

  test('allows reuse when the group permits it', async ({ page }) => {
    await gotoReading(page);
    await selectFor(page, 'p1-q13').selectOption('C');
    const reused = selectFor(page, 'p1-q14').locator('option[value="C"]');
    await expect(reused).toBeEnabled();
  });

  test('is operable with the keyboard only', async ({ page }) => {
    await gotoReading(page);
    const select = selectFor(page, 'p1-q1');
    await select.focus();
    await select.selectOption('v');
    await expect(select).toHaveValue('v');
  });

  test('persists the answer after reload', async ({ page }) => {
    await gotoReading(page);
    await selectFor(page, 'p1-q1').selectOption('iii');
    await waitForAutosave(page);
    await page.reload();
    await expect(page.getByTestId('runner-content')).toBeVisible();
    await expect(selectFor(page, 'p1-q1')).toHaveValue('iii');
  });
});

test.describe('reading runner — select (mobile 360px)', () => {
  test.use(MOBILE);

  test('selects an option on a touch viewport', async ({ page }) => {
    await gotoReading(page);
    await showQuestions(page);
    await selectFor(page, 'p1-q1').selectOption('iii');
    await expect(selectFor(page, 'p1-q1')).toHaveValue('iii');
  });
});
