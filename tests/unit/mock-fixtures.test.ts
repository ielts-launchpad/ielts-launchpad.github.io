import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadAllTests } from '../../src/engine/content/loader';
import { buildListeningRunnerData, buildReadingRunnerData } from '../../src/engine/content/runner-data';
import { isMultiQuestion } from '../../src/engine/content/schema';
import { gradeQuestion } from '../../src/engine/grading/grade';
import { expandOptionalWords } from '../../src/engine/text/words';
import { mockListeningFixture } from '../fixtures/listening-mock';
import { mockRunnerFixture } from '../fixtures/reading-mock';

const sample = loadAllTests({
  contentDir: join(process.cwd(), 'content'), publicDir: join(process.cwd(), 'public'), includeDrafts: true,
}).find((content) => content.meta.id === 'sample-01');
if (!sample) throw new Error('sample-01 fixture missing');

describe('full-section mock fixtures', () => {
  it.each(['reading', 'listening'] as const)('%s has unique numbers 1–40 and a perfect sheet scores 40/40', (skill) => {
    const sections = skill === 'reading'
      ? mockRunnerFixture(buildReadingRunnerData(sample)).passages
      : mockListeningFixture(buildListeningRunnerData(sample)).parts;
    expect(sections).toHaveLength(skill === 'reading' ? 3 : 4);
    const groups = sections.flatMap((section) => section.groups);
    const numbers = groups.flatMap((group) => group.questions.flatMap((question) =>
      isMultiQuestion(question) ? question.numbers : [question.number]));
    expect(numbers).toEqual(Array.from({ length: 40 }, (_, index) => index + 1));
    const questions = groups.flatMap((group) => group.questions);
    expect(new Set(questions.map((question) => question.id)).size).toBe(40);
    const grades = groups.flatMap((group) => group.questions.map((question) => gradeQuestion(group, question,
      group.interaction === 'multi' ? question.answers : expandOptionalWords(question.answers[0])[0])));
    expect(grades.reduce((sum, grade) => sum + grade.marks, 0)).toBe(40);
    expect(grades.reduce((sum, grade) => sum + grade.maxMarks, 0)).toBe(40);
  });

  it('does not mutate the draft sample', () => {
    const reading = buildReadingRunnerData(sample);
    const before = structuredClone(reading);
    const mock = mockRunnerFixture(reading);
    mock.passages[0].groups[0].questions[0].answers[0] = 'changed';
    expect(reading).toEqual(before);
  });
});