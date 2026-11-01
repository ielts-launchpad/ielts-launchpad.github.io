import { expect, test } from '@playwright/test';
import { gotoReading, waitForAutosave } from './helpers/runner';

test('mock fixture ignores practice override, including after reload', async ({ page }) => {
  await page.goto('/test/mock-fixture/reading?mode=practice');
  await expect(page.getByTestId('runner-mode')).toHaveText('Exam mode');
  await expect(page.getByTestId('timer')).toBeVisible();
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByTestId('runner-mode')).toHaveText('Exam mode');
  await expect(page.getByTestId('timer')).toBeVisible();
});

test('practice permits mode overrides and old route is absent', async ({ page }) => {
  await gotoReading(page, 'exam');
  await expect(page.getByTestId('runner-mode')).toHaveText('Exam mode');
  await gotoReading(page, 'practice');
  await expect(page.getByTestId('runner-mode')).toHaveText('Practice mode');
  await expect(page.getByTestId('timer')).toHaveCount(0);
  const response = await page.goto('/practice/sample-01/reading');
  expect(response?.status()).toBe(404);
});

test('two answers changed in the same task both survive reload', async ({ page }) => {
  await gotoReading(page);
  await page.evaluate(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    for (const [id, value] of [['p1-q16', 'decades'], ['p1-q17', 'gardens']]) {
      const input = document.querySelector<HTMLInputElement>(`[data-testid="gap-${id}"]`);
      if (!input || !setter) throw new Error('Gap input missing');
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await expect(page.getByTestId('gap-p1-q16')).toHaveValue('decades');
  await expect(page.getByTestId('gap-p1-q17')).toHaveValue('gardens');
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByTestId('gap-p1-q16')).toHaveValue('decades');
  await expect(page.getByTestId('gap-p1-q17')).toHaveValue('gardens');
});

test('new attempts use the global font scale setting', async ({ page }) => {
  await gotoReading(page);
  await page.getByTestId('font-increase').click();
  await page.getByTestId('font-increase').click();
  await expect(page.getByTestId('runner-content')).toHaveCSS('font-size', '19.2px');
  await page.getByTestId('gap-p1-q16').fill('decades');
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByTestId('gap-p1-q16')).toHaveValue('');
  await expect(page.getByTestId('runner-content')).toHaveCSS('font-size', '19.2px');
});

test('gap labels describe answering, not navigation', async ({ page }) => {
  await gotoReading(page);
  await expect(page.getByTestId('gap-p1-q16')).toHaveAccessibleName('Answer for question 16');
  await expect(page.getByTestId('gap-p1-q18')).toHaveAccessibleName('Answer for question 18');
});