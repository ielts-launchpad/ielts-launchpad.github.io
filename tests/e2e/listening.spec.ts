import { expect, test } from '@playwright/test';
import alignment from '../../tools/audio/sample-01.alignment.json' with { type: 'json' };
import { sampleAudioDuration } from '../fixtures/sample-audio';
import { expectNoA11yViolations } from './helpers/a11y';
import { MOBILE } from './helpers/runner';
import { endPart, gotoListening, waitListeningSaved } from './helpers/listening';

test('committed spoken Opus decodes, advances and has sound in every aligned chunk', async ({ page }) => {
  await gotoListening(page);
  await expect(page.getByTestId('listening-runner')).not.toContainText('silent placeholder');
  await expect(page.getByText('This draft uses locally generated synthetic speech for testing, not a recording of real speakers.', { exact: false })).toBeVisible();
  const audio = page.getByTestId('listening-audio');
  await page.getByTestId('audio-play').click();
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThan(0.2);
  expect(await audio.evaluate((node) => ({ paused: (node as HTMLAudioElement).paused, error: (node as HTMLAudioElement).error?.code ?? null })))
    .toEqual({ paused: false, error: null });
  await expect(page.getByTestId('audio-status')).toHaveText('Audio playing');
  const spans = alignment.turns.flatMap((turn) => turn.chunks.map((chunk) => ({
    start: chunk.startSample / alignment.sampleRate, end: chunk.endSample / alignment.sampleRate,
  })));
  const decoded = await audio.evaluate(async (node, chunks) => {
    const context = new AudioContext({ sampleRate: 24000 });
    try {
      const response = await fetch((node as HTMLAudioElement).currentSrc);
      if (!response.ok) throw new Error('Sample audio fetch failed');
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const samples = buffer.getChannelData(0);
      return { duration: buffer.duration, channels: buffer.numberOfChannels,
        rms: chunks.map(({ start, end }) => {
          const values = samples.subarray(Math.floor(start * buffer.sampleRate), Math.ceil(end * buffer.sampleRate));
          let squares = 0;
          for (const value of values) squares += value * value;
          return Math.sqrt(squares / values.length);
        }) };
    } finally { await context.close(); }
  }, spans);
  expect(decoded.duration).toBeCloseTo(sampleAudioDuration, 2);
  expect(decoded.channels).toBe(1);
  expect(decoded.rms).toHaveLength(spans.length);
  for (const rms of decoded.rms) expect(rms).toBeGreaterThan(0.01);
});

test('exam blocks pause, seek, replay and answer checks', async ({ page }) => {
  await gotoListening(page, 'exam');
  await expect(page.getByTestId('audio-pause')).toBeDisabled();
  await expect(page.getByTestId('audio-seek')).toBeDisabled();
  await expect(page.getByTestId('audio-replay')).toBeDisabled();
  await expect(page.getByTestId('submit-button')).toBeDisabled();
  await expect(page.getByTestId('check-answer')).toHaveCount(0);
  await page.getByTestId('audio-play').click();
  const audio = page.getByTestId('listening-audio');
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThan(0.2);
  await audio.evaluate((node) => { (node as HTMLAudioElement).currentTime = 20; });
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeLessThan(5);
  await audio.evaluate((node) => (node as HTMLAudioElement).pause());
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).paused)).toBe(false);
});

test('mock ignores mode override, auto-advances four parts, reviews 120s then submits', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00Z') });
  await page.goto('/test/mock-listening-fixture/listening?mode=practice');
  await expect(page.getByTestId('runner-mode')).toHaveText('Exam mode');
  await expect(page.getByTestId('navigator').locator('li')).toHaveCount(40);
  await page.getByTestId('audio-play').click();
  for (let number = 1; number <= 4; number++) {
    await expect(page.getByTestId('listening-part')).toHaveText(`Part ${number}`);
    await expect(page.getByTestId('audio-play')).toBeDisabled();
    await endPart(page);
  }
  await expect(page.getByTestId('listening-review')).toBeVisible();
  await expect(page.getByTestId('timer-clock')).toHaveAttribute('data-remaining', '120');
  await page.getByTestId('gap-mock-q1').fill('main entrance');
  await page.clock.fastForward(119_000);
  await expect(page.getByTestId('timer-clock')).toHaveAttribute('data-remaining', '1');
  await expect(page.getByTestId('result-banner')).toHaveCount(0);
  await page.clock.fastForward(1000);
  await expect(page.getByTestId('result-score')).toHaveText('You scored 1 out of 40.');
  await waitListeningSaved(page);
  await page.getByTestId('results-link').click();
  await expect(page.getByTestId('results-score')).toHaveText('1/40');
  await expect(page.getByTestId('results-band')).toHaveText('1');
  await expect(page.getByText('Band estimates need a full 40-question section', { exact: true })).toHaveCount(0);
});

