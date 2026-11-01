import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backupSchema, prepareBackupExport, type BackupData, type StoredBackupTables } from '../../src/engine/data/backup';
import { gradeQuestion } from '../../src/engine/grading/grade';
import { RunnerDatabase } from '../../src/lib/storage/db';
import { RunnerRepository } from '../../src/lib/storage/repository';

const databases: RunnerDatabase[] = [];
function fresh() {
  const db = new RunnerDatabase(`backup-${crypto.randomUUID()}`);
  databases.push(db);
  return { db, repo: new RunnerRepository(db) };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(databases.splice(0).map((db) => db.delete()));
});

function empty(): BackupData {
  return { version: 1, skipped: 0, attempts: [], answers: [], results: [], highlights: [], settings: [] };
}

function sample(id = 'a1', text = 'gate'): BackupData {
  return {
    version: 1,
    skipped: 0,
    attempts: [{
      id, testId: 'sample-01', skill: 'listening', mode: 'practice', status: 'submitted',
      startedAt: 100, updatedAt: 200, submittedAt: 200, timerStartedAt: 100,
      flagged: ['q1'], fontScale: 1.25,
      listening: { phase: 'submitted', partIndex: 0, position: 12.5, reviewStartedAt: 150 },
    }],
    answers: [{ attemptId: id, answers: { q1: text, choice: ['A', 'C'], blank: null }, updatedAt: 200 }],
    results: [{
      attemptId: id, testId: 'sample-01', skill: 'listening', raw: 1, max: 1, createdAt: 200,
      results: [{ questionId: 'q1', numbers: [1], marks: 1, maxMarks: 1, correct: true, errorClass: null }],
      review: {
        variant: 'academic', kind: 'practice', answers: { q1: 'gate' },
        sections: [{
          number: 1, title: 'A visit', text: '[00:12.5] GUIDE: Meet at the gate.',
          audio: '/audio/academic/sample-01/part-1.opus',
          groups: [{
            id: 'g1', instructions: 'Write one word.', interaction: 'gap', qtype: 'note-completion',
            wordLimit: { words: 1, numberAllowed: false }, template: 'Meet at {{1}}',
            questions: [{
              id: 'q1', number: 1, answers: ['gate'], evidence: { quote: 'gate', audioStart: 12.5 },
              explanation: 'The meeting place is stated directly.',
            }],
          }],
        }],
      },
    }],
    highlights: [{
      id: `h-${id}`, attemptId: id, passage: 1, paragraphIndex: 0, start: 0, end: 4,
      quote: 'Meet', note: 'Remember the meeting place.', createdAt: 150,
    }],
    settings: [
      { key: 'fontScale', value: 1.25 },
      { key: 'future-planner', value: { enabled: true, sessions: [null, 'reading', 2.5], nested: { done: false } } },
    ],
  };
}

