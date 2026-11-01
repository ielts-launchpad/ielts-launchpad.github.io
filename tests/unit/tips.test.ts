import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardView } from '../../src/components/dashboard/DashboardPage';
import { buildDashboard } from '../../src/engine/analytics/dashboard';
import { findTip, tipsSchema } from '../../src/engine/analytics/tips';
import { QTYPES } from '../../src/engine/content/schema';
import { ContentError } from '../../src/engine/content/loader';
import { loadTips } from '../../src/engine/content/tips-loader';
import { overallBand } from '../../src/exams/ielts/bands';
import { en } from '../../src/i18n/en';

describe('practice tips', () => {
  it('trims valid text and permits an empty tips collection for fallback', () => {
    expect(tipsSchema.parse([{ qtype: 'choose-n', text: '  Read every option.  ' }])).toEqual([{ qtype: 'choose-n', text: 'Read every option.' }]);
    expect(tipsSchema.parse([])).toEqual([]);
  });

  it.each([
    [{ qtype: 'choose-n', text: 'One' }, { qtype: 'choose-n', text: 'Two' }],
    [{ qtype: 'unknown', text: 'Text' }],
    [{ qtype: 'choose-n', text: ' \n\t ' }],
    [{ qtype: 'choose-n', text: 'Text', extra: true }],
    [{ qtype: 'choose-n' }],
    { qtype: 'choose-n', text: 'Text' },
  ].map((input) => ({ input })))('rejects invalid tips input %#', ({ input }) => {
    expect(tipsSchema.safeParse(input).success).toBe(false);
  });

  it('loads the real file with one original nonblank tip for every one of the 17 qtypes', () => {
    const tips = loadTips(join(process.cwd(), 'content/tips.yaml'));
    expect(tips).toHaveLength(17);
    expect(tips.map((tip) => tip.qtype).sort()).toEqual([...QTYPES].sort());
    for (const qtype of QTYPES) expect(findTip(tips, qtype)?.trim().length).toBeGreaterThan(0);
  });

  it('finds a known tip and returns null for missing tips', () => {
    const tips = [{ qtype: 'choose-n' as const, text: 'Compare all options.' }];
    expect(findTip(tips, 'choose-n')).toBe('Compare all options.');
    expect(findTip(tips, 'short-answer')).toBeNull();
    expect(findTip([], 'choose-n')).toBeNull();
  });

  it('renders the catalog fallback when a weakness has no supplied tip', () => {
    const dashboard = buildDashboard([{
      attemptId: 'tip-fixture', createdAt: 1, skill: 'reading', band: null,
      questions: [{ questionId: 'Q1', numbers: [1, 2], marks: 1, maxMarks: 2, correct: false, errorClass: 'wrong', qtype: 'choose-n' }],
    }], overallBand);
    const markup = renderToStaticMarkup(createElement(DashboardView, { dashboard, tips: [] }));
    expect(markup).toContain(en.dashboard.fallbackTip);
    expect(markup).toContain(en.dashboard.recommendation);
    expect(markup).toContain(en.dashboard.qtypes['choose-n']);
  });

  it('wraps missing files, malformed YAML and schema failures in ContentError', () => {
    const directory = mkdtempSync(join(tmpdir(), 'dashboard-tips-'));
    const file = join(directory, 'tips.yaml');
    try {
      expect(() => loadTips(file)).toThrow(ContentError);
      for (const text of ['[broken', '- qtype: unknown\n  text: Text', '- qtype: choose-n\n  text: " "']) {
        writeFileSync(file, text);
        expect(() => loadTips(file)).toThrow(ContentError);
      }
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});