test('practice supports labelled play/pause/seek/replay controls', async ({ page }) => {
  await gotoListening(page);
  await page.getByTestId('audio-play').click();
  await expect(page.getByTestId('audio-pause')).toBeEnabled();
  await page.getByTestId('audio-pause').click();
  await expect.poll(() => page.getByTestId('listening-audio').evaluate((node) => (node as HTMLAudioElement).paused)).toBe(true);
  await page.getByTestId('audio-seek').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('PageUp');
  await expect.poll(() => page.getByTestId('listening-audio').evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await page.getByTestId('audio-replay').click();
  await expect.poll(() => page.getByTestId('listening-audio').evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeLessThan(3);
  await expect(page.getByTestId('audio-status')).toHaveText('Audio playing');
  await endPart(page);
  await expect(page.getByTestId('listening-review')).toHaveCount(0);
  await expect(page.getByTestId('submit-button')).toBeEnabled();
});

test('answers and play-once position resume after reload', async ({ page }) => {
  await gotoListening(page, 'exam');
  await page.getByTestId('gap-L1-q1').fill('main entrance');
  await page.getByTestId('audio-play').click();
  await expect.poll(() => page.getByTestId('listening-audio').evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThan(1.1);
  await waitListeningSaved(page);
  await page.reload();
  await expect(page.getByTestId('gap-L1-q1')).toHaveValue('main entrance');
  await expect(page.getByTestId('audio-play')).toHaveText('Resume listening');
  await expect.poll(() => page.getByTestId('listening-audio').evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(1);
});

test('review countdown persists across reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00Z') });
  await gotoListening(page, 'exam');
  await page.getByTestId('audio-play').click();
  await expect(page.getByTestId('audio-play')).toBeDisabled();
  await endPart(page);
  await expect(page.getByTestId('listening-review')).toBeVisible();
  await page.clock.fastForward(60_000);
  await waitListeningSaved(page);
  await page.reload();
  await expect(page.getByTestId('timer-clock')).toHaveAttribute('data-remaining', '60');
  await page.clock.fastForward(60_000);
  await expect(page.getByTestId('result-banner')).toBeVisible();
});

test('listening runner axe passes on desktop', async ({ page }) => {
  await gotoListening(page);
  await expectNoA11yViolations(page);
});

test.describe('listening mobile 360px', () => {
  test.use(MOBILE);
  test('keyboard/touch controls and questions with axe', async ({ page }) => {
    await gotoListening(page);
    await page.getByTestId('audio-play').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('audio-status')).toHaveText('Audio playing');
    await page.getByTestId('gap-L1-q1').fill('main entrance');
    await waitListeningSaved(page);
    await expectNoA11yViolations(page);
    await page.reload();
    await expect(page.getByTestId('gap-L1-q1')).toHaveValue('main entrance');
  });
});

test('native audio ended event enters review without a simulated end event', async ({ page }) => {
  await gotoListening(page, 'exam');
  // Accelerate the media test only; no speed control exists in the exam UI.
  await page.getByTestId('listening-audio').evaluate((node) => { (node as HTMLAudioElement).playbackRate = 16; });
  await page.getByTestId('audio-play').click();
  await expect(page.getByTestId('listening-review')).toBeVisible({ timeout: Math.ceil(sampleAudioDuration / 16 * 1000) + 8000 });
  expect(await page.getByTestId('listening-audio').evaluate((node) => (node as HTMLAudioElement).error)).toBeNull();
});