describe('versioned data backups', () => {
  const corruptSettings: [string, unknown][] = [
    ['undefined', undefined], ['nested undefined', { nested: undefined }],
    ['undefined array item', [undefined]], ['NaN', { nested: NaN }], ['Infinity', [Infinity]],
  ];
  it.each(corruptSettings)('skips a stored %s setting on export but strictly rejects it on import', async (_label, value) => {
    const { db, repo } = fresh();
    await repo.importData(sample());
    await repo.setSetting('corrupt-setting', value);
    const write = vi.spyOn(db.attempts, 'bulkPut');
    const report = await repo.exportDataWithReport();
    expect(report).toEqual({ data: { ...sample(), skipped: 1 }, skippedRecords: [{ table: 'settings', id: 'corrupt-setting' }] });
    expect(await repo.exportData()).toEqual(report.data);
    await expect(repo.importData(empty())).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
    expect(await repo.getSetting('corrupt-setting', null)).toEqual(value);
  });

  it('exports real IndexedDB optional undefined fields as omitted JSON properties and can merge again', async () => {
    const { db, repo } = fresh();
    const data = sample();
    data.attempts[0].timerStartedAt = undefined;
    const section = data.results[0].review?.sections[0];
    if (!section) throw new Error('Review fixture missing');
    section.audio = undefined;
    await db.attempts.bulkPut(data.attempts);
    await db.answers.bulkPut(data.answers);
    await db.results.bulkPut(data.results);
    await db.highlights.bulkPut(data.highlights);
    await db.settings.bulkPut(data.settings);
    const exported = await repo.exportData();
    expect(exported.attempts[0]).not.toHaveProperty('timerStartedAt');
    expect(exported.results[0].review?.sections[0]).not.toHaveProperty('audio');
    await repo.importData(empty());
    expect(await repo.exportData()).toEqual(exported);
  });

  it('exports/imports all five tables, immutable review/audio/notes and generic JSON settings', async () => {
    const source = fresh();
    const target = fresh();
    const data = sample();
    await source.repo.importData(data);
    const exported = await source.repo.exportData();
    expect(exported).toEqual(data);
    expect(backupSchema.parse(JSON.parse(JSON.stringify(exported)))).toEqual(data);
    await target.repo.importData(JSON.parse(JSON.stringify(exported)));
    expect(await target.repo.exportData()).toEqual(exported);
    expect(await target.repo.listResults()).toEqual(data.results);
    // Live answers can differ from the immutable result snapshot.
    expect((await target.repo.getResult('a1'))?.review?.answers).toEqual({ q1: 'gate' });
  });

  it('upserts incoming primary IDs in every table while retaining unrelated records', async () => {
    const { repo } = fresh();
    await repo.importData(sample());
    await repo.importData(sample('unrelated'));
    await repo.setSetting('unrelated-setting', { retain: true });
    const incoming = sample('a1', 'changed live answer');
    incoming.attempts[0].fontScale = 1.5;
    incoming.highlights[0].note = 'Replacement note';
    incoming.settings[0].value = 1.5;
    incoming.results[0].createdAt = 300;
    await repo.importData(incoming);
    const exported = await repo.exportData();
    expect(exported.attempts).toHaveLength(2);
    expect(exported.answers).toHaveLength(2);
    expect(exported.results).toHaveLength(2);
    expect(exported.highlights).toHaveLength(2);
    expect(exported.settings).toHaveLength(3);
    expect(exported.attempts.find((record) => record.id === 'a1')).toEqual(incoming.attempts[0]);
    expect(exported.answers.find((record) => record.attemptId === 'a1')).toEqual(incoming.answers[0]);
    expect(await repo.getResult('a1')).toEqual(incoming.results[0]);
    expect(await repo.getHighlights('a1')).toEqual(incoming.highlights);
    expect(await repo.getSetting('fontScale', 1)).toBe(1.5);
    expect(await repo.getSetting('unrelated-setting', null)).toEqual({ retain: true });
    expect(await repo.getAnswers('unrelated')).toEqual(sample('unrelated').answers[0].answers);
  });

  it('preserves valid legacy results without a review snapshot', async () => {
    const { repo } = fresh();
    const data = sample();
    delete data.results[0].review;
    await repo.importData(data);
    expect(await repo.exportData()).toEqual(data);
    expect((await repo.listResults())[0]).not.toHaveProperty('review');
  });

  it('allows imported children to refer to existing attempts', async () => {
    const { repo } = fresh();
    const data = sample();
    await repo.createAttempt(data.attempts[0]);
    data.attempts = [];
    await repo.importData(data);
    expect(await repo.getResult('a1')).toEqual(data.results[0]);
    expect(await repo.getHighlights('a1')).toEqual(data.highlights);
  });

  const invalidCases: [string, (data: BackupData) => unknown][] = [
    ['unknown version', (data) => ({ ...data, version: 2 })],
    ['missing table', (data) => ({ ...data, settings: undefined })],
    ['unknown field', (data) => ({ ...data, extra: true })],
    ['invalid record shape', (data) => ({ ...data, attempts: [{ id: 'a1' }] })],
    ['unsupported skill', (data) => ({ ...data, attempts: [{ ...data.attempts[0], skill: 'writing' }] })],
    ['blank ID', (data) => ({ ...data, settings: [{ key: ' ', value: null }] })],
    ['unsafe timestamp', (data) => { data.attempts[0].updatedAt = Number.MAX_SAFE_INTEGER + 1; return data; }],
    ['nonfinite position', (data) => { data.attempts[0].listening = { phase: 'ready', partIndex: 0, position: Infinity, reviewStartedAt: null }; return data; }],
    ['negative marks', (data) => { data.results[0].raw = -1; return data; }],
    ['inconsistent totals', (data) => { data.results[0].max = 2; return data; }],
    ['invalid historical classification type', (data) => ({ ...data, results: [{ ...data.results[0], results: [{ ...data.results[0].results[0], correct: 'false' }] }] })],
    ['invalid historical error enum', (data) => ({ ...data, results: [{ ...data.results[0], results: [{ ...data.results[0].results[0], errorClass: 'obsolete-unknown' }] }] })],
    ['duplicate question numbers', (data) => { data.results[0].results[0].numbers = [1, 1]; return data; }],
    ['duplicate question IDs', (data) => { data.results[0].results.push({ ...data.results[0].results[0], numbers: [2] }); data.results[0].raw = 2; data.results[0].max = 2; return data; }],
    ['blank review group ID', (data) => { const group = data.results[0].review?.sections[0].groups[0]; if (group) group.id = ' '; return data; }],
    ['unknown review answer ID', (data) => { if (data.results[0].review) data.results[0].review.answers.unknown = 'private'; return data; }],
    ['duplicate review numbers', (data) => {
      const group = data.results[0].review?.sections[0].groups[0];
      if (group) group.questions.push({ ...group.questions[0], id: 'q2' });
      data.results[0].results.push({ ...data.results[0].results[0], questionId: 'q2', numbers: [2] });
      data.results[0].raw = 2; data.results[0].max = 2;
      return data;
    }],
    ['missing snapshot question', (data) => { if (data.results[0].review) data.results[0].review.sections = []; return data; }],
    ['duplicate snapshot section', (data) => { if (data.results[0].review) data.results[0].review.sections.push(data.results[0].review.sections[0]); return data; }],
    ['unsafe nested evidence', (data) => { const question = data.results[0].review?.sections[0].groups[0].questions[0]; if (question?.evidence) question.evidence.audioStart = Number.MAX_SAFE_INTEGER + 1; return data; }],
    ['invalid highlight offsets', (data) => { data.highlights[0].end = 0; return data; }],
    ['non-JSON setting', (data) => ({ ...data, settings: [{ key: 'future', value: new Date() }] })],
    ['undefined setting', (data) => ({ ...data, settings: [{ key: 'future', value: undefined }] })],
    ['NaN setting', (data) => ({ ...data, settings: [{ key: 'future', value: { nested: NaN } }] })],
    ['unsafe setting number', (data) => ({ ...data, settings: [{ key: 'future', value: Number.MAX_SAFE_INTEGER + 1 }] })],
    ['cyclic setting', (data) => { const value: Record<string, unknown> = {}; value.self = value; return { ...data, settings: [{ key: 'future', value }] }; }],
    ['orphan answers', (data) => { data.answers[0].attemptId = 'missing'; return data; }],
    ['orphan results', (data) => { data.results[0].attemptId = 'missing'; return data; }],
    ['orphan highlights', (data) => { data.highlights[0].attemptId = 'missing'; return data; }],
    ['inconsistent result test', (data) => { data.results[0].testId = 'other-test'; return data; }],
    ['inconsistent result skill', (data) => { data.results[0].skill = 'reading'; return data; }],
  ];

  it.each([0, 1])('preserves historical marks %i even when current grading disagrees through export/import/re-export', async (marks) => {
    const source = fresh();
    const target = fresh();
    const data = sample();
    const result = data.results[0];
    const review = result.review;
    if (!review) throw new Error('Missing review fixture');
    review.answers.q1 = marks === 0 ? 'gate' : 'wrong';
    result.raw = marks;
    result.results[0] = { ...result.results[0], marks, correct: marks === 1, errorClass: marks === 1 ? null : 'wrong' };
    const group = review.sections[0].groups[0];
    const current = gradeQuestion(group, group.questions[0], review.answers.q1);
    expect(current.marks).toBe(1 - marks);
    expect(current.errorClass).not.toBe(result.results[0].errorClass);
    expect(backupSchema.parse(data)).toEqual(data);
    // Seed raw saved history, not a value regenerated by the validator.
    await source.db.attempts.bulkPut(data.attempts);
    await source.db.answers.bulkPut(data.answers);
    await source.db.results.bulkPut(data.results);
    await source.db.highlights.bulkPut(data.highlights);
    await source.db.settings.bulkPut(data.settings);
    const exported = await source.repo.exportData();
    expect(exported).toEqual(data);
    await target.repo.importData(JSON.parse(JSON.stringify(exported)));
    expect(await target.repo.getResult('a1')).toEqual(result);
    expect(await target.repo.exportData()).toEqual(exported);
  });

  it('treats correct and errorClass as typed historical fields, not derived rules', () => {
    const data = sample();
    data.results[0].results[0].correct = false;
    data.results[0].results[0].errorClass = 'blank';
    expect(backupSchema.parse(data)).toEqual(data);
  });

  it('preserves historic mark weights rather than assuming the current one-mark grading rule', async () => {
    const source = fresh();
    const target = fresh();
    const data = sample();
    const result = data.results[0];
    const group = result.review?.sections[0].groups[0];
    if (!group) throw new Error('Missing group fixture');
    expect(gradeQuestion(group, group.questions[0], 'gate').maxMarks).toBe(1);
    result.raw = 2;
    result.max = 2;
    result.results[0].marks = 2;
    result.results[0].maxMarks = 2;
    await source.repo.importData(data);
    const exported = await source.repo.exportData();
    expect(exported).toEqual(data);
    await target.repo.importData(exported);
    expect(await target.repo.exportData()).toEqual(data);
  });

  it('preserves structural historic content that fails current group semantics', async () => {
    const { repo } = fresh();
    const data = sample();
    const group = data.results[0].review?.sections[0].groups[0];
    if (!group) throw new Error('Missing group fixture');
    group.interaction = 'single';
    group.options = { A: 'Historic option' }; // Saved accepted answer is no longer an option.
    group.image = '/images/historic.svg'; // Old content did not require imageAlt.
    await repo.importData(data);
    expect(await repo.exportData()).toEqual(data);
  });

  it('does not trim historical snapshot text during a backup round trip', async () => {
    const { repo } = fresh();
    const data = sample();
    const group = data.results[0].review?.sections[0].groups[0];
    if (!group) throw new Error('Missing group fixture');
    group.imageAlt = '  Historic description  ';
    await repo.importData(data);
    expect(await repo.exportData()).toEqual(data);
  });

  it('accepts legacy envelopes without skipped and nonnegative integer counts', () => {
    const legacy: Record<string, unknown> = { ...sample() };
    delete legacy.skipped;
    expect(backupSchema.parse(legacy)).toEqual(sample());
    expect(backupSchema.parse({ ...legacy, skipped: 7 }).skipped).toBe(7);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null, undefined])(
    'rejects malformed explicit skipped count %s', (skipped) => {
      expect(backupSchema.safeParse({ ...sample(), skipped }).success).toBe(false);
    },
  );

  it.each(invalidCases)('rejects %s before writes, leaving every table unchanged', async (_name, mutate) => {
    const { db, repo } = fresh();
    await repo.importData(sample('retained'));
    const before = await repo.exportData();
    const write = vi.spyOn(db.attempts, 'bulkPut');
    await expect(repo.importData(mutate(sample()))).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
    expect(await repo.exportData()).toEqual(before);
  });

  it.each(['attempts', 'answers', 'results', 'highlights', 'settings'] as const)(
    'salvages valid %s records and deterministically counts duplicate IDs', (table) => {
      const data = sample();
      const report = prepareBackupExport({ ...data, [table]: [...data[table], data[table][0]] });
      expect(report.data).toEqual({ ...data, skipped: 1 });
      expect(report.skippedRecords).toEqual([{ table, id: table === 'settings' ? 'fontScale' : table === 'highlights' ? 'h-a1' : 'a1' }]);
    },
  );

  it('exports a valid empty envelope when every stored record is invalid', () => {
    const tables = { attempts: [null], answers: [{}], results: [{ attemptId: 'broken' }], highlights: [false], settings: [{ key: 'bad', value: NaN }] };
    const report = prepareBackupExport(tables);
    expect(report.data).toEqual({ ...empty(), skipped: 5 });
    expect(report.skippedRecords).toEqual([
      { table: 'attempts', id: null }, { table: 'answers', id: null }, { table: 'results', id: 'broken' },
      { table: 'highlights', id: null }, { table: 'settings', id: 'bad' },
    ]);
    expect(backupSchema.parse(JSON.parse(JSON.stringify(report.data)))).toEqual(report.data);
  });

  it('counts invalid parent and all dependent children while preserving unrelated records', () => {
    const data = sample();
    const unrelated = sample('unrelated');
    const tables: StoredBackupTables = {
      attempts: [{ ...data.attempts[0], updatedAt: NaN }, ...unrelated.attempts],
      answers: [...data.answers, ...unrelated.answers, { attemptId: 'orphan', answers: {}, updatedAt: 1 }],
      results: [...data.results, ...unrelated.results],
      highlights: [...data.highlights, ...unrelated.highlights],
      settings: unrelated.settings,
    };
    expect(prepareBackupExport(tables)).toEqual({
      data: { ...unrelated, skipped: 5 },
      skippedRecords: [
        { table: 'attempts', id: 'a1' }, { table: 'answers', id: 'a1' }, { table: 'answers', id: 'orphan' },
        { table: 'results', id: 'a1' }, { table: 'highlights', id: 'h-a1' },
      ],
    });
  });

  it.each([
    ['malformed result', { attemptId: 'a1' }],
    ['invalid totals', { ...sample().results[0], raw: 0 }],
    ['mismatched test', { ...sample().results[0], testId: 'other' }],
    ['mismatched skill', { ...sample().results[0], skill: 'reading' }],
    ['orphan result', { ...sample().results[0], attemptId: 'orphan' }],
  ])('only skips the %s, not its valid parent or siblings', (_label, result) => {
    const data = sample();
    const report = prepareBackupExport({ ...data, results: [result] });
    expect(report.data).toEqual({ ...data, results: [], skipped: 1 });
    expect(report.skippedRecords).toEqual([{ table: 'results', id: result.attemptId }]);
  });

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  const sparse: unknown[] = new Array(2);
  sparse[1] = 'private';
  const throwingGetter = vi.fn(() => { throw new Error('Private getter detail'); });
  const accessor = Object.defineProperty({}, 'secret', { enumerable: true, get: throwingGetter });
  const unsafeValues: [string, unknown][] = [
    ['NaN', NaN], ['Infinity', Infinity], ['unsafe number', Number.MAX_SAFE_INTEGER + 1],
    ['sparse array', sparse], ['cycle', cyclic], ['class', new Date()], ['accessor', accessor],
    ['undefined array item', [undefined]], ['nested undefined', { secret: undefined }],
    ['function', () => 'private'], ['symbol', Symbol('private')],
  ];
  it.each(unsafeValues)('skips one unsafe %s setting without leaking values or invoking accessors', (_label, value) => {
    const data = sample();
    const report = prepareBackupExport({ ...data, settings: [...data.settings, { key: 'unsafe-setting', value }] });
    expect(report).toEqual({ data: { ...data, skipped: 1 }, skippedRecords: [{ table: 'settings', id: 'unsafe-setting' }] });
    expect(throwingGetter).not.toHaveBeenCalled();
    expect(JSON.stringify(report)).not.toContain('private');
  });

  it('does not invoke a throwing primary-ID getter and reports a null identifier', () => {
    const getter = vi.fn(() => { throw new Error('Private ID error'); });
    const record = Object.defineProperty({}, 'id', { enumerable: true, get: getter });
    expect(prepareBackupExport({ ...empty(), attempts: [record] })).toEqual({
      data: { ...empty(), skipped: 1 }, skippedRecords: [{ table: 'attempts', id: null }],
    });
    expect(getter).not.toHaveBeenCalled();
  });

  it.each(['attempts', 'answers', 'results', 'highlights'] as const)(
    'skips unsafe nested %s values before JSON can normalize them', (table) => {
      const data = sample();
      const record = { ...data[table][0], privateExtra: [undefined] };
      const report = prepareBackupExport({ ...data, [table]: [record] });
      expect(report.skippedRecords.some((item) => item.table === table)).toBe(true);
      expect(report.data[table]).toEqual([]);
      expect(JSON.stringify(report)).not.toContain('privateExtra');
    },
  );

  it('invalid records do not reserve IDs before a later valid record is salvaged', () => {
    const data = sample();
    const report = prepareBackupExport({ ...data, attempts: [{ id: 'a1' }, ...data.attempts] });
    expect(report.data).toEqual({ ...data, skipped: 1 });
    expect(report.skippedRecords).toEqual([{ table: 'attempts', id: 'a1' }]);
  });

  it('salvage is read-only and its downloaded subset imports into a clean database', async () => {
    const source = fresh();
    const target = fresh();
    await source.repo.importData(sample());
    await source.repo.setSetting('bad-setting', { secret: NaN });
    await source.db.answers.put({ attemptId: 'orphan', answers: { secret: 'private answer' }, updatedAt: 1 });
    const before = await Promise.all(source.db.tables.map((table) => table.toArray()));
    const report = await source.repo.exportDataWithReport();
    expect(report.data).toEqual({ ...sample(), skipped: 2 });
    expect(report.skippedRecords).toEqual([{ table: 'answers', id: 'orphan' }, { table: 'settings', id: 'bad-setting' }]);
    expect(await Promise.all(source.db.tables.map((table) => table.toArray()))).toEqual(before);
    await target.repo.importData(JSON.parse(JSON.stringify(report.data)));
    expect(await target.repo.exportData()).toEqual(sample());
    expect(await target.db.settings.toArray()).toEqual(sample().settings);
    expect(await target.db.answers.toArray()).toEqual(sample().answers);
  });

  it('strict import validates retained raw records rather than substituting the salvaged export', async () => {
    const { db, repo } = fresh();
    await repo.importData(sample());
    await db.answers.put({ attemptId: 'a1', answers: { q1: undefined }, updatedAt: 200 } as unknown as Parameters<typeof db.answers.put>[0]);
    const write = vi.spyOn(db.attempts, 'bulkPut');
    expect((await repo.exportData()).answers).toEqual([]);
    await expect(repo.importData(sample('incoming'))).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
    expect(await repo.getAttempt('incoming')).toBeUndefined();
    expect(await db.answers.get('a1')).toEqual({ attemptId: 'a1', answers: { q1: undefined }, updatedAt: 200 });
  });

  it.each(['attempts', 'answers', 'results', 'highlights', 'settings'] as const)(
    'rejects duplicate primary IDs within %s rather than silently picking a winner', async (table) => {
      const { repo } = fresh();
      await repo.importData(sample('retained'));
      const before = await repo.exportData();
      const data = sample();
      const input = { ...data, [table]: [...data[table], data[table][0]] };
      await expect(repo.importData(input)).rejects.toThrow('Duplicate primary IDs');
      expect(await repo.exportData()).toEqual(before);
    },
  );

  it('validates incoming relationships against existing parents and retained children', async () => {
    const { db, repo } = fresh();
    await repo.importData(sample());
    const before = await repo.exportData();
    const incoming = empty();
    incoming.attempts = [{ ...sample().attempts[0], testId: 'changed-test' }];
    const write = vi.spyOn(db.attempts, 'bulkPut');
    await expect(repo.importData(incoming)).rejects.toThrow('Result must match');
    const child = empty();
    child.results = [{ ...sample().results[0], skill: 'reading' }];
    await expect(repo.importData(child)).rejects.toThrow('Result must match');
    expect(write).not.toHaveBeenCalled();
    expect(await repo.exportData()).toEqual(before);
  });

  it('rolls back all earlier table writes if a later write fails', async () => {
    const { db, repo } = fresh();
    await repo.importData(sample('retained'));
    const before = await repo.exportData();
    vi.spyOn(db.settings, 'bulkPut').mockRejectedValueOnce(new Error('Simulated write failure'));
    await expect(repo.importData(sample())).rejects.toThrow('Simulated write failure');
    expect(await repo.exportData()).toEqual(before);
  });

  it('exports a consistent snapshot while a competing transaction waits', async () => {
    const { db, repo } = fresh();
    await repo.importData(sample());
    const originalRead = db.attempts.toArray.bind(db.attempts);
    let writer: Promise<void> | undefined;
    vi.spyOn(db.attempts, 'toArray').mockImplementationOnce(() => originalRead().then((attempts) => {
      writer = Dexie.ignoreTransaction(() => repo.importData(sample('a1', 'new live answer')));
      return attempts;
    }));
    expect(await repo.exportData()).toEqual(sample());
    await writer;
    expect(await repo.getAnswers('a1')).toEqual(sample('a1', 'new live answer').answers[0].answers);
  });

  it('atomically clears every table, retains the database and supports subsequent use', async () => {
    const { db, repo } = fresh();
    await repo.importData(sample());
    vi.spyOn(db.settings, 'clear').mockRejectedValueOnce(new Error('Simulated clear failure'));
    await expect(repo.deleteAllData()).rejects.toThrow('Simulated clear failure');
    expect(await repo.exportData()).toEqual(sample());
    await repo.deleteAllData();
    expect(await repo.exportData()).toEqual(empty());
    expect(await Promise.all(db.tables.map((table) => table.count()))).toEqual([0, 0, 0, 0, 0]);
    expect(db.isOpen()).toBe(true);
    await repo.createAttempt(sample('reused').attempts[0]);
    await repo.upsertAnswer('reused', 'q1', 'gate');
    await repo.setSetting('fontScale', 1.5);
    expect(await repo.getAnswers('reused')).toEqual({ q1: 'gate' });
    await repo.importData(sample());
    expect((await repo.exportData()).attempts).toHaveLength(2);
  });
});