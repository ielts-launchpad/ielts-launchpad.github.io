import { expect, test } from '@playwright/test';

for (const skill of ['reading', 'listening']) {
  test(`${skill} shows Loading, not Saving, before hydration`, async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/*Runner*.js', async (route) => { await gate; await route.continue(); });
    try {
      await page.goto(`/test/sample-01/${skill}`, { waitUntil: 'commit' });
      await expect(page.getByTestId('save-status')).toHaveText('Loading…');
      release();
      await expect(page.getByTestId('save-status')).toHaveText('Saved');
    } finally {
      release();
      await page.unrouteAll({ behavior: 'wait' });
    }
  });
}