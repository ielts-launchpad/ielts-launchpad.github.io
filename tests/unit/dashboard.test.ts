import { describe, expect, it, vi } from 'vitest';
import { buildDashboard, type DashboardResult } from '../../src/engine/analytics/dashboard';
import type { QType, Skill } from '../../src/engine/content/schema';
import type { ErrorClass } from '../../src/engine/grading/grade';
import { overallBand } from '../../src/exams/ielts/bands';

function question(
  qtype: QType | null = 'choose-n',
  marks = 1,
  maxMarks = 2,
  errorClass: ErrorClass | null = marks === maxMarks ? null : 'wrong',
): DashboardResult['questions'][number] {
  return { questionId: 'Q1', numbers: [1, 2], marks, maxMarks,
    correct: marks === maxMarks, errorClass, qtype };
}

function result(
  attemptId: string,
  createdAt: number,
  skill: Skill = 'reading',
  band: number | null = null,
  questions: DashboardResult['questions'] = [],
): DashboardResult {
  return { attemptId, createdAt, skill, band, questions };
}

const zeroErrors = { blank: 0, 'over-limit': 0, plural: 0, spelling: 0, wrong: 0 };
const noBands = { reading: null, listening: null, writing: null, speaking: null };
const fourSkills = (): DashboardResult[] => [
  result('r', 1, 'reading', 6),
  result('l', 2, 'listening', 7),
  result('w', 3, 'writing', 6.5),
  result('s', 4, 'speaking', 7),
];

describe('dashboard bands and history', () => {
  it('returns a complete empty dashboard with all five zero error keys', () => {
    expect(buildDashboard([])).toEqual({ latestBands: noBands, currentBand: null,
      history: [], accuracy: [], errors: zeroErrors, weaknesses: [], unknownQuestionTypes: 0 });
  });

  it('excludes partial/no-review bands but counts their graded accuracy and errors', () => {
    const dashboard = buildDashboard([
      result('partial', 1, 'reading', null, [question('sentence-completion', 0, 1, 'blank')]),
      result('legacy', 2, 'listening', null, [question('sentence-completion', 1, 1)]),
    ]);
    expect(dashboard.latestBands).toEqual(noBands);
    expect(dashboard.currentBand).toBeNull();
    expect(dashboard.history).toEqual([]);
    expect(dashboard.accuracy).toEqual([
      { qtype: 'sentence-completion', marks: 1, maxMarks: 2, percentage: 50 },
    ]);
    expect(dashboard.errors).toEqual({ ...zeroErrors, blank: 1 });
  });

  it.each([1, 2, 3])('requires all four eligible skills, not just %i', (count) => {
    const dashboard = buildDashboard(fourSkills().slice(0, count));
    expect(dashboard.currentBand).toBeNull();
    expect(dashboard.history.every((event) => event.overall === null)).toBe(true);
  });

  it('keeps the four-skill mean unrounded by default', () => {
    const dashboard = buildDashboard(fourSkills());
    expect(dashboard.latestBands).toEqual({ reading: 6, listening: 7, writing: 6.5, speaking: 7 });
    expect(dashboard.currentBand).toBe(6.625);
    expect(dashboard.history.map((event) => event.overall)).toEqual([null, null, null, 6.625]);
  });

  it('does not substitute repeated attempts or a partial fourth skill for four eligible skills', () => {
    const callback = vi.fn(overallBand);
    const dashboard = buildDashboard([
      ...fourSkills().slice(0, 3), result('r2', 4, 'reading', 8),
      result('s-partial', 5, 'speaking', null, [question()]),
    ], callback);
    expect(dashboard.latestBands).toEqual({ reading: 8, listening: 7, writing: 6.5, speaking: null });
    expect(dashboard.currentBand).toBeNull();
    expect(dashboard.history.every((event) => event.overall === null)).toBe(true);
    expect(callback).not.toHaveBeenCalled();
    expect(dashboard.errors.wrong).toBe(1);
  });

  it('preserves event bands, uses historical latest eligible bands, and skips later partials', () => {
    const inputs = [...fourSkills(),
      result('r-new', 5, 'reading', 8), result('r-partial', 6, 'reading', null, [question()]),
      result('l-new', 7, 'listening', 5), result('l-no-review', 8, 'listening', null),
    ].reverse();
    const dashboard = buildDashboard(inputs);
    expect(dashboard.history).toEqual([
      { ...noBands, attemptId: 'r', createdAt: 1, reading: 6, overall: null },
      { ...noBands, attemptId: 'l', createdAt: 2, listening: 7, overall: null },
      { ...noBands, attemptId: 'w', createdAt: 3, writing: 6.5, overall: null },
      { ...noBands, attemptId: 's', createdAt: 4, speaking: 7, overall: 6.625 },
      { ...noBands, attemptId: 'r-new', createdAt: 5, reading: 8, overall: 7.125 },
      { ...noBands, attemptId: 'l-new', createdAt: 7, listening: 5, overall: 6.625 },
    ]);
    expect(dashboard.latestBands).toEqual({ reading: 8, listening: 5, writing: 6.5, speaking: 7 });
    expect(dashboard.currentBand).toBe(6.625);
    expect(dashboard.errors.wrong).toBe(1);
  });

  it('accepts exam rounding from the caller only after all four bands are present', () => {
    const callback = vi.fn(overallBand);
    const dashboard = buildDashboard([...fourSkills(), result('r2', 5, 'reading', 8)], callback);
    expect(callback.mock.calls).toEqual([[[6, 7, 6.5, 7]], [[8, 7, 6.5, 7]]]);
    expect(dashboard.history.map((event) => event.overall)).toEqual([null, null, null, 6.5, 7]);
    expect(dashboard.currentBand).toBe(7);
  });

  it('treats zero as an eligible band, including a zero overall', () => {
    const dashboard = buildDashboard(fourSkills().map((entry) => ({ ...entry, band: 0 })));
    expect(dashboard.currentBand).toBe(0);
    expect(dashboard.history.at(-1)?.overall).toBe(0);
  });
});

