import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Reusable a11y helper (SPEC §10 / M0.2). Asserts zero serious or critical
 * accessibility violations on the current page. Every UI issue should call this
 * on the pages it adds.
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(
    seriousOrCritical,
    `Accessibility violations:\n${JSON.stringify(seriousOrCritical, null, 2)}`,
  ).toEqual([]);
}
