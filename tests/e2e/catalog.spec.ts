import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, type Page } from '@playwright/test';
import { TestCatalog } from '../../src/components/catalog/TestCatalog';
import type { CatalogCard } from '../../src/engine/content/catalog';
import { en } from '../../src/i18n/en';
import { format } from '../../src/i18n/format';
import { expectNoA11yViolations } from './helpers/a11y';

async function openCatalog(page: Page) {
  await page.goto('/tests');
  await expect(page.locator('astro-island[component-export="TestCatalog"]')).not.toHaveAttribute('ssr', '');
  await expect(page.getByTestId('test-catalog')).toBeVisible();
}

// JSON-only Astro island fixture encoding. Replace both SSR markup and props so
// the real built client island hydrates consistently; never add fixture content
// or M6 routes to the app. Reading/Listening remain real sample runner targets.
function serializeFixture(value: unknown): unknown {
  if (Array.isArray(value)) return [1, value.map(serializeFixture)];
  if (value !== null && typeof value === 'object') {
    return [0, Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serializeFixture(entry)]))];
  }
  return [0, value];
}

async function mockCatalog(page: Page, cards: CatalogCard[], includeDrafts = true) {
  await page.route('**/tests', async (route) => {
    const response = await route.fetch();
    const html = await response.text();
    const props = JSON.stringify({ cards: serializeFixture(cards), includeDrafts: serializeFixture(includeDrafts) })
      .replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
    const markup = renderToStaticMarkup(createElement(TestCatalog, { cards, includeDrafts }));
    let replaced = false;
    const body = html.replace(/<astro-island\b([^>]*component-export="TestCatalog"[^>]*)>[\s\S]*?<\/astro-island>/, (_match: string, attributes: string) => {
      replaced = true;
      return `<astro-island${attributes.replace(/props="[^"]*"/, `props="${props}"`)}>${markup}</astro-island>`;
    });
    expect(replaced, 'Catalog SSR island must be present in the preview build').toBe(true);
    await route.fulfill({ response, body });
  });
}

for (const viewport of [{ width: 1280, height: 900 }, { width: 360, height: 800 }]) {
  test.describe(`catalog ${viewport.width}px`, () => {
    test.use({ viewport });

    test('actual sample preview, labelled filters, keyboard operation and axe', async ({ page }) => {
      await openCatalog(page);
      await expect(page.getByRole('heading', { level: 1, name: en.pages.tests.heading })).toBeVisible();
      const sample = page.getByRole('article', { name: 'Sample Practice 1' });
      await expect(sample.getByTestId('catalog-draft')).toHaveText(en.common.draftBadge);
      const skill = page.getByLabel(en.catalog.skill, { exact: true });
      const kind = page.getByLabel(en.catalog.kind, { exact: true });
      await skill.selectOption('reading');
      await expect(sample.getByRole('link', { name: format(en.catalog.open, { skill: en.catalog.skills.reading }) })).toHaveAttribute('href', '/test/sample-01/reading');
      await expect(sample.getByRole('link', { name: format(en.catalog.open, { skill: en.catalog.skills.listening }) })).toHaveCount(0);
      await skill.selectOption('listening');
      await expect(sample.getByRole('link', { name: format(en.catalog.open, { skill: en.catalog.skills.listening }) })).toHaveAttribute('href', '/test/sample-01/listening');
      await kind.focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(kind).toHaveValue('mock');
      await expect(page.getByTestId('catalog-empty')).toHaveText(en.catalog.empty);
      await expect(page.getByTestId('catalog-count')).toHaveText(format(en.catalog.count, { n: 0 }));
      await expectNoA11yViolations(page);
      await kind.selectOption('practice');
      await expect(sample).toBeVisible();
      await expectNoA11yViolations(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });

    for (const skill of ['reading', 'listening'] as const) {
      test(`Start ${skill} opens the actual runner route`, async ({ page }) => {
        await openCatalog(page);
        await page.getByLabel(en.catalog.skill, { exact: true }).selectOption(skill);
        const response = await Promise.all([
          page.waitForResponse((result) => result.request().isNavigationRequest() && result.url().endsWith(`/test/sample-01/${skill}`)),
          page.getByRole('article', { name: 'Sample Practice 1' }).getByRole('link', { name: format(en.catalog.open, { skill: en.catalog.skills[skill] }) }).click(),
        ]);
        expect(response[0].status()).toBe(200);
        await expect(page).toHaveURL(`/test/sample-01/${skill}`);
        await expect(page.getByTestId('save-status')).toHaveText(en.runner.toolbar.saved);
      });
    }

    test('Writing/Speaking matching metadata shows coming soon, never broken links', async ({ page }) => {
      await mockCatalog(page, [{
        id: 'catalog-mock', title: 'Catalog mock metadata', kind: 'mock', isDraft: true,
        skills: [
          { skill: 'reading', href: '/test/sample-01/reading' },
          { skill: 'listening', href: '/test/sample-01/listening' },
          { skill: 'writing', href: null }, { skill: 'speaking', href: null },
        ],
      }]);
      await openCatalog(page);
      await page.getByLabel(en.catalog.kind, { exact: true }).selectOption('mock');
      for (const skill of ['writing', 'speaking'] as const) {
        await page.getByLabel(en.catalog.skill, { exact: true }).selectOption(skill);
        const card = page.getByRole('article', { name: 'Catalog mock metadata' });
        await expect(card).toBeVisible();
        await expect(card).toContainText(format(en.catalog.comingSoon, { skill: en.catalog.skills[skill] }));
        await expect(card.getByRole('link')).toHaveCount(0);
        await expect(page.locator('a[href$="/writing"], a[href$="/speaking"]')).toHaveCount(0);
        await expectNoA11yViolations(page);
      }
      await page.getByLabel(en.catalog.kind, { exact: true }).selectOption('practice');
      await expect(page.getByTestId('catalog-empty')).toHaveText(en.catalog.empty);
    });

    test('production empty metadata shows published help without draft badges', async ({ page }) => {
      await mockCatalog(page, [], false);
      await openCatalog(page);
      await expect(page.getByTestId('catalog-empty')).toHaveText(en.catalog.emptyPublished);
      await expect(page.getByTestId('catalog-draft')).toHaveCount(0);
      await expectNoA11yViolations(page);
    });
  });
}