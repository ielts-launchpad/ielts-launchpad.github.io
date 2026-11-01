import type { ReadingRunnerData } from '../../src/engine/runner/types';

/** Test-only mock runner metadata; reuses sample-01, not production mock content. */
export function mockRunnerFixture(sample: ReadingRunnerData): ReadingRunnerData {
  return { ...sample, testId: 'mock-fixture', kind: 'mock', isDraft: true };
}