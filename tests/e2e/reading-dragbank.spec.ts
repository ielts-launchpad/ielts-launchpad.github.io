import { expect, test, type Locator, type Page } from '@playwright/test';
import { gotoReading, MOBILE, showQuestions, waitForAutosave } from './helpers/runner';

/**
 * `dragBank` coverage (SPEC §5). Sample-01 Q22–24 is a summary with a word bank
 * (A–F, `allowReuse: false`). The component is operable three ways: pointer
 * drag, keyboard, and click/tap-to-place — all covered here.
 */

function bank(page: Page, letter: string) {
  return page.getByTestId(`bank-${letter}`);
}

function slot(page: Page, qid: string) {
  return page.getByTestId(`slot-${qid}`);
}

/** Pointer-drag a bank chip onto a slot (dnd-kit MouseSensor). */
async function dragChipToSlot(page: Page, source: Locator, target: Locator): Promise<void> {
  // Ensure both the chip and the gap are scrolled into the viewport so the raw
  // mouse coordinates below are reachable (unlike `.click()`, `page.mouse.move`
  // does not auto-scroll).
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const sb = await source.boundingBox();
  const tb = await target.boundingBox();
  if (!sb || !tb) throw new Error('missing bounding box');
  const sx = sb.x + sb.width / 2;
  const sy = sb.y + sb.height / 2;
  const tx = tb.x + tb.width / 2;
  const ty = tb.y + tb.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  // Stream a continuous move path so dnd-kit crosses its 8px activation
  // distance and keeps an up-to-date pointer position for `pointerWithin`.
  const steps = 25;
  for (let i = 1; i <= steps; i += 1) {
    const ratio = i / steps;
    await page.mouse.move(sx + (tx - sx) * ratio, sy + (ty - sy) * ratio);
  }
  await page.mouse.move(tx, ty);
  await page.mouse.up();
}

test.describe('reading runner — dragBank (desktop)', () => {
  test('places a bank option by clicking the chip then the slot', async ({ page }) => {
    await gotoReading(page);
    await bank(page, 'A').click();
    await slot(page, 'p1-q22').click();
    await expect(slot(page, 'p1-q22')).toHaveAttribute('data-letter', 'A');
  });

  test('returns a placed option to the bank (deselect)', async ({ page }) => {
    await gotoReading(page);
    await bank(page, 'A').click();
    await slot(page, 'p1-q22').click();
    await slot(page, 'p1-q22').click();
    await expect(slot(page, 'p1-q22')).toHaveAttribute('data-letter', '');
  });

  test('changes a slot to a different option', async ({ page }) => {
    await gotoReading(page);
    await bank(page, 'A').click();
    await slot(page, 'p1-q22').click();
    await slot(page, 'p1-q22').click(); // clear
    await bank(page, 'C').click();
    await slot(page, 'p1-q22').click();
    await expect(slot(page, 'p1-q22')).toHaveAttribute('data-letter', 'C');
  });

  test('disables a used chip when reuse is off', async ({ page }) => {
    await gotoReading(page);
    await bank(page, 'A').click();
    await slot(page, 'p1-q22').click();
    await expect(bank(page, 'A')).toBeDisabled();
  });

  test('places an option by pointer drag', async ({ page }) => {
    await gotoReading(page);
    await dragChipToSlot(page, bank(page, 'E'), slot(page, 'p1-q23'));
    await expect(slot(page, 'p1-q23')).toHaveAttribute('data-letter', 'E');
  });

  test('is operable with the keyboard only', async ({ page }) => {
    await gotoReading(page);
    await bank(page, 'A').focus();
    await page.keyboard.press('Enter');
    await slot(page, 'p1-q22').focus();
    await page.keyboard.press('Enter');
    await expect(slot(page, 'p1-q22')).toHaveAttribute('data-letter', 'A');
  });

  test('persists a placement after reload', async ({ page }) => {
    await gotoReading(page);
    await bank(page, 'A').click();
    await slot(page, 'p1-q22').click();
    await waitForAutosave(page);
    await page.reload();
    await expect(page.getByTestId('runner-content')).toBeVisible();
    await expect(slot(page, 'p1-q22')).toHaveAttribute('data-letter', 'A');
  });
});

test.describe('reading runner — dragBank (mobile 360px, touch)', () => {
  test.use(MOBILE);

  test('places an option by tapping the chip then the slot', async ({ page }) => {
    await gotoReading(page);
    await showQuestions(page);
    await bank(page, 'A').tap();
    await slot(page, 'p1-q22').tap();
    await expect(slot(page, 'p1-q22')).toHaveAttribute('data-letter', 'A');
  });
});
