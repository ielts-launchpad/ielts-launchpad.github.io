import { describe, expect, it } from 'vitest';
import {
  buildReadingRunnerData,
  parsePassageParagraphs,
} from '../../src/engine/content/runner-data';
import type { LoadedTest } from '../../src/engine/content/loader';
import type { QuestionGroup } from '../../src/engine/content/schema';

describe('parsePassageParagraphs', () => {
  it('splits blank-line blocks and extracts [label]', () => {
    const paras = parsePassageParagraphs('[A] First one.\n\n[B] Second\nwrapped line.');
    expect(paras).toEqual([
      { label: 'A', text: 'First one.' },
      { label: 'B', text: 'Second wrapped line.' },
    ]);
  });

  it('keeps unlabelled blocks with a null label', () => {
    expect(parsePassageParagraphs('Just prose.')).toEqual([{ label: null, text: 'Just prose.' }]);
  });

  it('ignores empty blocks', () => {
    expect(parsePassageParagraphs('\n\n[A] x\n\n\n')).toEqual([{ label: 'A', text: 'x' }]);
  });
});

function group(): QuestionGroup {
  return {
    id: 'g',
    instructions: 'Choose.',
    interaction: 'single',
    qtype: 'multiple-choice',
    options: { A: 'a', B: 'b' },
    questions: [{ id: 'q1', number: 1, answers: ['A'], evidence: { quote: 'x' } }],
  };
}

function loadedTest(): LoadedTest {
  return {
    meta: {
      id: 'sample-01',
      exam: 'ielts',
      variant: 'academic',
      kind: 'practice',
      title: 'Sample Practice 1',
      status: 'draft',
      skills: ['reading'],
      license: 'CC-BY-SA-4.0',
      version: 1,
    },
    dir: '/x',
    isDraft: true,
    listening: [],
    reading: [
      {
        passage: { passage: 2, title: 'Second', file: 'passage-2.md', groups: [group()] },
        markdownText: '[A] Two.',
      },
      {
        passage: { passage: 1, title: 'First', file: 'passage-1.md', groups: [group()] },
        markdownText: '[A] One.',
      },
    ],
    writing: [],
    speaking: null,
  };
}

describe('buildReadingRunnerData', () => {
  it('orders passages, parses prose, and carries metadata', () => {
    const data = buildReadingRunnerData(loadedTest());
    expect(data.testId).toBe('sample-01');
    expect(data.kind).toBe('practice');
    expect(data.isDraft).toBe(true);
    expect(data.durationSec).toBe(3600);
    expect(data.passages.map((p) => p.passage)).toEqual([1, 2]);
    expect(data.passages[0].paragraphs).toEqual([{ label: 'A', text: 'One.' }]);
  });
});
