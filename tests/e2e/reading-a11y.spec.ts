import { test } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoReading, MOBILE, showQuestions } from './helpers/runner';

/**
 * Accessibility coverage for the Reading runner (SPEC §10). axe must find zero
 * serious/critical violations in both the desktop two-column layout and the
 * mobile tabbed layout (passage and questions panes).
 */

test('reading runner has no serious/critical a11y violations (desktop)', async ({ page }) => {
  await gotoReading(page);
  await expectNoA11yViolations(page);
});

test.describe('reading runner a11y (mobile 360px)', () => {
  test.use(MOBILE);

  test('passage pane is accessible', async ({ page }) => {
    await gotoReading(page);
    await expectNoA11yViolations(page);
  });

  test('questions pane is accessible', async ({ page }) => {
    await gotoReading(page);
    await showQuestions(page);
    await expectNoA11yViolations(page);
  });
});
