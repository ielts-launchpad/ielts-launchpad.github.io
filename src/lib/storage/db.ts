/**
 * IndexedDB schema for attempts, answers, results and settings (SPEC §5, §6),
 * built on Dexie. Browser-only. The repository in `repository.ts` is the typed
 * entry point; this module just declares the tables and record shapes so a
 * future sync layer can map them 1:1.
 */
import Dexie, { type Table } from 'dexie';
import type { QuestionResult } from '../../engine/grading/grade';
import type { AnswerMap, RunnerMode } from '../../engine/runner/types';

export type AttemptSkill = 'reading' | 'listening';
export type AttemptStatus = 'in-progress' | 'submitted';

/** One test attempt and its resumable UI state (SPEC §5). */
export interface AttemptRecord {
  id: string;
  testId: string;
  skill: AttemptSkill;
  mode: RunnerMode;
  status: AttemptStatus;
  startedAt: number;
  updatedAt: number;
  submittedAt?: number;
  /** Epoch ms the countdown started from (exam mode), for resume. */
  timerStartedAt?: number;
  flagged: string[];
  fontScale: number;
}

/** All answers for an attempt, stored as one upsertable blob keyed by id. */
export interface AnswerRecord {
  attemptId: string;
  answers: AnswerMap;
  updatedAt: number;
}

/** A graded skill result snapshot for an attempt (SPEC §6). */
export interface ResultRecord {
  attemptId: string;
  testId: string;
  skill: AttemptSkill;
  raw: number;
  max: number;
  results: QuestionResult[];
  createdAt: number;
}

/** A passage highlight with an optional note (SPEC §5, M3.6). */
export interface HighlightRecord {
  id: string;
  attemptId: string;
  passage: number;
  paragraphIndex: number;
  start: number;
  end: number;
  quote: string;
  note: string;
  createdAt: number;
}

/** A key/value app setting, e.g. global font scale (SPEC §9). */
export interface SettingRecord {
  key: string;
  value: unknown;
}

/** The app database. One instance per tab; see {@link getDb}. */
export class RunnerDatabase extends Dexie {
  attempts!: Table<AttemptRecord, string>;
  answers!: Table<AnswerRecord, string>;
  results!: Table<ResultRecord, string>;
  highlights!: Table<HighlightRecord, string>;
  settings!: Table<SettingRecord, string>;

  constructor(name = 'ielts-launchpad') {
    super(name);
    this.version(1).stores({
      attempts: 'id, testId, status',
      answers: 'attemptId',
      results: 'attemptId, testId',
      highlights: 'id, attemptId',
      settings: 'key',
    });
  }
}

let singleton: RunnerDatabase | null = null;

/** Lazily create the shared database (never during SSR). */
export function getDb(): RunnerDatabase {
  if (!singleton) singleton = new RunnerDatabase();
  return singleton;
}
