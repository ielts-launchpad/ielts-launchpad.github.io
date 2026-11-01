import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { loadAllTests } from '../../src/engine/content/loader';
import { gradeQuestion } from '../../src/engine/grading/grade';
import type { QuestionGroup } from '../../src/engine/content/schema';
import { expandOptionalWords } from '../../src/engine/text/words';
import { skillBand } from '../../src/exams/ielts/bands';
import { buildReadingRunnerData } from '../../src/engine/content/runner-data';
import { mockRunnerFixture } from '../fixtures/reading-mock';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';
import { endPart, gotoListening, waitListeningSaved } from './helpers/listening';

const sample = loadAllTests({ contentDir: join(process.cwd(), 'content'), publicDir: join(process.cwd(), 'public'), includeDrafts: true })
  .find((content) => content.meta.id === 'sample-01');
if (!sample) throw new Error('sample-01 fixture missing');
const readingGroups = sample.reading.flatMap((section) => section.passage.groups);
const listeningGroups = sample.listening.flatMap((section) => section.part.groups);

async function answerAll(page: Page, groups: QuestionGroup[]): Promise<void> {
  for (const group of groups) {
    for (const question of group.questions) {
      const answer = question.answers[0];
      switch (group.interaction) {
        case 'gap': await page.getByTestId(`gap-${question.id}`).fill(expandOptionalWords(answer)[0]); break;
        case 'select': await page.getByTestId(`select-${question.id}`).selectOption(answer); break;
        case 'single': await page.getByTestId(`single-${question.id}`).locator(`input[value="${answer}"]`).check(); break;
        case 'multi':
          for (const option of question.answers) await page.getByTestId(`multi-${question.id}`).getByTestId(`multi-option-${option}`).check();
          break;
        case 'dragBank':
          await page.getByTestId(`bank-${answer}`).click();
          await page.getByTestId(`slot-${question.id}`).click();
          break;
      }
    }
  }
}

async function submit(page: Page, skill: 'reading' | 'listening'): Promise<void> {
  if (skill === 'reading') {
    await gotoReading(page);
    await showQuestions(page);
  } else await gotoListening(page);
  await answerAll(page, skill === 'reading' ? readingGroups : listeningGroups);
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  if (skill === 'reading') await waitForAutosave(page);
  else await waitListeningSaved(page);
  await page.getByTestId('results-link').click();
  await expect(page.getByTestId('results-page')).toBeVisible();
}

