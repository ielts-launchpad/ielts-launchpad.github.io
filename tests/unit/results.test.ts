import { describe, expect, it } from 'vitest';
import type { QuestionGroup } from '../../src/engine/content/schema';
import type { ReadingRunnerData } from '../../src/engine/runner/types';
import {
  answerLocationOffset,
  buildIssueUrl,
  buildReadingReview,
  buildResultsModel,
  findEvidenceRange,
  stripTranscriptHeaders,
  type ResultInput,
} from '../../src/engine/results/model';

const gap: QuestionGroup = {
  id: 'G1', instructions: 'Complete the answer.', interaction: 'gap', qtype: 'sentence-completion',
  wordLimit: { words: 2, numberAllowed: false },
  questions: [{ id: 'Q1', number: 1, prompt: 'Meeting place?', answers: ['main entrance', 'front gate'],
    evidence: { quote: 'main entrance', audioStart: 14 }, explanation: 'The place is named explicitly.' }],
};
const multi: QuestionGroup = {
  id: 'G2', instructions: 'Choose two.', interaction: 'multi', qtype: 'choose-n',
  options: { A: 'First', B: 'Second', C: 'Third' },
  questions: [{ id: 'Q2', numbers: [2, 3], n: 2, answers: ['A', 'C'], explanation: { A: 'First is included.' } }],
};
function input(): ResultInput {
  return {
    skill: 'listening', raw: 2, max: 3, testId: 'sample',
    results: [
      { questionId: 'Q1', numbers: [1], marks: 1, maxMarks: 1, correct: true, errorClass: null },
      { questionId: 'Q2', numbers: [2, 3], marks: 1, maxMarks: 2, correct: false, errorClass: 'wrong' },
    ],
    review: {
      variant: 'academic', kind: 'practice', answers: { Q1: 'main entrance', Q2: ['A', 'B'] },
      sections: [
        { number: 1, title: 'Arrival', text: '[00:01.0] GUIDE: Meet at the main entrance.', groups: [gap], audio: '/part-1.opus' },
        { number: 2, title: 'Choices', text: 'First and third.', groups: [multi], audio: '/part-2.opus' },
      ],
    },
  };
}

describe('results model', () => {
  it('keeps raw marks, per-section totals, answers, evidence and explanations from the snapshot', () => {
    const result = input();
    const before = structuredClone(result);
    const model = buildResultsModel(result);
    expect(model).toMatchObject({ raw: 2, max: 3, percentage: 67, skill: 'listening', variant: 'academic', canEstimateBand: false });
    expect(model.sections.map(({ number, raw, max }) => ({ number, raw, max }))).toEqual([
      { number: 1, raw: 1, max: 1 }, { number: 2, raw: 1, max: 2 },
    ]);
    expect(model.questions[0]).toMatchObject({
      userAnswers: ['main entrance'], correctAnswers: ['main entrance', 'front gate'],
      prompt: 'Meeting place?', explanation: 'The place is named explicitly.',
      context: 'Meet at the main entrance.', highlight: { start: 12, end: 25 }, audio: '/part-1.opus',
    });
    expect(model.questions[1]).toMatchObject({
      numbers: [2, 3], userAnswers: ['A: First', 'B: Second'], correctAnswers: ['A: First', 'C: Third'],
      marks: 1, maxMarks: 2, correct: false, errorClass: 'wrong', highlight: null,
      explanation: { A: 'First is included.' },
    });
    expect(result).toEqual(before);
  });

  it.each(['reading', 'listening'] as const)('only estimates %s bands for exactly 40 questions, in either mode', (skill) => {
    for (const kind of ['practice', 'mock'] as const) {
      const result = input();
      result.skill = skill;
      result.review!.kind = kind;
      for (const max of [0, 3, 4, 24, 39, 40, 41]) {
        result.max = max;
        expect(buildResultsModel(result)).toMatchObject({
          raw: 2, max, canEstimateBand: max === 40,
          percentage: max > 0 ? Math.round(200 / max) : 0,
        });
      }
    }
  });

  it('does not estimate a 40-question result without a saved variant/review', () => {
    const result = input();
    result.max = 40;
    delete result.review;
    expect(buildResultsModel(result)).toMatchObject({ raw: 2, max: 40, percentage: 5, canEstimateBand: false });
  });

  it('retains scores and every graded question if the review snapshot is absent or incomplete', () => {
    const result = input();
    delete result.review;
    const model = buildResultsModel(result);
    expect(model.sections).toEqual([]);
    expect(model.questions).toHaveLength(2);
    expect(model.questions[0]).toMatchObject({ marks: 1, hasSnapshot: false, correctAnswers: [], highlight: null });
    expect(model.canEstimateBand).toBe(false);
    const incomplete = input();
    incomplete.review!.sections = [];
    expect(buildResultsModel(incomplete).questions[1].userAnswers).toEqual(['A', 'B']);
  });

  it('handles blank responses, absent explanations and missing evidence quotes without inventing a mark', () => {
    const result = input();
    result.review!.answers.Q1 = null;
    result.review!.sections[0].text = 'No matching passage text.';
    result.review!.sections[0].groups = [{ ...gap, questions: [{ ...gap.questions[0], explanation: undefined }] }];
    const question = buildResultsModel(result).questions[0];
    expect(question.userAnswers).toEqual([]);
    expect(question.explanation).toBeUndefined();
    expect(question.highlight).toBeNull();
  });

  it('builds an independent reading content and answer snapshot with paragraph labels', () => {
    const data: ReadingRunnerData = {
      testId: 'reading', testTitle: 'Reading', kind: 'practice', isDraft: true, durationSec: 3600,
      passages: [{ passage: 1, title: 'Arrival', paragraphs: [
        { label: 'A', text: 'Meet at the main entrance.' }, { label: null, text: 'Next paragraph.' },
      ], groups: structuredClone([gap]) }],
    };
    const answers = { Q1: 'main entrance' };
    const review = buildReadingReview(data, answers, 'general');
    expect(review).toMatchObject({ variant: 'general', kind: 'practice', answers, sections: [
      { number: 1, title: 'Arrival', text: '[A] Meet at the main entrance.\n\nNext paragraph.', groups: [gap] },
    ] });
    answers.Q1 = 'changed';
    data.passages[0].groups[0].questions[0].answers[0] = 'changed';
    expect(review.answers.Q1).toBe('main entrance');
    expect(review.sections[0].groups[0].questions[0].answers[0]).toBe('main entrance');
  });
});

