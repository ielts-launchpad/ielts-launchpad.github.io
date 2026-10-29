import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';

const DISCLAIMER =
  'IELTS is a registered trademark of the British Council, IDP: IELTS Australia and Cambridge University Press & Assessment. This site is not affiliated with, approved or endorsed by them.';

test('home page returns 200 and renders the footer disclaimer', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.locator('h1')).toBeVisible();
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
});

test('home page has no serious or critical a11y violations', async ({ page }) => {
  await page.goto('/');
  await expectNoA11yViolations(page);
});
