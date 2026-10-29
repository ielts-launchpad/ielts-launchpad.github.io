import { describe, expect, it } from 'vitest';
import type { LoadedTest } from '../../src/engine/content/loader';
import { validateTest } from '../../src/engine/content/validate';

const QUOTE = 'the bees are busy';
const passageText = `${QUOTE} ${'lorem '.repeat(700)}`.trim();

function basePassingTest(): LoadedTest {
  return {
    meta: {
      id: 't1',
      exam: 'ielts',
      variant: 'academic',
      kind: 'practice',
      title: 'Test',
      status: 'draft',
      skills: ['reading'],
      license: 'CC-BY-SA-4.0',
      version: 1,
    },
    dir: '/virtual/t1',
    isDraft: true,
    listening: [],
    reading: [
      {
        passage: {
          passage: 1,
          title: 'Passage',
          file: 'passage-1.md',
          groups: [
            {
              id: 'g-select',
              instructions: 'Choose the correct letter.',
              interaction: 'single',
              qtype: 'multiple-choice',
              options: { A: 'first', B: 'second' },
              questions: [
                { id: 'q1', number: 1, answers: ['A'], evidence: { quote: QUOTE } },
              ],
            },
            {
              id: 'g-gap',
              instructions: 'Answer the questions.',
              interaction: 'gap',
              qtype: 'short-answer',
              wordLimit: { words: 2, numberAllowed: false },
              questions: [
                { id: 'q2', number: 2, answers: ['busy bees'], evidence: { quote: QUOTE } },
              ],
            },
          ],
        },
        markdownText: passageText,
      },
    ],
    writing: [],
    speaking: null,
  };
}

const rulesOf = (test: LoadedTest): number[] => validateTest(test).map((p) => p.rule);

describe('validateTest', () => {
  it('reports no problems for a well-formed test', () => {
    expect(validateTest(basePassingTest())).toEqual([]);
  });

  it('rule 1: flags duplicate ids', () => {
    const test = structuredClone(basePassingTest());
    test.reading[0].passage.groups[1].questions[0].id = 'q1';
    expect(rulesOf(test)).toContain(1);
  });

  it('rule 2: flags a mock with the wrong structure', () => {
    const test = structuredClone(basePassingTest());
    test.meta.kind = 'mock';
    expect(rulesOf(test)).toContain(2);
  });

  it('rule 3: flags a gap answer over the word limit', () => {
    const test = structuredClone(basePassingTest());
    test.reading[0].passage.groups[1].wordLimit = { words: 1, numberAllowed: false };
    expect(rulesOf(test)).toContain(3);
  });

  it('rule 4: flags an answer that is not an option key', () => {
    const test = structuredClone(basePassingTest());
    test.reading[0].passage.groups[0].questions[0].answers = ['Z'];
    expect(rulesOf(test)).toContain(4);
  });

  it('rule 5: flags an evidence quote missing from the source', () => {
    const test = structuredClone(basePassingTest());
    test.reading[0].passage.groups[0].questions[0].evidence = { quote: 'not in the passage' };
    expect(rulesOf(test)).toContain(5);
  });

  it('rule 6: flags a passage outside the word range', () => {
    const test = structuredClone(basePassingTest());
    test.reading[0].markdownText = 'far too short';
    expect(rulesOf(test)).toContain(6);
  });

  it('rule 6: flags a missing audio file', () => {
    const test = structuredClone(basePassingTest());
    test.listening = [
      {
        part: {
          part: 1,
          audio: '/audio/missing.opus',
          durationSec: 1,
          transcript: 'transcript.md',
          groups: [
            {
              id: 'l-g1',
              instructions: 'Choose the correct letter.',
              interaction: 'single',
              qtype: 'multiple-choice',
              options: { A: 'first', B: 'second' },
              questions: [{ id: 'lq1', number: 3, answers: ['A'], evidence: { quote: QUOTE } }],
            },
          ],
        },
        transcriptText: passageText,
        audioFsPath: '/virtual/does-not-exist.opus',
      },
    ];
    expect(rulesOf(test)).toContain(6);
  });

  it('rule 6: flags template placeholders that do not match question numbers', () => {
    const test = structuredClone(basePassingTest());
    const group = test.reading[0].passage.groups[1];
    group.template = 'Fill {{2}} and {{9}}';
    expect(rulesOf(test)).toContain(6);
  });
});
