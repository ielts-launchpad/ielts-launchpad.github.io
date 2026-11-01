import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  buildCatalogCards,
  catalogIncludesDrafts,
  catalogRunnerHref,
  filterCatalogCards,
  type CatalogFilters,
} from '../../src/engine/content/catalog';
import { loadAllTests, type LoadedTest } from '../../src/engine/content/loader';
import { TestCatalog } from '../../src/components/catalog/TestCatalog';
import { en } from '../../src/i18n/en';
import { format } from '../../src/i18n/format';

const contentDir = fileURLToPath(new URL('../../content', import.meta.url));
const publicDir = fileURLToPath(new URL('../../public', import.meta.url));
const sample = loadAllTests({ contentDir, publicDir, includeDrafts: true })
  .find((test) => test.meta.id === 'sample-01');
if (!sample) throw new Error('Expected the actual sample-01 content');
const published: LoadedTest = {
  ...sample,
  meta: { ...sample.meta, id: 'published-mock', title: 'Published mock', kind: 'mock', status: 'published', skills: ['reading', 'listening', 'writing', 'speaking'] },
  isDraft: false,
};
const readingOnly: LoadedTest = {
  ...sample,
  meta: { ...sample.meta, id: 'published-reading', title: 'Published reading', status: 'published', skills: ['reading'] },
  isDraft: false,
  listening: [],
};
const tests = [sample, published, readingOnly];
const cards = buildCatalogCards(tests, true);

describe('catalog metadata', () => {
  it('projects actual sample content to an explicit serializable metadata allowlist', () => {
    const [card] = buildCatalogCards([sample], true);
    expect(card).toEqual({
      id: 'sample-01', title: sample.meta.title, kind: 'practice', isDraft: true,
      skills: [
        { skill: 'listening', href: '/test/sample-01/listening' },
        { skill: 'reading', href: '/test/sample-01/reading' },
      ],
    });
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
    const json = JSON.stringify(card);
    for (const excluded of ['answers', 'transcript', 'markdownText', 'audioFsPath', 'evidence', sample.dir]) {
      expect(json).not.toContain(excluded);
    }
  });

  it('copies skill metadata instead of retaining mutable source arrays', () => {
    const mapped = buildCatalogCards([published], true);
    mapped[0].skills.pop();
    expect(published.meta.skills).toEqual(['reading', 'listening', 'writing', 'speaking']);
  });

  it('omits drafts while preserving published order for production', () => {
    expect(buildCatalogCards(tests, false).map(({ id }) => id)).toEqual(['published-mock', 'published-reading']);
  });

  it('includes drafts only when enabled and derives status from metadata', () => {
    expect(cards.map(({ id }) => id)).toEqual(['sample-01', 'published-mock', 'published-reading']);
    expect(buildCatalogCards([{ ...sample, isDraft: false }], false)).toEqual([]);
  });

  it.each([
    [false, undefined, false], [false, 'false', false], [false, 'TRUE', false],
    [false, '1', false], [false, 'true', true], [true, undefined, true], [true, 'false', true],
  ] as const)('runner-compatible draft policy: dev=%s flag=%s includes=%s', (dev, flag, expected) => {
    expect(catalogIncludesDrafts(dev, flag)).toBe(expected);
  });

  it('the page uses the exact runner policy and sends only mapped cards', () => {
    const page = readFileSync(new URL('../../src/pages/tests.astro', import.meta.url), 'utf8');
    expect(page).toContain("import.meta.env.DEV || process.env.INCLUDE_DRAFTS === 'true'");
    expect(page).toContain('const cards = buildCatalogCards(loadAllTests(');
    expect(page).toContain('<TestCatalog client:load cards={cards} includeDrafts={includeDrafts} />');
    expect(buildCatalogCards(loadAllTests({ contentDir, publicDir, includeDrafts: false }), false)
      .some(({ isDraft, id }) => isDraft || id === 'sample-01')).toBe(false);
  });

  it('provides only Reading/Listening links with loaded content', () => {
    expect(catalogRunnerHref(published, 'reading')).toBe('/test/published-mock/reading');
    expect(catalogRunnerHref(published, 'listening')).toBe('/test/published-mock/listening');
    expect(catalogRunnerHref(published, 'writing')).toBeNull();
    expect(catalogRunnerHref(published, 'speaking')).toBeNull();
    expect(catalogRunnerHref({ ...published, reading: [] }, 'reading')).toBeNull();
    expect(catalogRunnerHref(readingOnly, 'listening')).toBeNull();
    expect(catalogRunnerHref({ ...published, meta: { ...published.meta, id: 'a/b c' } }, 'reading'))
      .toBe('/test/a%2Fb%20c/reading');
  });
});

describe('stable catalog filtering', () => {
  it.each<{ filters: CatalogFilters; ids: string[] }>([
    { filters: { skill: 'all', kind: 'all' }, ids: ['sample-01', 'published-mock', 'published-reading'] },
    { filters: { skill: 'reading', kind: 'all' }, ids: ['sample-01', 'published-mock', 'published-reading'] },
    { filters: { skill: 'listening', kind: 'practice' }, ids: ['sample-01'] },
    { filters: { skill: 'all', kind: 'mock' }, ids: ['published-mock'] },
    { filters: { skill: 'writing', kind: 'mock' }, ids: ['published-mock'] },
    { filters: { skill: 'speaking', kind: 'all' }, ids: ['published-mock'] },
    { filters: { skill: 'writing', kind: 'practice' }, ids: [] },
    { filters: { skill: 'speaking', kind: 'practice' }, ids: [] },
  ])('filters $filters in input order', ({ filters, ids }) => {
    const before = JSON.stringify(cards);
    const result = filterCatalogCards(cards, filters);
    expect(result.map(({ id }) => id)).toEqual(ids);
    expect(JSON.stringify(cards)).toBe(before);
    for (const card of result) expect(cards).toContain(card);
  });

  it('handles an empty catalog', () => {
    expect(filterCatalogCards([], { skill: 'all', kind: 'all' })).toEqual([]);
  });
});

describe('catalog server markup', () => {
  it('shows the preview badge only when drafts are enabled', () => {
    expect(renderToStaticMarkup(createElement(TestCatalog, { cards, includeDrafts: true }))).toContain(en.common.draftBadge);
    expect(renderToStaticMarkup(createElement(TestCatalog, { cards, includeDrafts: false }))).not.toContain(en.common.draftBadge);
  });

  it('shows distinct production and filtered-empty help', () => {
    expect(renderToStaticMarkup(createElement(TestCatalog, { cards: [], includeDrafts: false }))).toContain(en.catalog.emptyPublished);
    expect(renderToStaticMarkup(createElement(TestCatalog, { cards: [], includeDrafts: true }))).toContain(en.catalog.empty);
  });

  it('lists unsupported skill metadata as coming soon with no broken runner hrefs', () => {
    const html = renderToStaticMarkup(createElement(TestCatalog, { cards: buildCatalogCards([published], false), includeDrafts: false }));
    for (const skill of ['writing', 'speaking'] as const) {
      expect(html).toContain(format(en.catalog.comingSoon, { skill: en.catalog.skills[skill] }));
      expect(html).not.toContain(`/test/published-mock/${skill}`);
    }
    expect(html).toContain('<article');
    expect(html).toContain('href="/test/published-mock/reading"');
    expect(html).toContain('href="/test/published-mock/listening"');
  });
});