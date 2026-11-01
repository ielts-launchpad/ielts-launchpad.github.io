import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoListening, waitListeningSaved } from './helpers/listening';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';

async function labelImage(page: Page, skill: 'reading' | 'listening'): Promise<void> {
  if (skill === 'reading') {
    await gotoReading(page);
    await showQuestions(page);
  } else await gotoListening(page);
  const group = page.getByTestId(skill === 'reading' ? 'group-p1-g7-note' : 'group-L1-g1-form');
  const image = group.getByRole('img');
  await image.scrollIntoViewIfNeeded();
  await expect(image).toHaveAttribute('src', skill === 'reading'
    ? '/images/academic/sample-01/beekeeping-diagram.svg' : '/images/academic/sample-01/workshop-plan.svg');
  await expect(image).toHaveAccessibleName(skill === 'reading'
    ? 'A school beside a public path. Label 18 marks the separation between the path and the hives. Label 19 points to the hive location on top of the school.'
    : 'Plan of a garden workshop site, with north at the top. Label 1 points to the entry on the south edge, and label 2 points to the gate beside bicycle parking on the north edge.');
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  const answers: [number, string][] = skill === 'reading' ? [[18, 'distance'], [19, 'roofs']]
    : [[1, 'main entrance'], [2, 'north gate']];
  for (const [number, answer] of answers) {
    const control = group.getByRole('textbox', { name: `Answer for question ${number}`, exact: true });
    await control.focus();
    await page.keyboard.type(answer);
    await expect(control).toHaveValue(answer);
  }
  if (skill === 'reading') await waitForAutosave(page);
  else await waitListeningSaved(page);
  await page.reload();
  if (skill === 'reading') {
    await expect(page.getByTestId('runner-content')).toBeVisible();
    await showQuestions(page);
  } else await expect(page.getByTestId('listening-runner')).toBeVisible();
  for (const [number, answer] of answers) {
    await expect(group.getByRole('textbox', { name: `Answer for question ${number}`, exact: true })).toHaveValue(answer);
    await expect(page.getByTestId(`nav-${number}`)).toHaveAttribute('data-answered', 'true');
  }
  await image.scrollIntoViewIfNeeded();
  await expectNoA11yViolations(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

for (const skill of ['reading', 'listening'] as const) {
  test(`${skill} image labelling renders alt text and saves keyboard answers`, async ({ page }) => {
    await labelImage(page, skill);
  });
}

test.describe('image labelling mobile 360px', () => {
  test.use(MOBILE);
  for (const skill of ['reading', 'listening'] as const) {
    test(`${skill} diagram/plan controls persist and pass axe`, async ({ page }) => {
      await labelImage(page, skill);
    });
  }
});