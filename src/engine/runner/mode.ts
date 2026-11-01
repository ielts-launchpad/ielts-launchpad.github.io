import type { RunnerMode } from './types';

export function resolveRunnerMode(kind: 'mock' | 'practice', search: string): RunnerMode {
  if (kind === 'mock') return 'exam';
  return new URLSearchParams(search).get('mode') === 'exam' ? 'exam' : 'practice';
}