describe('dashboard accuracy, errors and weaknesses', () => {
  it('weights Choose-N accuracy and error frequency by marks, not graded entry counts', () => {
    const dashboard = buildDashboard([
      result('a', 1, 'reading', null, [question('choose-n', 1, 2), question('choose-n', 0, 3, 'over-limit')]),
      result('b', 2, 'listening', null, [question('choose-n', 2, 2), question('choose-n', 0, 2, 'blank')]),
    ]);
    expect(dashboard.accuracy[0]).toMatchObject({ qtype: 'choose-n', marks: 3, maxMarks: 9 });
    expect(dashboard.accuracy[0].percentage).toBeCloseTo(100 / 3);
    expect(dashboard.errors).toEqual({ ...zeroErrors, wrong: 1, 'over-limit': 3, blank: 2 });
  });

  it('includes every error class and excludes correct entries from error frequencies', () => {
    const dashboard = buildDashboard([result('a', 1, 'reading', null, [
      question('short-answer', 0, 1, 'blank'), question('short-answer', 0, 1, 'over-limit'),
      question('short-answer', 0, 1, 'plural'), question('short-answer', 0, 1, 'spelling'),
      question('short-answer', 0, 1, 'wrong'),
      { ...question('short-answer', 1, 1), errorClass: 'wrong' },
    ])]);
    expect(dashboard.errors).toEqual({ blank: 1, 'over-limit': 1, plural: 1, spelling: 1, wrong: 1 });
  });

  it('counts missing/legacy/unrecognised qtypes but excludes them from accuracy', () => {
    const missing = { ...question(null, 0, 2, 'blank') };
    const legacy = { ...question(null, 0, 1, 'spelling') };
    Reflect.deleteProperty(legacy, 'qtype');
    // Simulate malformed legacy data without weakening the public DTO type.
    const unknown = { ...question(null, 0, 1), qtype: 'legacy-type' } as unknown as DashboardResult['questions'][number];
    const dashboard = buildDashboard([result('old', 1, 'reading', null, [
      missing, legacy, unknown, question('short-answer', 1, 1),
    ])]);
    expect(dashboard.unknownQuestionTypes).toBe(3);
    expect(dashboard.accuracy).toEqual([{ qtype: 'short-answer', marks: 1, maxMarks: 1, percentage: 100 }]);
    expect(dashboard.errors).toEqual({ ...zeroErrors, blank: 2, spelling: 1, wrong: 1 });
    expect(dashboard.weaknesses).toEqual([]);
  });

  it('ranks top three by lowest accuracy, larger sample, then stable lexical qtype', () => {
    const dashboard = buildDashboard([result('a', 1, 'reading', null, [
      question('short-answer', 1, 2), question('note-completion', 0, 1),
      question('form-completion', 2, 4), question('choose-n', 2, 4),
      question('multiple-choice', 1, 1),
    ])]);
    expect(dashboard.weaknesses).toEqual([
      { qtype: 'note-completion', marks: 0, maxMarks: 1, percentage: 0 },
      { qtype: 'choose-n', marks: 2, maxMarks: 4, percentage: 50 },
      { qtype: 'form-completion', marks: 2, maxMarks: 4, percentage: 50 },
    ]);
    expect(dashboard.accuracy.map((entry) => entry.qtype)).toEqual([
      'choose-n', 'form-completion', 'multiple-choice', 'note-completion', 'short-answer',
    ]);
  });

  it('returns fewer than three weaknesses when appropriate and none for all-correct results', () => {
    const dashboard = buildDashboard([result('a', 1, 'reading', null, [
      question('choose-n', 0, 1), question('short-answer', 1, 1),
    ])]);
    expect(dashboard.weaknesses).toEqual([dashboard.accuracy[0]]);
    expect(buildDashboard([result('b', 1, 'reading', null, [
      question('choose-n', 2, 2), question('short-answer', 1, 1),
    ])]).weaknesses).toEqual([]);
  });
});

