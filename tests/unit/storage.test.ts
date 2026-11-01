import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { RunnerDatabase } from '../../src/lib/storage/db';
import type { AttemptRecord } from '../../src/lib/storage/db';
import { RunnerRepository } from '../../src/lib/storage/repository';

function freshRepo(): RunnerRepository {
  const db = new RunnerDatabase(`test-${Math.random().toString(36).slice(2)}`);
  return new RunnerRepository(db);
}

function attempt(overrides: Partial<AttemptRecord> = {}): AttemptRecord {
  const now = Date.now();
  return {
    id: 'a1',
    testId: 'sample-01',
    skill: 'reading',
    mode: 'exam',
    status: 'in-progress',
    startedAt: now,
    updatedAt: now,
    flagged: [],
    fontScale: 1,
    ...overrides,
  };
}

describe('RunnerRepository — attempts', () => {
  let repo: RunnerRepository;
  beforeEach(() => {
    repo = freshRepo();
  });

  it('creates and reads an attempt with an empty answer blob', async () => {
    await repo.createAttempt(attempt());
    expect((await repo.getAttempt('a1'))?.testId).toBe('sample-01');
    expect(await repo.getAnswers('a1')).toEqual({});
  });

  it('resumes the most recent in-progress attempt for a test + skill', async () => {
    await repo.createAttempt(attempt({ id: 'old', updatedAt: 1 }));
    await repo.createAttempt(attempt({ id: 'new', updatedAt: 2 }));
    await repo.createAttempt(attempt({ id: 'done', status: 'submitted', updatedAt: 3 }));
    expect((await repo.latestInProgress('sample-01', 'reading'))?.id).toBe('new');
  });

  it('patches an attempt (flag, font scale, submit)', async () => {
    await repo.createAttempt(attempt());
    await repo.updateAttempt('a1', { flagged: ['q1'], fontScale: 1.25, status: 'submitted' });
    const updated = await repo.getAttempt('a1');
    expect(updated?.flagged).toEqual(['q1']);
    expect(updated?.fontScale).toBe(1.25);
    expect(updated?.status).toBe('submitted');
  });
});

describe('RunnerRepository — answers (autosave upsert)', () => {
  it('upserts answers one at a time without clobbering others', async () => {
    const repo = freshRepo();
    await repo.createAttempt(attempt());
    await repo.upsertAnswer('a1', 'q1', 'A');
    await repo.upsertAnswer('a1', 'q2', ['B', 'D']);
    await repo.upsertAnswer('a1', 'q1', 'C');
    expect(await repo.getAnswers('a1')).toEqual({ q1: 'C', q2: ['B', 'D'] });
  });
});

describe('RunnerRepository — results', () => {
  it('saves and reads a graded result snapshot', async () => {
    const repo = freshRepo();
    await repo.saveResult({
      attemptId: 'a1',
      testId: 'sample-01',
      skill: 'reading',
      raw: 38,
      max: 40,
      results: [],
      createdAt: Date.now(),
    });
    expect((await repo.getResult('a1'))?.raw).toBe(38);
  });
});

describe('RunnerRepository — highlights & settings', () => {
  it('adds, updates and removes a highlight', async () => {
    const repo = freshRepo();
    await repo.createAttempt(attempt());
    await repo.addHighlight({
      id: 'h1',
      attemptId: 'a1',
      passage: 1,
      paragraphIndex: 0,
      start: 0,
      end: 5,
      quote: 'Urban',
      note: '',
      createdAt: Date.now(),
    });
    await repo.updateHighlight('h1', { note: 'key idea' });
    expect((await repo.getHighlights('a1'))[0].note).toBe('key idea');
    await repo.removeHighlight('h1');
    expect(await repo.getHighlights('a1')).toEqual([]);
  });

  it('round-trips a setting with a fallback', async () => {
    const repo = freshRepo();
    expect(await repo.getSetting('fontScale', 1)).toBe(1);
    await repo.setSetting('fontScale', 1.5);
    expect(await repo.getSetting('fontScale', 1)).toBe(1.5);
  });
});
