import { expect, type Page } from '@playwright/test';

export const LISTENING_URL = '/test/sample-01/listening';

export async function gotoListening(page: Page, mode: 'exam' | 'practice' = 'practice'): Promise<void> {
  await page.goto(`${LISTENING_URL}?mode=${mode}`);
  await expect(page.getByTestId('listening-runner')).toBeVisible();
}

export async function waitListeningSaved(page: Page): Promise<void> {
  await expect(page.getByTestId('listening-runner')).toHaveAttribute('data-saved', 'true');
}

/** Media time is independent of Playwright's fake JS clock; inject the end event only. */
export async function endPart(page: Page): Promise<void> {
  await page.getByTestId('listening-audio').dispatchEvent('ended');
}