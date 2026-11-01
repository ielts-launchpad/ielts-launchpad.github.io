import { expect, test, type Page } from '@playwright/test';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';

/**
 * `gap` interaction coverage (SPEC §4, §5). Sample-01 Q16 (sentence completion,
 * ≤2 words) exercises the live word-limit hint; Q18 is a template note-gap.
 */

function gap(page: Page, qid: string) {
  return page.getByTestId(`gap-${qid}`);
}

function hint(page: Page, qid: string) {
  return page.getByTestId(`gap-hint-${qid}`);
}

test.describe('reading runner — gap (desktop)', () => {
  test('types an answer', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q16').fill('decades');
    await expect(gap(page, 'p1-q16')).toHaveValue('decades');
  });

  test('clears an answer', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q16').fill('decades');
    await gap(page, 'p1-q16').fill('');
    await expect(gap(page, 'p1-q16')).toHaveValue('');
  });

  test('changes the answer', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q16').fill('decades');
    await gap(page, 'p1-q16').fill('years');
    await expect(gap(page, 'p1-q16')).toHaveValue('years');
  });

  test('warns when the word limit is exceeded', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q16').fill('one two three');
    await expect(hint(page, 'p1-q16')).toContainText('Too many words');
    await expect(gap(page, 'p1-q16')).toHaveAttribute('aria-invalid', 'true');
  });

  test('fills a template gap', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q18').fill('distance');
    await expect(gap(page, 'p1-q18')).toHaveValue('distance');
  });

  test('is operable with the keyboard only', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q16').focus();
    await page.keyboard.type('register');
    await expect(gap(page, 'p1-q16')).toHaveValue('register');
  });

  test('persists the answer after reload', async ({ page }) => {
    await gotoReading(page);
    await gap(page, 'p1-q16').fill('decades');
    await gap(page, 'p1-q18').fill('distance');
    await waitForAutosave(page);
    await page.reload();
    await expect(page.getByTestId('runner-content')).toBeVisible();
    await expect(gap(page, 'p1-q16')).toHaveValue('decades');
    await expect(gap(page, 'p1-q18')).toHaveValue('distance');
  });
});

test.describe('reading runner — gap (mobile 360px)', () => {
  test.use(MOBILE);

  test('types an answer on a touch viewport', async ({ page }) => {
    await gotoReading(page);
    await showQuestions(page);
    await gap(page, 'p1-q16').fill('decades');
    await expect(gap(page, 'p1-q16')).toHaveValue('decades');
  });
});