describe('evidence offsets', () => {
  it('returns original UTF-16 offsets for exact case-insensitive whitespace-normalised evidence', () => {
    const text = '🙂 Meet at the MAIN\n  entrance today.';
    const range = findEvidenceRange(text, 'main entrance');
    expect(range).toEqual({ start: text.indexOf('MAIN'), end: text.indexOf(' today') });
    expect(text.slice(range!.start, range!.end)).toBe('MAIN\n  entrance');
  });

  it('strips timestamp/speaker headers and matches across transcript lines', () => {
    const text = '[00:01.2] GUIDE: Meet at the main\n[00:02] VISITOR: entrance now.';
    expect(stripTranscriptHeaders(text)).toBe('Meet at the main\nentrance now.');
    const range = findEvidenceRange(text, 'MAIN entrance', true);
    expect(range).toEqual({ start: text.indexOf('main'), end: text.indexOf(' now') });
    expect(findEvidenceRange(stripTranscriptHeaders(text), 'main entrance')).not.toBeNull();
  });

  it('escapes regex punctuation and does not fuzzy-match or mark empty/missing evidence', () => {
    expect(findEvidenceRange('It costs $4.50 (today).', '$4.50 (today)')).toEqual({ start: 9, end: 22 });
    expect(findEvidenceRange('main entrance', 'main entrence')).toBeNull();
    expect(findEvidenceRange('main entrance', '   ')).toBeNull();
    expect(findEvidenceRange('main entrance', 'elsewhere')).toBeNull();
  });
});

describe('results extras', () => {
  it('encodes test/question/user answers without losing reserved characters or markup', () => {
    const testId = 'test & ?/#';
    const questionId = 'Q=1+2';
    const userAnswer = ['<script>alert("x")</script>', 'A & B\nC'];
    const url = new URL(buildIssueUrl('https://github.com/example/repo/', testId, questionId, userAnswer));
    expect(url.pathname).toBe('/example/repo/issues/new');
    expect(url.searchParams.get('title')).toBe(`${testId}: ${questionId}`);
    expect(JSON.parse(url.searchParams.get('body')!)).toEqual({ testId, questionId, userAnswer });
    expect(JSON.parse(new URL(buildIssueUrl('https://github.com/example/repo', 't', 'q', null)).searchParams.get('body')!).userAnswer).toBeNull();
  });

  it('seeks three seconds before the answer, clamping early and invalid starts to zero', () => {
    expect(answerLocationOffset(14.3)).toBe(11.3);
    expect(answerLocationOffset(3)).toBe(0);
    expect(answerLocationOffset(1)).toBe(0);
    expect(answerLocationOffset(-10)).toBe(0);
    expect(answerLocationOffset(NaN)).toBe(0);
    expect(answerLocationOffset(Infinity)).toBe(0);
  });
});