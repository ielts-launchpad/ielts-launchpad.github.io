/**
 * Typed, sync-ready repository over the Dexie tables (SPEC §5, §6). Every write
 * is an idempotent upsert so the runner can autosave on each change without
 * worrying about create-vs-update. Browser-only; inject a {@link RunnerDatabase}
 * in tests (with fake-indexeddb) to exercise the CRUD paths.
 */
import { getDb, RunnerDatabase } from './db';
import type {
  AnswerRecord,
  AttemptRecord,
  HighlightRecord,
  ResultRecord,
  SettingRecord,
} from './db';
import type { AnswerMap } from '../../engine/runner/types';
import type { UserResponse } from '../../engine/grading/grade';
import { backupSchema, mergeBackupData, normalizeStoredBackup, prepareBackupExport, type BackupData, type BackupExportReport } from '../../engine/data/backup';

export class RunnerRepository {
  constructor(private readonly db: RunnerDatabase = getDb()) {}

  // --- attempts ------------------------------------------------------------

  async createAttempt(attempt: AttemptRecord): Promise<AttemptRecord> {
    await this.db.attempts.put(attempt);
    await this.db.answers.put({ attemptId: attempt.id, answers: {}, updatedAt: attempt.updatedAt });
    return attempt;
  }

  getAttempt(id: string): Promise<AttemptRecord | undefined> {
    return this.db.attempts.get(id);
  }

  /** Most recent in-progress attempt for a test + skill, for resume (SPEC §5). */
  async latestInProgress(
    testId: string,
    skill: AttemptRecord['skill'],
  ): Promise<AttemptRecord | undefined> {
    const matches = await this.db.attempts
      .where('testId')
      .equals(testId)
      .filter((a) => a.skill === skill && a.status === 'in-progress')
      .toArray();
    return matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }

  async updateAttempt(id: string, patch: Partial<AttemptRecord>): Promise<void> {
    await this.db.attempts.update(id, { ...patch, id, updatedAt: Date.now() });
  }

  // --- answers -------------------------------------------------------------

  async getAnswers(attemptId: string): Promise<AnswerMap> {
    const record = await this.db.answers.get(attemptId);
    return record?.answers ?? {};
  }

  /** Upsert a single question's response (autosave on every change). */
  async upsertAnswer(
    attemptId: string,
    questionId: string,
    response: UserResponse,
  ): Promise<AnswerMap> {
    return this.db.transaction('rw', this.db.answers, this.db.attempts, async () => {
      const record: AnswerRecord = (await this.db.answers.get(attemptId)) ?? {
        attemptId,
        answers: {},
        updatedAt: Date.now(),
      };
      const answers: AnswerMap = { ...record.answers, [questionId]: response };
      await this.db.answers.put({ attemptId, answers, updatedAt: Date.now() });
      await this.touchAttempt(attemptId);
      return answers;
    });
  }

  // --- results -------------------------------------------------------------

  async saveResult(result: ResultRecord): Promise<void> {
    await this.db.results.put(result);
  }

  /** Publish the review snapshot and close the attempt in the same transaction. */
  async completeAttempt(result: ResultRecord): Promise<void> {
    await this.db.transaction('rw', this.db.results, this.db.attempts, async () => {
      await this.db.results.put(result);
      await this.db.attempts.update(result.attemptId, {
        status: 'submitted', submittedAt: result.createdAt, updatedAt: result.createdAt,
      });
    });
  }

  getResult(attemptId: string): Promise<ResultRecord | undefined> {
    return this.db.results.get(attemptId);
  }

  listResults(): Promise<ResultRecord[]> {
    return this.db.results.toArray();
  }

  // --- highlights & notes --------------------------------------------------

  async addHighlight(highlight: HighlightRecord): Promise<void> {
    await this.db.highlights.put(highlight);
    await this.touchAttempt(highlight.attemptId);
  }

  async updateHighlight(id: string, patch: Partial<HighlightRecord>): Promise<void> {
    await this.db.highlights.update(id, { ...patch, id });
  }

  async removeHighlight(id: string): Promise<void> {
    await this.db.highlights.delete(id);
  }

  getHighlights(attemptId: string): Promise<HighlightRecord[]> {
    return this.db.highlights.where('attemptId').equals(attemptId).toArray();
  }

  // --- settings ------------------------------------------------------------

  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const record = await this.db.settings.get(key);
    return record ? (record.value as T) : fallback;
  }

  async setSetting(key: string, value: unknown): Promise<void> {
    const record: SettingRecord = { key, value };
    await this.db.settings.put(record);
  }

  // --- data management -----------------------------------------------------

  /** Compatibility API: the file contains every valid record and the skipped count. */
  async exportData(): Promise<BackupData> {
    return (await this.exportDataWithReport()).data;
  }

  /** One read-only transaction gives all five tables a consistent salvage snapshot. */
  exportDataWithReport(): Promise<BackupExportReport> {
    return this.db.transaction('r', this.db.tables, async () => {
      return prepareBackupExport(await this.readData());
    });
  }

  /** Validate input, then validate the merged state before the first write. */
  async importData(input: unknown): Promise<void> {
    const incoming = backupSchema.parse(input);
    await this.db.transaction('rw', this.db.tables, async () => {
      mergeBackupData(normalizeStoredBackup(await this.readData()), incoming);
      await this.db.attempts.bulkPut(incoming.attempts);
      await this.db.answers.bulkPut(incoming.answers);
      await this.db.results.bulkPut(incoming.results);
      await this.db.highlights.bulkPut(incoming.highlights);
      await this.db.settings.bulkPut(incoming.settings);
    });
  }

  /** Clear records without closing/deleting the database or changing its schema. */
  async deleteAllData(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all([
        this.db.attempts.clear(), this.db.answers.clear(), this.db.results.clear(),
        this.db.highlights.clear(), this.db.settings.clear(),
      ]);
    });
  }

  // --- internal ------------------------------------------------------------

  private async readData() {
    const [attempts, answers, results, highlights, settings] = await Promise.all([
      this.db.attempts.toArray(), this.db.answers.toArray(), this.db.results.toArray(),
      this.db.highlights.toArray(), this.db.settings.toArray(),
    ]);
    return { version: 1, attempts, answers, results, highlights, settings };
  }

  private async touchAttempt(attemptId: string): Promise<void> {
    await this.db.attempts.update(attemptId, { updatedAt: Date.now() });
  }
}
