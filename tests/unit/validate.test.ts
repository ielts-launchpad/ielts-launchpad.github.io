import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LoadedTest } from '../../src/engine/content/loader';
import { validateTest } from '../../src/engine/content/validate';

const QUOTE = 'the bees are busy';
const passageText = `${QUOTE} ${'lorem '.repeat(700)}`.trim();
const existingFile = fileURLToPath(import.meta.url);
const sampleOpus = join(
  process.cwd(),
  'public',
  'audio',
  'academic',
  'sample-01',
  'part-1.opus',
);

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

interface ListeningOpts {
  transcriptText: string;
  quote: string;
  durationSec?: number;
  audioStart?: number;
  audioFsPath?: string;
}

/** A listening-bearing test whose reading section is already well-formed. */
function listeningTest(opts: ListeningOpts): LoadedTest {
  const test = structuredClone(basePassingTest());
  test.meta.skills = ['reading', 'listening'];
  test.listening = [
    {
      part: {
        part: 1,
        audio: '/audio/part-1.opus',
        durationSec: opts.durationSec ?? 30,
        transcript: 'part-1.transcript.md',
        groups: [
          {
            id: 'l-g1',
            instructions: 'Choose the correct letter.',
            interaction: 'single',
            qtype: 'multiple-choice',
            options: { A: 'first', B: 'second' },
            questions: [
              {
                id: 'lq1',
                number: 5,
                answers: ['A'],
                evidence: { quote: opts.quote, audioStart: opts.audioStart },
              },
            ],
          },
        ],
      },
      transcriptText: opts.transcriptText,
      audioFsPath: opts.audioFsPath ?? existingFile,
    },
  ];
  return test;
}


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

  it('rule 5: flags a missing or empty listening transcript', () => {
    const test = structuredClone(basePassingTest());
    test.meta.skills = ['reading', 'listening'];
    test.listening = [
      {
        part: {
          part: 1,
          audio: '/audio/part-1.opus',
          durationSec: 1,
          transcript: 'part-1.transcript.md',
          groups: [
            {
              id: 'l-g1',
              instructions: 'Choose the correct letter.',
              interaction: 'single',
              qtype: 'multiple-choice',
              options: { A: 'first', B: 'second' },
              questions: [{ id: 'lq1', number: 1, answers: ['A'], evidence: { quote: QUOTE } }],
            },
          ],
        },
        transcriptText: '   ',
        audioFsPath: existingFile,
      },
    ];
    expect(rulesOf(test)).toContain(5);
  });

  it('rule 1: flags a listed skill that has no content', () => {
    const test = structuredClone(basePassingTest());
    test.meta.skills = ['reading', 'writing'];
    expect(rulesOf(test)).toContain(1);
  });

  it('rule 1: flags content for a skill that is not listed', () => {
    const test = structuredClone(basePassingTest());
    test.meta.skills = ['writing'];
    expect(rulesOf(test)).toContain(1);
  });

  it('rule 1: flags a mock that does not list all four skills', () => {
    const test = structuredClone(basePassingTest());
    test.meta.kind = 'mock';
    expect(rulesOf(test)).toContain(1);
  });

  it('rule 4: flags more than one answer without acceptAlternatives', () => {
    const test = structuredClone(basePassingTest());
    test.reading[0].passage.groups[0].questions[0].answers = ['A', 'B'];
    expect(rulesOf(test)).toContain(4);
  });

  it('rule 4: allows multiple answers when acceptAlternatives is set', () => {
    const test = structuredClone(basePassingTest());
    const group = test.reading[0].passage.groups[0];
    group.acceptAlternatives = true;
    group.questions[0].answers = ['A', 'B'];
    expect(rulesOf(test)).not.toContain(4);
  });

  it('rule 5: matches a transcript quote that spans lines after stripping markup', () => {
    const problems = validateTest(
      listeningTest({
        transcriptText:
          '[00:00.0] NARRATOR: the quick brown\n[00:02.0] CLERK: fox jumps over the lazy dog',
        quote: 'the quick brown fox jumps over',
        durationSec: 10,
      }),
    );
    expect(problems.some((p) => p.rule === 5)).toBe(false);
  });

  it('rule 5: still flags a quote that is genuinely absent from the transcript', () => {
    const problems = validateTest(
      listeningTest({
        transcriptText: '[00:00.0] CLERK: welcome to the garden centre',
        quote: 'this phrase is not present',
        durationSec: 10,
      }),
    );
    expect(problems.some((p) => p.rule === 5)).toBe(true);
  });

  it('rule 6: flags an audioStart that is not before the part duration', () => {
    const problems = validateTest(
      listeningTest({
        transcriptText: '[00:00.0] CLERK: the bees are busy',
        quote: 'the bees are busy',
        durationSec: 5,
        audioStart: 10,
      }),
    );
    expect(problems.some((p) => p.rule === 6 && p.message.includes('audioStart'))).toBe(true);
  });

  it('rule 6: accepts an audioStart inside the part duration', () => {
    const problems = validateTest(
      listeningTest({
        transcriptText: '[00:00.0] CLERK: the bees are busy',
        quote: 'the bees are busy',
        durationSec: 30,
        audioStart: 2,
      }),
    );
    expect(problems.some((p) => p.rule === 6 && p.message.includes('audioStart'))).toBe(false);
  });

  it('rule 6: flags a declared duration that does not match the real audio', () => {
    const problems = validateTest(
      listeningTest({
        transcriptText: '[00:00.0] CLERK: the bees are busy',
        quote: 'the bees are busy',
        durationSec: 50, // the committed sample is ~24s
        audioStart: 2,
        audioFsPath: sampleOpus,
      }),
    );
    expect(problems.some((p) => p.rule === 6 && p.message.includes('durationSec'))).toBe(true);
  });

  it('rule 6: accepts a declared duration matching the real audio within ±1s', () => {
    const problems = validateTest(
      listeningTest({
        transcriptText: '[00:00.0] CLERK: the bees are busy',
        quote: 'the bees are busy',
        durationSec: 24,
        audioStart: 2,
        audioFsPath: sampleOpus,
      }),
    );
    expect(problems.some((p) => p.rule === 6 && p.message.includes('durationSec'))).toBe(false);
  });

  it('rule 7: a well-formed test produces no perfect-answer-sheet problems', () => {
    expect(rulesOf(basePassingTest())).not.toContain(7);
  });

  it('rule 7: flags content whose own answer cannot score (over its word limit)', () => {
    const test = structuredClone(basePassingTest());
    const group = test.reading[0].passage.groups[1];
    group.wordLimit = { words: 1, numberAllowed: false };
    group.questions[0].answers = ['busy bees']; // two words, exceeds its own limit
    expect(rulesOf(test)).toContain(7);
  });
});
