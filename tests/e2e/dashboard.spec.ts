import { expect, test, type Page } from '@playwright/test';
import { join } from 'node:path';
import { backupSchema, validateBackupRelations } from '../../src/engine/data/backup';
import { questionGroupSchema, type QuestionGroup, type Skill } from '../../src/engine/content/schema';
import { gradeQuestion } from '../../src/engine/grading/grade';
import { loadTips } from '../../src/engine/content/tips-loader';
import type { ResultRecord } from '../../src/lib/storage/db';
import { en } from '../../src/i18n/en';
import { format } from '../../src/i18n/format';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoListening, waitListeningSaved } from './helpers/listening';

const copy = en.dashboard;
const tips = loadTips(join(process.cwd(), 'content/tips.yaml'));
const time = (day: number): number => Date.UTC(2026, 9, day, 12);

async function expectOverallNeeds(page: Page, skills: Skill[]): Promise<void> {
  const needs = page.getByTestId('dashboard-overall-needs');
  await expect(needs).toHaveText(format(copy.overallNeeds, { skills: skills.map((skill) => en.catalog.skills[skill]).join(', ') }));
  await expect(needs.getByRole('link')).toHaveCount(skills.length);
  for (const skill of skills) {
    await expect(needs.getByRole('link', { name: en.catalog.skills[skill], exact: true })).toHaveAttribute('href', `/tests?skill=${skill}`);
  }
}

/** Test-only saved snapshots, graded from their own valid question definitions. */
function snapshot(id: string, skill: ResultRecord['skill'], day: number, groups: QuestionGroup[], answers: Record<string, string | string[] | null>): ResultRecord {
  const results = groups.flatMap((group) => group.questions.map((question) => gradeQuestion(group, question, answers[question.id] ?? null)));
  return {
    attemptId: id, testId: 'dashboard-saved-fixture', skill, createdAt: time(day),
    raw: results.reduce((sum, question) => sum + question.marks, 0),
    max: results.reduce((sum, question) => sum + question.maxMarks, 0), results,
    review: { variant: 'academic', kind: 'practice', answers,
      sections: [{ number: 1, title: 'Saved fixture', text: 'river', groups }] },
  };
}

function full(id: string, skill: ResultRecord['skill'], day: number, raw: number, max = 40): ResultRecord {
  const group = questionGroupSchema.parse({
    id: 'full-group', instructions: 'Complete each answer.', interaction: 'gap', qtype: 'sentence-completion',
    wordLimit: { words: 1 }, questions: Array.from({ length: max }, (_, index) => ({
      id: `Q${index + 1}`, number: index + 1, answers: ['river'], evidence: { quote: 'river' },
    })),
  });
  const answers = Object.fromEntries(group.questions.map((question, index) => [question.id, index < raw ? 'river' : null]));
  return snapshot(id, skill, day, [group], answers);
}

function partial(): ResultRecord {
  const multi = questionGroupSchema.parse({
    id: 'multi', instructions: 'Choose three.', interaction: 'multi', qtype: 'choose-n',
    options: { A: 'First', B: 'Second', C: 'Third', D: 'Fourth', E: 'Fifth' },
    questions: [{ id: 'multi-q', numbers: [1, 2, 3], n: 3, answers: ['A', 'B', 'C'] }],
  });
  const gap = (qtype: 'short-answer' | 'form-completion' | 'sentence-completion', number: number) => questionGroupSchema.parse({
    id: qtype, instructions: 'Complete the answer.', interaction: 'gap', qtype, wordLimit: { words: 1 },
    questions: [{ id: qtype, number, answers: ['river'], evidence: { quote: 'river' } }],
  });
  return snapshot('later-partial', 'reading', 24, [multi, gap('short-answer', 4), gap('form-completion', 5), gap('sentence-completion', 6)], {
    'multi-q': ['A', 'D', 'E'], 'short-answer': null, 'form-completion': 'mountain', 'sentence-completion': 'river',
  });
}

