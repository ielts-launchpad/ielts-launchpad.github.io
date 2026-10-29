import { describe, expect, it } from 'vitest';
import type {
  MultiQuestion,
  QuestionGroup,
  StandardQuestion,
} from '../../src/engine/content/schema';
import type { LoadedTest } from '../../src/engine/content/loader';
import { gradeQuestion, gradeTest, type UserResponse } from '../../src/engine/grading/grade';

function gapGroup(
  answers: string[],
  wordLimit: QuestionGroup['wordLimit'] = { words: 2, numberAllowed: true },
): QuestionGroup {
  const question: StandardQuestion = {
    id: 'q',
    number: 1,
    answers,
    evidence: { quote: 'x' },
  };
  return {
    id: 'g',
    instructions: 'Complete the gap.',
    interaction: 'gap',
    qtype: 'short-answer',
    wordLimit,
    questions: [question],
  };
}

function optionGroup(
  interaction: 'single' | 'select' | 'dragBank',
  answers: string[],
  acceptAlternatives?: boolean,
): QuestionGroup {
  const question: StandardQuestion = {
    id: 'q',
    number: 1,
    answers,
    evidence: { quote: 'x' },
  };
  return {
    id: 'g',
    instructions: 'Choose.',
    interaction,
    qtype: 'multiple-choice',
    options: { A: 'a', B: 'b', C: 'c' },
    acceptAlternatives,
    questions: [question],
  };
}

function multiGroup(): QuestionGroup {
  const question: MultiQuestion = {
    id: 'q',
    numbers: [1, 2],
    n: 2,
    answers: ['B', 'D'],
  };
  return {
    id: 'g',
    instructions: 'Choose TWO.',
    interaction: 'multi',
    qtype: 'choose-n',
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    questions: [question],
  };
}

const grade = (group: QuestionGroup, response: UserResponse) =>
  gradeQuestion(group, group.questions[0], response);

describe('gradeQuestion — gap', () => {
  it('accepts an exact match', () => {
    const r = grade(gapGroup(['main entrance']), 'main entrance');
    expect(r.correct).toBe(true);
    expect(r.marks).toBe(1);
    expect(r.errorClass).toBeNull();
  });

  it('is case-insensitive, trims and ignores a trailing full stop', () => {
    expect(grade(gapGroup(['main entrance']), '  Main   Entrance. ').correct).toBe(true);
  });

  it('accepts optional-word variants', () => {
    const group = gapGroup(['(the) river'], { words: 2, numberAllowed: false });
    expect(grade(group, 'river').correct).toBe(true);
    expect(grade(group, 'the river').correct).toBe(true);
  });

  it('treats digit and word numbers as equal both ways', () => {
    expect(grade(gapGroup(['21']), 'twenty-one').correct).toBe(true);
    expect(grade(gapGroup(['twenty-one']), '21').correct).toBe(true);
    expect(grade(gapGroup(['four']), '4').correct).toBe(true);
  });

  it('marks a blank answer as blank', () => {
    const r = grade(gapGroup(['river']), '   ');
    expect(r.correct).toBe(false);
    expect(r.errorClass).toBe('blank');
  });

  it('marks an over-limit answer wrong even if it contains the answer', () => {
    const group = gapGroup(['main entrance'], { words: 2, numberAllowed: false });
    const r = grade(group, 'the main entrance');
    expect(r.correct).toBe(false);
    expect(r.errorClass).toBe('over-limit');
  });

  it('does not count an allowed number token toward the limit', () => {
    const group = gapGroup(['room 5'], { words: 1, numberAllowed: true });
    expect(grade(group, 'room 5').correct).toBe(true);
  });

  it('classifies a trailing-s/es difference as plural', () => {
    const group = gapGroup(['bee'], { words: 1, numberAllowed: false });
    expect(grade(group, 'bees').errorClass).toBe('plural');
    const group2 = gapGroup(['box'], { words: 1, numberAllowed: false });
    expect(grade(group2, 'boxes').errorClass).toBe('plural');
  });

  it('classifies a close miss (length ≥ 4, distance ≤ 2) as spelling', () => {
    const group = gapGroup(['colour'], { words: 1, numberAllowed: false });
    expect(grade(group, 'color').errorClass).toBe('spelling');
  });

  it('does not use spelling for very short answers', () => {
    const group = gapGroup(['cat'], { words: 1, numberAllowed: false });
    expect(grade(group, 'bat').errorClass).toBe('wrong');
  });

  it('classifies an unrelated answer as wrong', () => {
    const group = gapGroup(['river'], { words: 1, numberAllowed: false });
    expect(grade(group, 'mountain').errorClass).toBe('wrong');
  });
});

