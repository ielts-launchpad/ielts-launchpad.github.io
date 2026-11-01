import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { initialListeningState, reviewRemaining, transitionListening } from '../../src/engine/runner/listening';
import { resolveRunnerMode } from '../../src/engine/runner/mode';
import { buildListeningRunnerData } from '../../src/engine/content/runner-data';
import { loadAllTests } from '../../src/engine/content/loader';
import { mockListeningFixture } from '../fixtures/listening-mock';

describe('listening state machine', () => {
  it('locks mocks to exam, while practice alone accepts the query override', () => {
    expect(resolveRunnerMode('mock', '?mode=practice')).toBe('exam');
    expect(resolveRunnerMode('mock', '?mode=exam')).toBe('exam');
    expect(resolveRunnerMode('practice', '')).toBe('practice');
    expect(resolveRunnerMode('practice', '?mode=exam')).toBe('exam');
    expect(resolveRunnerMode('practice', '?mode=invalid')).toBe('practice');
  });

  it('ignores pause, seek, replay/part changes in exam mode and advances four parts', () => {
    let state = transitionListening(initialListeningState(), { type: 'play' }, 'exam', 4, 0);
    expect(transitionListening(state, { type: 'pause' }, 'exam', 4, 0)).toBe(state);
    expect(transitionListening(state, { type: 'seek', position: 20 }, 'exam', 4, 0)).toBe(state);
    expect(transitionListening(state, { type: 'part', index: 3 }, 'exam', 4, 0)).toBe(state);
    for (let index = 1; index <= 3; index++) {
      state = transitionListening(state, { type: 'ended' }, 'exam', 4, index * 1000);
      expect(state).toMatchObject({ phase: 'playing', partIndex: index, position: 0 });
    }
    state = transitionListening(state, { type: 'ended' }, 'exam', 4, 4000);
    expect(state).toMatchObject({ phase: 'review', reviewStartedAt: 4000 });
    expect(reviewRemaining(state, 4000)).toBe(120);
    expect(reviewRemaining(state, 123000)).toBe(1);
    expect(transitionListening(state, { type: 'tick' }, 'exam', 4, 123000)).toBe(state);
    const submitted = transitionListening(state, { type: 'tick' }, 'exam', 4, 124000);
    expect(submitted.phase).toBe('submitted');
    expect(transitionListening(submitted, { type: 'play' }, 'exam', 4, 125000)).toBe(submitted);
    expect(transitionListening(state, { type: 'play' }, 'exam', 4, 4000)).toBe(state);
  });

  it('allows pause/seek/part selection and replay in practice without an automatic review', () => {
    let state = transitionListening(initialListeningState(), { type: 'play' }, 'practice', 2, 0);
    state = transitionListening(state, { type: 'seek', position: 12 }, 'practice', 2, 0);
    expect(state.position).toBe(12);
    state = transitionListening(state, { type: 'pause' }, 'practice', 2, 0);
    expect(state.phase).toBe('ready');
    state = transitionListening(state, { type: 'part', index: 1 }, 'practice', 2, 0);
    expect(state.partIndex).toBe(1);
    expect(transitionListening(state, { type: 'part', index: 2 }, 'practice', 2, 0)).toBe(state);
    state = transitionListening(state, { type: 'ended' }, 'practice', 2, 0);
    expect(state.phase).toBe('ready');
    expect(transitionListening(state, { type: 'play' }, 'practice', 2, 0).phase).toBe('playing');
  });
});

it('builds listening data and a test-only 4 × 10 mock from sample-01', () => {
  const sample = loadAllTests({ contentDir: join(process.cwd(), 'content'), publicDir: join(process.cwd(), 'public'), includeDrafts: true })
    .find((test) => test.meta.id === 'sample-01');
  expect(sample).toBeDefined();
  const data = buildListeningRunnerData(sample!);
  expect(data.parts).toHaveLength(1);
  expect(data.parts[0].transcript).toContain('main entrance');
  const mock = mockListeningFixture(data);
  expect(mock.kind).toBe('mock');
  expect(mock.parts.map((part) => part.groups.flatMap((group) => group.questions).length)).toEqual([10, 10, 10, 10]);
  expect(mock.parts.flatMap((part) => part.groups.flatMap((group) => group.questions.map((question) => 'number' in question ? question.number : 0))))
    .toEqual(Array.from({ length: 40 }, (_, index) => index + 1));
});