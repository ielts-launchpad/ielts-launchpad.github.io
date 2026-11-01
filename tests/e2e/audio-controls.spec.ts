import { expect, test, type Page } from '@playwright/test';
import { sampleAudioTime } from '../fixtures/sample-audio';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoListening, waitListeningSaved } from './helpers/listening';
import { MOBILE } from './helpers/runner';

async function openPlayer(page: Page, results: boolean): Promise<void> {
  await gotoListening(page);
  if (!results) return;
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  await waitListeningSaved(page);
  await page.getByTestId('results-link').click();
  await expect(page.getByTestId('results-page')).toBeVisible();
}

async function checkPlayer(page: Page, results: boolean): Promise<void> {
  await openPlayer(page, results);
  const audio = page.getByTestId(results ? 'results-audio' : 'listening-audio');
  const progress = page.getByTestId('audio-seek');
  await expect(audio).toBeHidden();
  expect(await audio.evaluate((element) => (element as HTMLAudioElement).controls)).toBe(false);
  await expect(progress).toBeEnabled();
  await expect(progress).toHaveAccessibleName('Audio position (seconds)');
  await expect(page.getByTestId('audio-play')).toHaveAccessibleName('Play');
  await expect(page.getByTestId('audio-pause')).toHaveAccessibleName('Pause');
  await expect(page.getByTestId('audio-time')).toHaveText(`0:00 of ${sampleAudioTime}`);
  await page.getByTestId('audio-play').focus();
  await page.keyboard.press('Space');
  await expect.poll(async () => Number(await progress.inputValue())).toBeGreaterThan(0.2);
  expect(await progress.evaluate((element) => element.style.getPropertyValue('--audio-position'))).not.toBe('0%');
  await page.getByTestId('audio-pause').focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
  await progress.focus();
  await page.keyboard.press('Home');
  await expect(progress).toHaveValue('0');
  await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveValue('5');
  await expect(progress).toHaveAttribute('aria-valuetext', `0:05 of ${sampleAudioTime}`);
  await expect(page.getByTestId('audio-time')).toHaveText(`0:05 of ${sampleAudioTime}`);
  await page.keyboard.press('ArrowUp');
  await expect(progress).toHaveValue('10');
  await page.keyboard.press('ArrowLeft');
  await expect(progress).toHaveValue('5');
  await page.keyboard.press('ArrowDown');
  await expect(progress).toHaveValue('0');
  expect(await progress.evaluate((element) => getComputedStyle(element).outlineWidth)).toBe('3px');
  const palette = await progress.evaluate((element) => {
    // Native slider pseudo-elements aren't exposed consistently through CSSOM.
    const style = getComputedStyle(element);
    return Object.fromEntries(['played', 'unplayed', 'border', 'thumb', 'focus'].map((name) =>
      [name, style.getPropertyValue(`--audio-${name}`).trim()]));
  });
  expect(palette).toEqual({ played: '#0f172a', unplayed: '#e2e8f0', border: '#0f172a', thumb: '#ffffff', focus: '#1d4ed8' });
  await page.keyboard.press('Enter');
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(true);
  await expectNoA11yViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const results of [false, true]) {
  test(`${results ? 'Results' : 'Listening practice'} progress updates, seeks by keyboard and passes axe`, async ({ page }) => {
    await checkPlayer(page, results);
  });
}

async function checkExam(page: Page): Promise<void> {
  await gotoListening(page, 'exam');
  const progress = page.getByTestId('audio-seek');
  const audio = page.getByTestId('listening-audio');
  await expect(progress).toBeDisabled();
  await expect(progress).toHaveAccessibleName('Audio progress (read-only)');
  await expect(progress).toHaveAttribute('aria-readonly', 'true');
  await page.getByTestId('audio-play').focus();
  await page.keyboard.press('Enter');
  await expect.poll(async () => Number(await progress.inputValue())).toBeGreaterThan(0.2);
  await progress.dispatchEvent('keydown', { key: 'ArrowRight' });
  await progress.dispatchEvent('keydown', { key: 'Enter' });
  expect(await audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeLessThan(3);
  expect(await audio.evaluate((element) => (element as HTMLAudioElement).paused)).toBe(false);
  await audio.evaluate((element) => { (element as HTMLAudioElement).currentTime = 20; });
  await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeLessThan(3);
  await expect(page.getByTestId('audio-pause')).toBeDisabled();
  await expectNoA11yViolations(page);
}

test('exam progress updates but neither keyboard nor media seeking bypasses play-once', async ({ page }) => {
  await checkExam(page);
});

test.describe('custom player mobile 360px', () => {
  test.use(MOBILE);
  for (const results of [false, true]) {
    test(`${results ? 'Results' : 'Listening practice'} keyboard and contrast controls pass axe`, async ({ page }) => {
      await checkPlayer(page, results);
    });
  }
  test('read-only exam progress passes axe', async ({ page }) => { await checkExam(page); });
});