describe('gradeQuestion — single / select / dragBank', () => {
  it('accepts the exact option letter (case-insensitive)', () => {
    expect(grade(optionGroup('single', ['B']), 'b').correct).toBe(true);
    expect(grade(optionGroup('select', ['C']), 'C').correct).toBe(true);
    expect(grade(optionGroup('dragBank', ['A']), 'A').correct).toBe(true);
  });

  it('rejects a wrong option letter', () => {
    const r = grade(optionGroup('single', ['B']), 'A');
    expect(r.correct).toBe(false);
    expect(r.errorClass).toBe('wrong');
  });

  it('marks no selection as blank', () => {
    expect(grade(optionGroup('single', ['B']), null).errorClass).toBe('blank');
  });

  it('accepts any listed letter when acceptAlternatives is set', () => {
    const group = optionGroup('single', ['A', 'B'], true);
    expect(grade(group, 'A').correct).toBe(true);
    expect(grade(group, 'B').correct).toBe(true);
    expect(grade(group, 'C').correct).toBe(false);
  });
});

describe('gradeQuestion — multi (Choose N)', () => {
  it('awards full marks for the exact set regardless of order', () => {
    const r = grade(multiGroup(), ['D', 'B']);
    expect(r.marks).toBe(2);
    expect(r.maxMarks).toBe(2);
    expect(r.correct).toBe(true);
  });

  it('awards one mark per correct letter', () => {
    const r = grade(multiGroup(), ['B', 'A']);
    expect(r.marks).toBe(1);
    expect(r.correct).toBe(false);
    expect(r.errorClass).toBe('wrong');
  });

  it('ignores a wrong extra letter without penalty', () => {
    expect(grade(multiGroup(), ['B', 'D']).marks).toBe(2);
  });

  it('marks an empty selection as blank', () => {
    expect(grade(multiGroup(), []).errorClass).toBe('blank');
  });
});

function loadedTest(): LoadedTest {
  return {
    meta: {
      id: 't',
      exam: 'ielts',
      variant: 'academic',
      kind: 'practice',
      title: 'T',
      status: 'draft',
      skills: ['listening', 'reading'],
      license: 'CC-BY-SA-4.0',
      version: 1,
    },
    dir: '/virtual/t',
    isDraft: true,
    listening: [
      {
        part: {
          part: 1,
          audio: '/audio/x.opus',
          durationSec: 10,
          transcript: 't.md',
          groups: [
            {
              id: 'lg',
              instructions: 'Gap.',
              interaction: 'gap',
              qtype: 'short-answer',
              wordLimit: { words: 2, numberAllowed: false },
              questions: [
                { id: 'l1', number: 1, answers: ['river'], evidence: { quote: 'x' } },
                { id: 'l2', number: 2, answers: ['bridge'], evidence: { quote: 'x' } },
              ],
            },
          ],
        },
        transcriptText: 'x',
        audioFsPath: '/virtual/x.opus',
      },
    ],
    reading: [
      {
        passage: {
          passage: 1,
          title: 'P',
          file: 'p.md',
          groups: [
            {
              id: 'rg',
              instructions: 'Choose.',
              interaction: 'single',
              qtype: 'multiple-choice',
              options: { A: 'a', B: 'b' },
              questions: [
                { id: 'r1', number: 1, answers: ['A'], evidence: { quote: 'x' } },
                { id: 'r2', number: 2, answers: ['B'], evidence: { quote: 'x' } },
              ],
            },
          ],
        },
        markdownText: 'x',
      },
    ],
    writing: [],
    speaking: null,
  };
}

describe('gradeTest', () => {
  it('scores each skill, summing marks and maxima', () => {
    const result = gradeTest(loadedTest(), {
      l1: 'river',
      l2: 'wrong',
      r1: 'A',
      r2: 'A',
    });

    const listening = result.skills.find((s) => s.skill === 'listening');
    const reading = result.skills.find((s) => s.skill === 'reading');

    expect(listening).toMatchObject({ raw: 1, max: 2 });
    expect(reading).toMatchObject({ raw: 1, max: 2 });
  });

  it('awards full marks for a perfect sheet and zero for an empty one', () => {
    const perfect = gradeTest(loadedTest(), { l1: 'river', l2: 'bridge', r1: 'A', r2: 'B' });
    expect(perfect.skills.every((s) => s.raw === s.max)).toBe(true);

    const empty = gradeTest(loadedTest(), {});
    expect(empty.skills.every((s) => s.raw === 0)).toBe(true);
  });
});
