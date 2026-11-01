import { expect, type Page } from '@playwright/test';

/** The draft sample reading runner route (reachable because the route builds
 * drafts with a noindex tag — SPEC §5, M3). */
export const READING_URL = '/practice/sample-01/reading';

/** 360px mobile viewport with touch, for the mobile/touch coverage (SPEC §10). */
export const MOBILE = { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true };

/** Navigate to the reading runner and wait for the React island to hydrate. */
export async function gotoReading(page: Page, mode?: 'exam' | 'practice'): Promise<void> {
  const url = mode ? `${READING_URL}?mode=${mode}` : READING_URL;
  await page.goto(url);
  await expect(page.getByTestId('runner-content')).toBeVisible();
}

/** On mobile the questions pane sits behind a tab; reveal it when present. */
export async function showQuestions(page: Page): Promise<void> {
  const tab = page.getByTestId('tab-questions');
  if (await tab.isVisible()) await tab.click();
}

/** Let IndexedDB autosave flush before a reload-based persistence check. */
export async function waitForAutosave(page: Page): Promise<void> {
  await page.waitForTimeout(300);
}
