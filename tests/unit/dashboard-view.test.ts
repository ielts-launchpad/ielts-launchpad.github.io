import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardView } from '../../src/components/dashboard/DashboardPage';
import { buildDashboard, type Dashboard } from '../../src/engine/analytics/dashboard';
import type { Skill } from '../../src/engine/content/schema';
import { en } from '../../src/i18n/en';

function markup(latestBands: Dashboard['latestBands'], currentBand: number | null = null): string {
  const dashboard = { ...buildDashboard([]), latestBands, currentBand };
  return renderToStaticMarkup(createElement(DashboardView, { dashboard, tips: [] }));
}

describe('dashboard missing-skill view', () => {
  it.each<{ bands: Dashboard['latestBands']; missing: Skill[]; text: string }>([
    { bands: { speaking: null, writing: null, listening: 7.5, reading: 8 },
      missing: ['writing', 'speaking'], text: 'Overall needs: Writing, Speaking' },
    { bands: { reading: 0, listening: 0, writing: null, speaking: null },
      missing: ['writing', 'speaking'], text: 'Overall needs: Writing, Speaking' },
    { bands: { reading: 8, listening: null, writing: null, speaking: null },
      missing: ['listening', 'writing', 'speaking'], text: 'Overall needs: Listening, Writing, Speaking' },
    { bands: { reading: null, listening: 0, writing: null, speaking: null },
      missing: ['reading', 'writing', 'speaking'], text: 'Overall needs: Reading, Writing, Speaking' },
    { bands: { reading: null, listening: null, writing: null, speaking: null },
      missing: ['reading', 'listening', 'writing', 'speaking'], text: 'Overall needs: Reading, Listening, Writing, Speaking' },
  ])('renders exact missing names and matching catalog links: $text', ({ bands, missing, text }) => {
    const html = markup(bands);
    const paragraph = html.match(/<p[^>]*data-testid="dashboard-overall-needs"[^>]*>(.*?)<\/p>/)?.[1];
    expect(paragraph?.replace(/<[^>]*>/g, '')).toBe(text);
    expect(paragraph?.match(/href="\/tests\?skill=[^"]*"/g)).toEqual(missing.map((skill) => `href="/tests?skill=${skill}"`));
    for (const skill of missing) expect(paragraph).toContain(`>${en.catalog.skills[skill]}</a>`);
    expect(html).toContain('data-testid="current-overall">—</dd>');
  });

  it('omits the message when hypothetical four eligible bands exist, including zero', () => {
    for (const band of [0, 7.5]) {
      const html = markup({ reading: band, listening: band, writing: band, speaking: band }, band);
      expect(html).not.toContain('dashboard-overall-needs');
      expect(html).not.toContain('/tests?skill=');
      expect(html).toContain(`data-testid="current-overall">${band}</dd>`);
    }
  });
});