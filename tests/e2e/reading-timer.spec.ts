import { expect, test } from '@playwright/test';
import { gotoReading } from './helpers/runner';

/**
 * Exam-mode timer coverage (SPEC §5). Uses Playwright's fake clock to assert the
 * 10- and 5-minute warnings and the auto-submit at 0 for the 60-minute Reading
 * section, without waiting in real time.
 */

test.describe('reading runner — exam timer', () => {
  test('is hidden in practice mode', async ({ page }) => {
    await gotoReading(page, 'practice');
    await expect(page.getByTestId('timer')).toHaveCount(0);
  });

  test('announces warnings at 10 and 5 minutes and auto-submits at 0', async ({ page }) => {
    await page.clock.install();
    await gotoReading(page, 'exam');
    await expect(page.getByTestId('timer')).toBeVisible();

    // 50 minutes elapsed → 10 minutes remaining.
    await page.clock.fastForward('50:00');
    await expect(page.getByTestId('timer-announce')).toContainText('10 minutes');

    // 55 minutes elapsed → 5 minutes remaining.
    await page.clock.fastForward('05:00');
    await expect(page.getByTestId('timer-announce')).toContainText('5 minutes');

    // 60 minutes elapsed → auto-submit.
    await page.clock.fastForward('05:00');
    await expect(page.getByTestId('result-banner')).toBeVisible();
  });
});
