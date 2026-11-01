import type { ListeningRunnerData } from '../../src/engine/runner/types';
import type { StandardQuestion } from '../../src/engine/content/schema';

/** Test-only four-part, forty-question mock using the original sample transcript/audio. */
export function mockListeningFixture(sample: ListeningRunnerData): ListeningRunnerData {
  const source = sample.parts[0];
  const questions = source.groups.flatMap((group) => group.questions.map((question) => ({ group, question })));
  return {
    ...sample, testId: 'mock-listening-fixture', kind: 'mock', isDraft: true,
    parts: Array.from({ length: 4 }, (_, partIndex) => ({
      ...source, part: partIndex + 1,
      groups: Array.from({ length: 10 }, (_, index) => {
        const sourceQuestion = questions[index % questions.length];
        const number = partIndex * 10 + index + 1;
        const question = structuredClone(sourceQuestion.question) as StandardQuestion;
        return { ...structuredClone(sourceQuestion.group), id: `mock-g${number}`, template: undefined,
          questions: [{ ...question, id: `mock-q${number}`, number }] };
      }),
    })),
  };
}