import { expect, test, type Page } from '@playwright/test';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';

/**
 * `multi` (Choose N) coverage (SPEC §4, §5). Sample-01 Q11–12 asks for TWO
 * letters from A–E. The UI must block a third pick, show the limit hint, and
 * still allow deselecting one option to choose another.
 */

const QID = 'p1-q11-12';

function option(page: Page, letter: string) {
  return page.getByTestId(`multi-option-${letter}`);
}

function hint(page: Page) {
  return page.getByTestId(`multi-hint-${QID}`);
}

test.describe('reading runner — multi / Choose N (desktop)', () => {
  test('selects two options', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').check();
    await option(page, 'D').check();
    await expect(option(page, 'A')).toBeChecked();
    await expect(option(page, 'D')).toBeChecked();
  });

  test('deselects an option', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').check();
    await option(page, 'A').uncheck();
    await expect(option(page, 'A')).not.toBeChecked();
  });

  test('changes the selection', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').check();
    await option(page, 'D').check();
    await option(page, 'D').uncheck();
    await option(page, 'B').check();
    await expect(option(page, 'A')).toBeChecked();
    await expect(option(page, 'B')).toBeChecked();
    await expect(option(page, 'D')).not.toBeChecked();
  });

  test('blocks a third pick and shows the hint', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').check();
    await option(page, 'B').check();
    await option(page, 'C').click();
    await expect(option(page, 'C')).not.toBeChecked();
    await expect(hint(page)).toBeVisible();
    await expect(hint(page)).toContainText('only 2');
  });

  test('deselecting then selecting another option works after a block', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').check();
    await option(page, 'B').check();
    await option(page, 'C').click();
    await expect(option(page, 'C')).not.toBeChecked();
    await option(page, 'B').uncheck();
    await option(page, 'C').check();
    await expect(option(page, 'C')).toBeChecked();
    await expect(option(page, 'A')).toBeChecked();
  });

  test('is operable with the keyboard only', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').focus();
    await page.keyboard.press('Space');
    await option(page, 'D').focus();
    await page.keyboard.press('Space');
    await expect(option(page, 'A')).toBeChecked();
    await expect(option(page, 'D')).toBeChecked();
  });

  test('persists the selection after reload', async ({ page }) => {
    await gotoReading(page);
    await option(page, 'A').check();
    await option(page, 'D').check();
    await waitForAutosave(page);
    await page.reload();
    await expect(page.getByTestId('runner-content')).toBeVisible();
    await expect(option(page, 'A')).toBeChecked();
    await expect(option(page, 'D')).toBeChecked();
  });
});

test.describe('reading runner — multi / Choose N (mobile 360px)', () => {
  test.use(MOBILE);

  test('selects two options on a touch viewport', async ({ page }) => {
    await gotoReading(page);
    await showQuestions(page);
    await option(page, 'A').check();
    await option(page, 'D').check();
    await expect(option(page, 'A')).toBeChecked();
    await expect(option(page, 'D')).toBeChecked();
  });
});