describe('dashboard determinism and invalid inputs', () => {
  it('orders equal timestamps by attempt id and keeps distinct attempts with identical questions', () => {
    const inputs = [result('z', 1, 'reading', 8, [question()]), result('a', 1, 'reading', 6, [question()])];
    const dashboard = buildDashboard(inputs);
    expect(dashboard.history.map((event) => event.attemptId)).toEqual(['a', 'z']);
    expect(dashboard.latestBands.reading).toBe(8);
    expect(dashboard.accuracy[0]).toEqual({ qtype: 'choose-n', marks: 2, maxMarks: 4, percentage: 50 });
    expect(buildDashboard([...inputs].reverse())).toEqual(dashboard);
  });

  it('merges duplicate imports by attemptId using the newest createdAt, not band eligibility', () => {
    const inputs = [
      result('duplicate', 1, 'reading', 8, [question('choose-n', 0, 2)]),
      result('duplicate', 3, 'reading', null, [question('choose-n', 2, 2)]),
      result('distinct', 2, 'reading', 6, [question('choose-n', 1, 2)]),
    ];
    const dashboard = buildDashboard([...inputs, inputs[1]]);
    expect(dashboard.latestBands.reading).toBe(6);
    expect(dashboard.history.map((event) => event.attemptId)).toEqual(['distinct']);
    expect(dashboard.accuracy[0]).toEqual({ qtype: 'choose-n', marks: 3, maxMarks: 4, percentage: 75 });
    expect(dashboard.errors.wrong).toBe(1);
    expect(buildDashboard([...inputs].reverse())).toEqual(dashboard);
  });

  it('resolves conflicting duplicate timestamps deterministically, independent of question/key order', () => {
    const a = result('duplicate', 1, 'reading', 6, [question('short-answer', 0, 1)]);
    const b = result('duplicate', 1, 'reading', 8, [question('choose-n', 1, 2), question('short-answer', 1, 1)]);
    const reordered: DashboardResult = { questions: [...b.questions].reverse(), band: b.band,
      skill: b.skill, createdAt: b.createdAt, attemptId: b.attemptId };
    expect(buildDashboard([a, b])).toEqual(buildDashboard([reordered, a]));
    expect(buildDashboard([a, b]).latestBands.reading).toBe(8);
    expect(buildDashboard([a, b]).errors.wrong).toBe(1);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    'ignores invalid band %s without losing a previous eligible band or valid scores', (band) => {
      const dashboard = buildDashboard([...fourSkills(), result('bad', 5, 'reading', band, [question()])]);
      expect(dashboard.latestBands.reading).toBe(6);
      expect(dashboard.currentBand).toBe(6.625);
      expect(dashboard.history).toHaveLength(4);
      expect(dashboard.errors.wrong).toBe(1);
    },
  );

  it.each([
    [Number.NaN, 1], [Number.POSITIVE_INFINITY, 1], [Number.NEGATIVE_INFINITY, 1],
    [-1, 1], [2, 1], [0, 0], [0, -1], [0, Number.NaN], [0, Number.POSITIVE_INFINITY],
  ])('ignores invalid score pair marks=%s maxMarks=%s without poisoning aggregates', (marks, maxMarks) => {
    const dashboard = buildDashboard([result('a', 1, 'reading', null, [
      question('choose-n', marks, maxMarks), question('choose-n', 1, 2),
    ])]);
    expect(dashboard.accuracy).toEqual([{ qtype: 'choose-n', marks: 1, maxMarks: 2, percentage: 50 }]);
    expect(dashboard.errors).toEqual({ ...zeroErrors, wrong: 1 });
  });

  it('guards numeric overflow in means, accuracy, percentages and error totals', () => {
    const huge = Number.MAX_VALUE;
    const dashboard = buildDashboard([
      ...fourSkills().map((entry) => ({ ...entry, band: huge })),
      result('a', 5, 'reading', null, [question('choose-n', 0, huge), question('choose-n', 0, huge)]),
      result('b', 6, 'reading', null, [question('short-answer', huge, huge)]),
    ]);
    expect(dashboard.currentBand).toBe(huge);
    expect(dashboard.accuracy).toEqual([
      { qtype: 'choose-n', marks: 0, maxMarks: huge, percentage: 0 },
      { qtype: 'short-answer', marks: huge, maxMarks: huge, percentage: 100 },
    ]);
    expect(dashboard.errors.wrong).toBe(huge);
  });

  it('ignores invalid timestamps instead of corrupting chronology or duplicate selection', () => {
    const dashboard = buildDashboard([
      result('a', Number.NaN, 'reading', 9, [question()]),
      result('a', 1, 'reading', 6, [question('choose-n', 2, 2)]),
      result('b', Number.POSITIVE_INFINITY, 'listening', 9, [question()]),
      result('c', -1, 'writing', 9, [question()]),
    ]);
    expect(dashboard.history.map((event) => event.attemptId)).toEqual(['a']);
    expect(dashboard.latestBands).toEqual({ ...noBands, reading: 6 });
    expect(dashboard.errors).toEqual(zeroErrors);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])('guards invalid callback output %s', (value) => {
    const dashboard = buildDashboard(fourSkills(), () => value);
    expect(dashboard.currentBand).toBeNull();
    expect(dashboard.history.at(-1)?.overall).toBeNull();
  });

  it('does not mutate input arrays or nested question data', () => {
    const inputs = [...fourSkills().reverse(), result('partial', 5, 'reading', null, [question()])];
    const before = structuredClone(inputs);
    buildDashboard(inputs, (bands) => { bands[0] = 0; return 1; });
    expect(inputs).toEqual(before);
    expect(buildDashboard(inputs).latestBands.reading).toBe(6);
  });
});