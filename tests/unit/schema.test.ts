import { describe, expect, it } from 'vitest';
import {
  metaSchema,
  questionGroupSchema,
  qtypeSchema,
  standardQuestionSchema,
} from '../../src/engine/content/schema';

const validMeta = {
  id: 'sample-01',
  exam: 'ielts',
  variant: 'academic',
  kind: 'practice',
  title: 'Sample',
  status: 'draft',
  skills: ['reading'],
  license: 'CC-BY-SA-4.0',
  version: 1,
};

const validGroup = {
  id: 'g1',
  instructions: 'Choose the correct letter.',
  interaction: 'single',
  qtype: 'multiple-choice',
  options: { A: 'first', B: 'second' },
  questions: [
    {
      id: 'q1',
      number: 1,
      prompt: 'Pick one',
      answers: ['A'],
      evidence: { quote: 'the bees are busy' },
    },
  ],
};

describe('metaSchema', () => {
  it('accepts valid metadata', () => {
    expect(metaSchema.safeParse(validMeta).success).toBe(true);
  });

  it('rejects metadata missing a status', () => {
    const { status, ...withoutStatus } = validMeta;
    void status;
    expect(metaSchema.safeParse(withoutStatus).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(metaSchema.safeParse({ ...validMeta, extra: true }).success).toBe(false);
  });
});

describe('qtypeSchema', () => {
  it('rejects an unknown question type', () => {
    expect(qtypeSchema.safeParse('not-a-real-qtype').success).toBe(false);
  });
});

describe('questionGroupSchema', () => {
  it('accepts a well-formed option group', () => {
    expect(questionGroupSchema.safeParse(validGroup).success).toBe(true);
  });

  it('rejects an option interaction with no options', () => {
    const { options, ...noOptions } = validGroup;
    void options;
    expect(questionGroupSchema.safeParse(noOptions).success).toBe(false);
  });

  it('rejects a gap interaction with no wordLimit', () => {
    const group = {
      id: 'g2',
      instructions: 'Complete the gaps.',
      interaction: 'gap',
      qtype: 'short-answer',
      questions: [{ id: 'q1', number: 1, answers: ['river'], evidence: { quote: 'the river' } }],
    };
    expect(questionGroupSchema.safeParse(group).success).toBe(false);
  });

  it('rejects allowReuse on a single interaction', () => {
    expect(questionGroupSchema.safeParse({ ...validGroup, allowReuse: true }).success).toBe(false);
  });
});

describe('standardQuestionSchema', () => {
  it('rejects a question missing evidence', () => {
    const question = { id: 'q1', number: 1, answers: ['A'] };
    expect(standardQuestionSchema.safeParse(question).success).toBe(false);
  });
});
