import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DashboardPage from '../../src/components/dashboard/DashboardPage';
import { buildDashboard } from '../../src/engine/analytics/dashboard';
import { questionGroupSchema } from '../../src/engine/content/schema';
import { gradeQuestion } from '../../src/engine/grading/grade';
import { overallBand } from '../../src/exams/ielts/bands';
import { toDashboardResult, toDashboardResults } from '../../src/lib/analytics/dashboard-results';
import * as storage from '../../src/lib/storage/db';
import type { ResultRecord } from '../../src/lib/storage/db';

function record(raw = 32, max = 40): ResultRecord {
  const group = questionGroupSchema.parse({
    id: 'group', instructions: 'Complete each answer.', interaction: 'gap', qtype: 'sentence-completion',
    wordLimit: { words: 1 },
    questions: Array.from({ length: max }, (_, index) => ({
      id: `Q${index + 1}`, number: index + 1, answers: ['river'], evidence: { quote: 'river' },
    })),
  });
  const answers = Object.fromEntries(group.questions.map((question, index) => [question.id, index < raw ? 'river' : null]));
  return {
    attemptId: 'attempt', testId: 'unit-fixture', createdAt: 1000, skill: 'reading', raw, max,
    results: group.questions.map((question) => gradeQuestion(group, question, answers[question.id])),
    review: { variant: 'academic', kind: 'practice', answers,
      sections: [{ number: 1, title: 'River', text: 'river', groups: [group] }] },
  };
}

describe('storage-to-dashboard mapper', () => {
  it.each([
    ['reading', 'academic', 32, 7], ['reading', 'general', 32, 6.5],
    ['listening', 'academic', 32, 7.5], ['listening', 'general', 32, 7.5],
  ] as const)('uses the %s %s band table', (skill, variant, raw, band) => {
    const input = record(raw);
    input.skill = skill;
    input.review!.variant = variant;
    expect(toDashboardResult(input)).toMatchObject({ skill, band });
  });

  it.each(['mock', 'practice'] as const)('permits an eligible 40-mark %s', (kind) => {
    const input = record(40);
    input.review!.kind = kind;
    expect(toDashboardResult(input).band).toBe(9);
  });

  it.each([1, 4, 24, 39, 41])('never rescales a %i-mark result', (max) => {
    expect(toDashboardResult(record(max, max)).band).toBeNull();
  });

  it('legacy records have no band or qtype, but retain grades and errors', () => {
    const input = record(32);
    delete input.review;
    const mapped = toDashboardResult(input);
    expect(mapped.band).toBeNull();
    expect(mapped.questions.every((question) => question.qtype === null)).toBe(true);
    expect(mapped.questions.map(({ qtype: _qtype, ...grade }) => grade)).toEqual(input.results);
    const dashboard = buildDashboard([mapped], overallBand);
    expect(dashboard.accuracy).toEqual([]);
    expect(dashboard.errors.blank).toBe(8);
    expect(dashboard.unknownQuestionTypes).toBe(40);
  });

  it('maps Choose N by question id, preserving multiple numbers and partial marks', () => {
    const input = record(1, 1);
    const multi = questionGroupSchema.parse({
      id: 'multi', interaction: 'multi', qtype: 'choose-n', instructions: 'Choose two.',
      options: { A: 'First', B: 'Second', C: 'Third' },
      questions: [{ id: 'multi-q', numbers: [2, 3], n: 2, answers: ['A', 'C'] }],
    });
    input.review!.sections.push({ number: 2, title: 'Choices', text: 'First and third.', groups: [multi] });
    input.review!.answers['multi-q'] = ['A', 'B'];
    input.results.push(gradeQuestion(multi, multi.questions[0], ['A', 'B']));
    input.raw = 2;
    input.max = 3;
    // Deliberately reorder grades: positions and question numbers are not lookup keys.
    input.results.reverse();
    const mapped = toDashboardResult(input);
    expect(mapped.questions[0]).toMatchObject({ questionId: 'multi-q', qtype: 'choose-n', numbers: [2, 3], marks: 1, maxMarks: 2 });
    expect(mapped.questions[1].qtype).toBe('sentence-completion');
    const dashboard = buildDashboard([mapped], overallBand);
    expect(dashboard.accuracy.find((entry) => entry.qtype === 'choose-n')).toMatchObject({ marks: 1, maxMarks: 2, percentage: 50 });
    expect(dashboard.errors.wrong).toBe(1);
  });

  it('unmatched ids remain unknown rather than inheriting another question type', () => {
    const input = record(1, 1);
    input.results[0].questionId = 'missing';
    expect(toDashboardResult(input).questions[0].qtype).toBeNull();
  });

  it('does not mutate storage records and clones the grade number arrays', () => {
    const input = record();
    const before = structuredClone(input);
    const mapped = toDashboardResults([input]);
    expect(input).toEqual(before);
    mapped[0].questions[0].numbers.push(999);
    expect(input).toEqual(before);
    expect(toDashboardResults([])).toEqual([]);
  });

  it('keeps chronological eligible history and latest bands despite later partial results; overall needs four', () => {
    const reading = { ...record(32), attemptId: 'reading', createdAt: 2000 };
    const listening = { ...record(32), skill: 'listening' as const, attemptId: 'listening', createdAt: 1000 };
    const partial = { ...record(4, 4), attemptId: 'partial', createdAt: 3000 };
    const dashboard = buildDashboard(toDashboardResults([partial, reading, listening]), overallBand);
    expect(dashboard.history.map((entry) => entry.attemptId)).toEqual(['listening', 'reading']);
    expect(dashboard.latestBands).toEqual({ reading: 7, listening: 7.5, writing: null, speaking: null });
    expect(dashboard.currentBand).toBeNull();
    expect(dashboard.history.every((entry) => entry.overall === null)).toBe(true);
  });

  it('server rendering never creates or opens browser storage', () => {
    const getDb = vi.spyOn(storage, 'getDb');
    try {
      expect(renderToStaticMarkup(createElement(DashboardPage, { tips: [] }))).toContain('Loading your progress');
      expect(getDb).not.toHaveBeenCalled();
    } finally { getDb.mockRestore(); }
  });
});