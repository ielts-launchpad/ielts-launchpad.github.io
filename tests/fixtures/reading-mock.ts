import type { ReadingRunnerData } from '../../src/engine/runner/types';
import { isMultiQuestion } from '../../src/engine/content/schema';

/** Test-only three-passage, forty-question mock; not production mock content. */
export function mockRunnerFixture(sample: ReadingRunnerData): ReadingRunnerData {
  const source = sample.passages[0];
  const pool = source.groups.filter((group) => group.interaction === 'gap' && !group.image)
    .flatMap((group) => group.questions.flatMap((question) => isMultiQuestion(question) ? [] : [{ group, question }]));
  if (pool.length === 0) throw new Error('Reading mock fixture needs sample gap questions');
  let number = 0;
  return {
    ...sample, testId: 'mock-fixture', kind: 'mock', isDraft: true,
    passages: [14, 13, 13].map((count, index) => ({
      ...structuredClone(source), passage: index + 1,
      groups: Array.from({ length: count }, () => {
        const item = pool[number % pool.length];
        number += 1;
        return { ...structuredClone(item.group), id: `mock-reading-g${number}`, template: undefined,
          questions: [{ ...structuredClone(item.question), id: `mock-reading-q${number}`, number }] };
      }),
    })),
  };
}