async function seed(page: Page, records: ResultRecord[]): Promise<void> {
  // The production island first creates the real version-one schema.
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.empty);
  const data = backupSchema.parse({
    version: 1, results: records,
    attempts: records.map((record) => ({
      id: record.attemptId, testId: record.testId, skill: record.skill, mode: 'practice', status: 'submitted',
      startedAt: record.createdAt - 1000, updatedAt: record.createdAt, submittedAt: record.createdAt,
      flagged: [], fontScale: 1,
    })),
    answers: records.map((record) => ({ attemptId: record.attemptId, updatedAt: record.createdAt, answers: record.review?.answers ?? {} })),
    highlights: [], settings: [],
  });
  validateBackupRelations(data);
  // IndexedDB accepts structured-clone values; hide Zod's deep inferred type
  // from Playwright's recursive argument serialization types after validation.
  const stored: { attempts: unknown[]; answers: unknown[]; results: unknown[] } = data;
  await page.evaluate(async (backup) => {
    const request = indexedDB.open('ielts-launchpad');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Fixture database open failed'));
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['attempts', 'answers', 'results'], 'readwrite');
        for (const name of ['attempts', 'answers', 'results'] as const) {
          for (const record of backup[name]) transaction.objectStore(name).put(record);
        }
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(new Error('Fixture transaction failed'));
        transaction.onabort = () => reject(new Error('Fixture transaction aborted'));
      });
    } finally { db.close(); }
  }, stored);
  await page.reload();
  await expect(page.getByTestId('dashboard-data')).toBeVisible();
}

