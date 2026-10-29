import { expect, test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';

const DISCLAIMER =
  'IELTS is a registered trademark of the British Council, IDP: IELTS Australia and Cambridge University Press & Assessment. This site is not affiliated with, approved or endorsed by them.';

// All §9 stub routes required by M0.4.
const routes = [
  '/',
  '/tests',
  '/dashboard',
  '/planner',
  '/settings',
  '/official-resources',
  '/how-scoring-works',
  '/about',
  '/privacy',
  '/terms',
  '/licences',
  '/support',
];

for (const route of routes) {
  test(`route ${route} returns 200 and renders the footer disclaimer`, async ({ page }) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
  });
}

test('unknown route serves the 404 page with no serious/critical a11y violations', async ({
  page,
}) => {
  const response = await page.goto('/this-route-does-not-exist');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toBeVisible();
  await expectNoA11yViolations(page);
});