for (const skill of ['reading', 'listening'] as const) {
  test(`${skill} results match sample-01 grading, all review fields, and issue links`, async ({ page }) => {
    await submit(page, skill);
    const groups = skill === 'reading' ? readingGroups : listeningGroups;
    const max = groups.flatMap((group) => group.questions.map((question) => gradeQuestion(group, question,
      group.interaction === 'multi' ? question.answers : expandOptionalWords(question.answers[0])[0]))).reduce((sum, result) => sum + result.maxMarks, 0);
    await expect(page.getByTestId('results-score')).toHaveText(`${max}/${max}`);
    await expect(page.getByTestId('results-band')).toHaveCount(0);
    await expect(page.getByText('Estimated band', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('results-percentage')).toHaveText('100%');
    await expect(page.getByText('Band estimates need a full 40-question section', { exact: true })).toBeVisible();
    await expect(page.getByTestId('section-score-1')).toContainText(`${max}/${max}`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    for (const group of groups) {
      for (const question of group.questions) {
        const review = page.getByTestId(`review-${question.id}`);
        await expect(review).toContainText('Your answer');
        await expect(review).toContainText('Correct answer(s)');
        await expect(review).toContainText('Correct');
        await expect(review).toContainText('Error type');
        await expect(review).toContainText('None');
        await expect(review).toContainText('Explanation');
        if (question.explanation && typeof question.explanation === 'string') await expect(review).toContainText(question.explanation);
        if (question.evidence) {
          await review.locator('summary').click();
          await expect(review.locator('mark')).toContainText(question.evidence.quote);
        }
        const issue = new URL(await review.getByRole('link', { name: 'Something wrong with this question?' }).getAttribute('href') ?? '');
        expect(JSON.parse(issue.searchParams.get('body') ?? '{}')).toMatchObject({ testId: 'sample-01', questionId: question.id });
      }
    }
    if (skill === 'reading') await expect(page.getByRole('button', { name: 'Play answer location' })).toHaveCount(0);
    await expectNoA11yViolations(page);
    const response = await page.reload();
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId('results-score')).toHaveText(`${max}/${max}`);
    await expect(page.getByTestId('results-band')).toHaveCount(0);
  });
}

test('a full 40-question Reading mock still shows its estimated band', async ({ page }) => {
  const mock = mockRunnerFixture(buildReadingRunnerData(sample));
  await page.goto('/test/mock-fixture/reading?mode=practice');
  await expect(page.getByTestId('runner-mode')).toHaveText('Exam mode');
  await expect(page.getByTestId('navigator').locator('li')).toHaveCount(40);
  await answerAll(page, mock.passages.flatMap((passage) => passage.groups));
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  await waitForAutosave(page);
  await page.getByTestId('results-link').click();
  await expect(page.getByTestId('results-score')).toHaveText('40/40');
  await expect(page.getByTestId('results-band')).toHaveText(String(skillBand('reading', 'academic', 40)));
  await expect(page.getByText('Band estimates need a full 40-question section', { exact: true })).toHaveCount(0);
  for (const [number, max] of [[1, 14], [2, 13], [3, 13]]) {
    await expect(page.getByTestId(`section-score-${number}`)).toContainText(`${max}/${max}`);
  }
  await expectNoA11yViolations(page);
});

test('listening answer-location seeks to audioStart minus three seconds and plays', async ({ page }) => {
  await submit(page, 'listening');
  const review = page.getByTestId('review-L1-q1');
  const audio = page.getByTestId('results-audio');
  await review.getByRole('button', { name: 'Play answer location' }).click();
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(5.2);
  expect(await audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeLessThan(7.2);
  await page.getByTestId('review-L1-q2').getByRole('button', { name: 'Play answer location' }).click();
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(11);
  expect(await audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeLessThan(13);
  expect(await audio.evaluate((node) => (node as HTMLAudioElement).paused)).toBe(false);
  await review.getByRole('button', { name: 'Play answer location' }).click();
  await expect.poll(() => audio.evaluate((node) => (node as HTMLAudioElement).currentTime)).toBeLessThan(7.2);
  await expect.poll(async () => Number(await page.getByTestId('audio-seek').inputValue())).toBeGreaterThanOrEqual(5.2);
});

test('shared Results player reloads metadata and progress when replay switches audio parts', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-31T12:00:00Z') });
  await page.goto('/test/mock-listening-fixture/listening');
  await page.getByTestId('audio-play').click();
  for (let part = 1; part <= 4; part += 1) {
    await expect(page.getByTestId('listening-part')).toHaveText(`Part ${part}`);
    await expect(page.getByTestId('audio-play')).toBeDisabled();
    await endPart(page);
  }
  await expect(page.getByTestId('listening-review')).toBeVisible();
  await page.clock.fastForward(120_000);
  await waitListeningSaved(page);
  await page.getByTestId('results-link').click();
  const audio = page.getByTestId('results-audio');
  for (const [question, part] of [['mock-q11', 2], ['mock-q1', 1]] as const) {
    await page.getByTestId(`review-${question}`).getByRole('button', { name: 'Play answer location' }).click();
    await expect(audio).toHaveAttribute('src', `/audio/academic/sample-01/part-1.opus?fixture-part=${part}`);
    await expect.poll(() => audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeGreaterThanOrEqual(5.2);
    expect(await audio.evaluate((element) => (element as HTMLAudioElement).currentTime)).toBeLessThan(7.2);
    await expect(page.getByTestId('audio-time')).toContainText('of 0:24');
  }
});

test('incorrect and blank answers show their actual error classifications', async ({ page }) => {
  await gotoListening(page);
  await page.getByTestId('gap-L1-q1').fill('main entrance');
  await page.getByTestId('gap-L1-q2').fill('north gates');
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  await waitListeningSaved(page);
  await page.getByTestId('results-link').click();
  await expect(page.getByTestId('results-score')).toHaveText('1/4');
  await expect(page.getByTestId('results-percentage')).toHaveText('25%');
  await expect(page.getByTestId('results-band')).toHaveCount(0);
  await expect(page.getByTestId('review-L1-q2')).toContainText('Singular or plural mismatch');
  await expect(page.getByTestId('review-L1-q3')).toContainText('Blank answer');
  await expect(page.getByTestId('review-L1-q3')).toContainText('No answer');
});

test('unknown or absent id returns HTTP 200 with a device-local not-found state', async ({ page }) => {
  for (const url of ['/results?attemptId=another-device', '/results']) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Result not found on this device' })).toBeFocused();
    await expect(page.getByRole('link', { name: 'Browse tests' })).toHaveAttribute('href', '/tests');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
    await expectNoA11yViolations(page);
  }
});

test.describe('results mobile 360px', () => {
  test.use(MOBILE);
  for (const skill of ['reading', 'listening'] as const) {
    test(`${skill} results and evidence are accessible`, async ({ page }) => {
      await submit(page, skill);
      await page.locator('summary').first().click();
      await expectNoA11yViolations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    });
  }
});

test('opening a real result in another browser context shows the device-local message', async ({ page, browser }) => {
  await submit(page, 'listening');
  const otherContext = await browser.newContext();
  try {
    const otherPage = await otherContext.newPage();
    const response = await otherPage.goto(page.url());
    expect(response?.status()).toBe(200);
    await expect(otherPage.getByRole('heading', { name: 'Result not found on this device' })).toBeVisible();
    await otherPage.getByRole('link', { name: 'Browse tests' }).click();
    await expect(otherPage).toHaveURL(/\/tests\/?$/);
  } finally {
    await otherContext.close();
  }
});