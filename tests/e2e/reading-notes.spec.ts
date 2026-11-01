import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers/a11y';
import { gotoReading, MOBILE, waitForAutosave } from './helpers/runner';

async function createHighlight(page: Page): Promise<string> {
  const paragraph = page.getByTestId('paragraph-1-0');
  const text = await paragraph.innerText();
  await paragraph.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  });
  await page.getByTestId('highlight-button').focus();
  await page.keyboard.press('Enter');
  const mark = paragraph.locator('mark');
  await expect(mark).toHaveText(text);
  await mark.click();
  await expect(mark).toHaveCount(1);
  await waitForAutosave(page);
  return text;
}

async function notesFlow(page: Page): Promise<void> {
  await gotoReading(page);
  const text = await createHighlight(page);
  const card = page.getByTestId('highlight-note');
  await card.getByRole('button', { name: 'Add note', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Note for highlighted text' })).toBeFocused();
  await page.keyboard.type('Key idea');
  await expectNoA11yViolations(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(card.getByTestId('note-text')).toHaveText('Key idea');
  await expect(card.getByRole('button', { name: 'Edit note' })).toBeFocused();
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByTestId('paragraph-1-0').locator('mark')).toHaveText(text);
  await expect(card.getByTestId('note-text')).toHaveText('Key idea');
  await card.getByRole('button', { name: 'Edit note' }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type('Revised idea');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await waitForAutosave(page);
  await page.reload();
  await expect(card.getByTestId('note-text')).toHaveText('Revised idea');
  await expectNoA11yViolations(page);
  await card.getByRole('button', { name: 'Delete note' }).focus();
  await page.keyboard.press('Enter');
  await expect(card.getByRole('button', { name: 'Add note', exact: true })).toBeFocused();
  await waitForAutosave(page);
  await page.reload();
  await expect(card.getByTestId('note-text')).toHaveCount(0);
  await expect(page.getByTestId('paragraph-1-0').locator('mark')).toHaveCount(1);
  await card.getByRole('button', { name: 'Remove highlight', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('highlight-button')).toBeFocused();
  await waitForAutosave(page);
  await page.reload();
  await expect(page.getByTestId('paragraph-1-0').locator('mark')).toHaveCount(0);
  await expect(card).toHaveCount(0);
}

test('highlight and note CRUD persists and is keyboard accessible (desktop)', async ({ page }) => {
  await notesFlow(page);
});

test.describe('notes mobile 360px', () => {
  test.use(MOBILE);
  test('highlight and note CRUD with axe', async ({ page }) => {
    await notesFlow(page);
  });
});