test('dashboard empty state links to Tests and is accessible without cookies', async ({ page, context }) => {
  const response = await page.goto('/dashboard');
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.empty);
  await expect(page.getByTestId('dashboard-data')).toHaveCount(0);
  await expectOverallNeeds(page, ['reading', 'listening', 'writing', 'speaking']);
  const needs = page.getByTestId('dashboard-overall-needs');
  await needs.getByRole('link', { name: en.catalog.skills.reading, exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(needs.getByRole('link', { name: en.catalog.skills.listening, exact: true })).toBeFocused();
  const link = page.getByRole('link', { name: copy.testsLink });
  await expect(link).toHaveAttribute('href', '/tests');
  await link.focus();
  await expect(link).toBeFocused();
  await expectNoA11yViolations(page);
  expect(await context.cookies()).toEqual([]);
  await link.press('Enter');
  await expect(page).toHaveURL(/\/tests\/?$/);
});

test('real partial sample submission supplies accuracy, errors and original tips, not a band', async ({ page }) => {
  await gotoListening(page);
  await page.getByTestId('gap-L1-q1').fill('main entrance');
  await page.getByTestId('submit-button').click();
  await page.getByTestId('submit-confirm-yes').click();
  await waitListeningSaved(page);
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-data')).toBeVisible();
  await expect(page.getByTestId('current-listening')).toHaveText(copy.missing);
  await expect(page.getByTestId('current-overall')).toHaveText(copy.missing);
  await expectOverallNeeds(page, ['reading', 'listening', 'writing', 'speaking']);
  await expect(page.getByText(copy.noHistory)).toBeVisible();
  await expect(page.getByTestId('error-blank').locator('td')).toHaveText('3');
  await expect(page.locator('[data-testid^="accuracy-"]')).not.toHaveCount(0);
  const weaknesses = page.locator('[data-testid^="weakness-"]');
  expect(await weaknesses.count()).toBeGreaterThan(0);
  expect(await weaknesses.count()).toBeLessThanOrEqual(3);
  for (const item of await weaknesses.all()) {
    const qtype = (await item.getAttribute('data-testid'))?.replace('weakness-', '');
    const tip = tips.find((entry) => entry.qtype === qtype);
    expect(tip).toBeDefined();
    await expect(item).toContainText(tip!.text);
  }
  await expectNoA11yViolations(page);
});

for (const width of [1280, 360]) {
  test.describe(`dashboard ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });
    test('empty dashboard names all four missing skills in keyboard order without overflow', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByTestId('dashboard-status')).toHaveText(copy.empty);
      const skills: Skill[] = ['reading', 'listening', 'writing', 'speaking'];
      await expectOverallNeeds(page, skills);
      const links = page.getByTestId('dashboard-overall-needs').getByRole('link');
      await links.first().focus();
      for (let index = 0; index < skills.length; index += 1) {
        await expect(links.nth(index)).toBeFocused();
        if (index < skills.length - 1) await page.keyboard.press('Tab');
      }
      await expectNoA11yViolations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });

    test('saved bands, chronological chart/table, weighted accuracy and weakest-three tips', async ({ page, context }) => {
      const externalRequests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== 'http://localhost:4321') externalRequests.push(request.url());
      });
      await seed(page, [partial(), full('new-reading', 'reading', 23, 35), full('listening', 'listening', 22, 32), full('old-reading', 'reading', 21, 30)]);
      await expect(page.getByTestId('current-reading')).toHaveText('8');
      await expect(page.getByTestId('current-listening')).toHaveText('7.5');
      for (const skill of ['writing', 'speaking', 'overall']) await expect(page.getByTestId(`current-${skill}`)).toHaveText(copy.missing);
      await expectOverallNeeds(page, ['writing', 'speaking']);
      const needs = page.getByTestId('dashboard-overall-needs');
      await needs.getByRole('link', { name: en.catalog.skills.writing, exact: true }).focus();
      await page.keyboard.press('Tab');
      await expect(needs.getByRole('link', { name: en.catalog.skills.speaking, exact: true })).toBeFocused();
      await expect(page.getByText(copy.fullOnly)).toBeVisible();
      await expect(page.getByText(copy.disclaimer)).toBeVisible();
      const rows = page.getByTestId('history-row');
      await expect(rows).toHaveCount(3);
      expect(await rows.locator('time').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('datetime')))).toEqual([21, 22, 23].map((day) => new Date(time(day)).toISOString()));
      expect(await rows.nth(0).locator('td').allTextContents()).toEqual(['7', copy.missing, copy.missing, copy.missing, copy.missing]);
      expect(await rows.nth(1).locator('td').allTextContents()).toEqual([copy.missing, '7.5', copy.missing, copy.missing, copy.missing]);
      expect(await rows.nth(2).locator('td').allTextContents()).toEqual(['8', copy.missing, copy.missing, copy.missing, copy.missing]);
      await expect(page.getByTestId('dashboard-chart').locator('svg')).toBeVisible();
      await expect(page.getByRole('application')).toHaveCount(0);
      await expect(page.getByTestId('dashboard-chart')).toHaveAttribute('aria-hidden', 'true');
      await expect(page.getByText(copy.chartSummary)).toBeVisible();
      await expect(page.getByRole('list', { name: copy.chartLabel }).getByRole('listitem')).toHaveCount(5);
      const history = page.getByRole('region', { name: copy.history, exact: true }).and(page.locator('[tabindex="0"]'));
      await history.focus();
      await expect(history).toBeFocused();
      await expect(history.getByRole('table', { name: copy.history })).toBeVisible();
      if (width === 360) {
        await history.press('ArrowRight');
        await expect.poll(() => history.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
      }
      expect(await page.getByTestId('accuracy-sentence-completion').locator('td').allTextContents()).toEqual(['98', '121', '81%']);
      expect(await page.getByTestId('accuracy-choose-n').locator('td').allTextContents()).toEqual(['1', '3', '33%']);
      expect(await page.getByTestId('accuracy-short-answer').locator('td').allTextContents()).toEqual(['0', '1', '0%']);
      await expect(page.getByTestId('error-blank').locator('td')).toHaveText('24');
      await expect(page.getByTestId('error-wrong').locator('td')).toHaveText('3');
      for (const error of ['plural', 'spelling', 'over-limit']) await expect(page.getByTestId(`error-${error}`).locator('td')).toHaveText('0');
      expect(await page.locator('[data-testid^="weakness-"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')))).toEqual(['weakness-form-completion', 'weakness-short-answer', 'weakness-choose-n']);
      for (const qtype of ['form-completion', 'short-answer', 'choose-n'] as const) {
        await expect(page.getByTestId(`weakness-${qtype}`)).toContainText(tips.find((tip) => tip.qtype === qtype)!.text);
      }
      await expect(page.getByTestId('dashboard-legacy')).toHaveCount(0);
      await expectNoA11yViolations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      expect(await context.cookies()).toEqual([]);
      expect(externalRequests).toEqual([]);
      await page.reload();
      await expect(page.getByTestId('current-reading')).toHaveText('8');
      await expect(page.getByTestId('history-row')).toHaveCount(3);
      await expectOverallNeeds(page, ['writing', 'speaking']);
      for (const skill of ['writing', 'speaking'] as const) {
        if (skill === 'speaking') {
          await page.goto('/dashboard');
          await expectOverallNeeds(page, ['writing', 'speaking']);
        }
        const link = page.getByTestId('dashboard-overall-needs').getByRole('link', { name: en.catalog.skills[skill], exact: true });
        await link.focus();
        await link.press('Enter');
        await expect(page).toHaveURL(`/tests?skill=${skill}`);
        await expect(page.getByLabel(en.catalog.skill, { exact: true })).toHaveValue(skill);
        await expect(page.getByTestId('catalog-empty')).toHaveText(en.catalog.empty);
        await expect(page.locator('a[href$="/writing"], a[href$="/speaking"]')).toHaveCount(0);
        await expectNoA11yViolations(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      }
    });
  });
}

test('reviewless legacy records contribute missed marks but never bands or question-type accuracy', async ({ page }) => {
  const legacy = full('legacy', 'reading', 25, 0);
  delete legacy.review;
  await seed(page, [legacy]);
  await expect(page.getByTestId('dashboard-legacy')).toHaveText(copy.legacy);
  await expect(page.getByTestId('current-reading')).toHaveText(copy.missing);
  await expectOverallNeeds(page, ['reading', 'listening', 'writing', 'speaking']);
  await expect(page.getByText(copy.noHistory)).toBeVisible();
  await expect(page.getByText(copy.noAccuracy)).toBeVisible();
  await expect(page.getByText(copy.noWeaknesses)).toBeVisible();
  await expect(page.getByTestId('error-blank').locator('td')).toHaveText('40');
  await expectNoA11yViolations(page);
});

test('newer partial and legacy results leave both eligible skill bands present', async ({ page }) => {
  const legacy = full('newer-legacy', 'listening', 25, 40);
  delete legacy.review;
  await seed(page, [full('eligible-reading', 'reading', 21, 35), full('eligible-listening', 'listening', 22, 32), partial(), legacy]);
  await expect(page.getByTestId('current-reading')).toHaveText('8');
  await expect(page.getByTestId('current-listening')).toHaveText('7.5');
  await expect(page.getByTestId('current-overall')).toHaveText(copy.missing);
  await expectOverallNeeds(page, ['writing', 'speaking']);
  await expect(page.getByTestId('dashboard-legacy')).toHaveText(copy.legacy);
  await expectNoA11yViolations(page);
});

test('an eligible zero band is present while the other three skills remain missing', async ({ page }) => {
  await seed(page, [full('zero-reading', 'reading', 21, 0)]);
  await expect(page.getByTestId('current-reading')).toHaveText('0');
  await expect(page.getByTestId('current-overall')).toHaveText(copy.missing);
  await expectOverallNeeds(page, ['listening', 'writing', 'speaking']);
  await expectNoA11yViolations(page);
});

test('database-open failure is generic and explicit retry recovers with managed focus', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      if (sessionStorage.getItem('dashboard-recovered') !== 'true') throw new Error('Private storage detail');
      return original.apply(this, args);
    };
  });
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.error);
  await expect(page.getByText('Private storage detail')).toHaveCount(0);
  await expectNoA11yViolations(page);
  await page.evaluate(() => sessionStorage.setItem('dashboard-recovered', 'true'));
  const retry = page.getByRole('button', { name: copy.retry });
  await retry.focus();
  await retry.press('Enter');
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.empty);
  await expect(page.getByTestId('dashboard-status')).toBeFocused();
  await expect(page.getByRole('button', { name: copy.retry })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.empty);
});

test('result-read failure retries without deleting saved data', async ({ page }) => {
  await seed(page, [full('saved-reading', 'reading', 21, 35)]);
  await page.addInitScript(() => {
    const original = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...args) {
      if (this.name === 'results' && sessionStorage.getItem('dashboard-read-recovered') !== 'true') throw new Error('Private read detail');
      return original.apply(this, args);
    };
  });
  await page.reload();
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.error);
  await expect(page.getByText('Private read detail')).toHaveCount(0);
  await page.evaluate(() => sessionStorage.setItem('dashboard-read-recovered', 'true'));
  await page.getByRole('button', { name: copy.retry }).click();
  await expect(page.getByTestId('current-reading')).toHaveText('8');
  await expect(page.getByTestId('dashboard-status')).toBeFocused();
  await expect(page.getByTestId('history-row')).toHaveCount(1);
});

test('pending database open presents a loading status, not empty or invented data', async ({ page }) => {
  await page.addInitScript(() => {
    const original = IDBFactory.prototype.open;
    IDBFactory.prototype.open = function (...args) {
      const request = original.apply(this, args);
      request.addEventListener('success', (event) => {
        event.stopImmediatePropagation();
        document.documentElement.dataset.dashboardOpenHeld = 'true';
        document.addEventListener('dashboard-test-release', () => request.dispatchEvent(new Event('success')), { once: true });
      }, { once: true });
      return request;
    };
  });
  await page.goto('/dashboard');
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.loading);
  await expect(page.getByTestId('dashboard-page')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('dashboard-data')).toHaveCount(0);
  // Wait for the intercepted native success, using a browser event rather than a timed sleep.
  await expect(page.locator('html')).toHaveAttribute('data-dashboard-open-held', 'true');
  await page.evaluate(() => document.dispatchEvent(new Event('dashboard-test-release')));
  await expect(page.getByTestId('dashboard-status')).toHaveText(copy.empty);
  await expect(page.getByTestId('dashboard-page')).toHaveAttribute('aria-busy', 'false');
});