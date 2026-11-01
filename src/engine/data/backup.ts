/** Versioned, browser-independent validation for all current storage tables. */
import { z } from 'zod';
import { gradeQuestion } from '../grading/grade';
import { isMultiQuestion, questionGroupSchema } from '../content/schema';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
const safeNumber = z.number().finite().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);
const count = safeNumber.int().nonnegative();
const positiveCount = count.refine((value) => value > 0, 'Must be positive');
const timestamp = count;
const id = z.string().refine((value) => value.trim().length > 0, 'ID must not be blank');
const response = z.union([z.string(), z.array(z.string()), z.null()]);
const answers = z.record(id, response);
const jsonValue: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.null(), z.boolean(), safeNumber, z.string(), z.array(jsonValue), z.record(jsonValue),
]));

/** Reject cycles, class instances and values JSON would silently lose/change. */
function isJsonValue(value: unknown, ancestors = new Set<object>(), omitUndefinedProperties = false): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  if (typeof value !== 'object' || ancestors.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) return false;
  ancestors.add(value);
  const valid = Reflect.ownKeys(value).every((key) => {
    if (Array.isArray(value) && key === 'length') return true;
    if (typeof key !== 'string' || key === '__proto__') return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor?.enumerable === true && 'value' in descriptor &&
      ((omitUndefinedProperties && !Array.isArray(value) && descriptor.value === undefined) ||
        isJsonValue(descriptor.value, ancestors, omitUndefinedProperties));
  }) && (!Array.isArray(value) || Object.keys(value).length === value.length);
  ancestors.delete(value);
  return valid;
}

const attemptSchema = z.object({
  id, testId: id, skill: z.enum(['reading', 'listening']), mode: z.enum(['exam', 'practice']),
  status: z.enum(['in-progress', 'submitted']), startedAt: timestamp, updatedAt: timestamp,
  submittedAt: timestamp.optional(), timerStartedAt: timestamp.optional(),
  flagged: z.array(id), fontScale: safeNumber.refine((value) => value > 0, 'Must be positive'),
  listening: z.object({
    phase: z.enum(['ready', 'playing', 'review', 'submitted']), partIndex: count,
    position: safeNumber.nonnegative(), reviewStartedAt: timestamp.nullable(),
  }).strict().optional(),
}).strict().superRefine((attempt, ctx) => {
  if (attempt.skill !== 'listening' && attempt.listening) {
    ctx.addIssue({ code: 'custom', path: ['listening'], message: 'Listening state requires a listening attempt' });
  }
});

const questionResultSchema = z.object({
  questionId: id, numbers: z.array(positiveCount).min(1), marks: count, maxMarks: positiveCount,
  correct: z.boolean(), errorClass: z.enum(['blank', 'over-limit', 'plural', 'spelling', 'wrong']).nullable(),
}).strict().superRefine((result, ctx) => {
  if (result.marks > result.maxMarks || result.maxMarks !== result.numbers.length ||
      new Set(result.numbers).size !== result.numbers.length ||
      result.correct !== (result.marks === result.maxMarks) ||
      (result.errorClass === null) !== result.correct) {
    ctx.addIssue({ code: 'custom', message: 'Inconsistent question marks, numbers or classification' });
  }
});

const reviewSchema = z.object({
  answers, variant: z.enum(['academic', 'general']), kind: z.enum(['mock', 'practice']),
  sections: z.array(z.object({
    number: positiveCount, title: z.string(), text: z.string(),
    groups: z.array(questionGroupSchema), audio: z.string().min(1).optional(),
  }).strict()),
}).strict();

const resultSchema = z.object({
  attemptId: id, testId: id, skill: z.enum(['reading', 'listening']),
  raw: count, max: count, results: z.array(questionResultSchema), createdAt: timestamp,
  review: reviewSchema.optional(),
}).strict().superRefine((result, ctx) => {
  const fail = (message: string): void => ctx.addIssue({ code: 'custom', message });
  if (result.raw > result.max || result.raw !== result.results.reduce((sum, item) => sum + item.marks, 0) ||
      result.max !== result.results.reduce((sum, item) => sum + item.maxMarks, 0)) {
    fail('Result totals must match question marks');
  }
  const questionIds = result.results.map((item) => item.questionId);
  const numbers = result.results.flatMap((item) => item.numbers);
  if (new Set(questionIds).size !== questionIds.length || new Set(numbers).size !== numbers.length) {
    fail('Duplicate graded question IDs or numbers');
  }
  if (!result.review) return;
  const sectionNumbers = result.review.sections.map((section) => section.number);
  const groups = result.review.sections.flatMap((section) => section.groups);
  const groupIds = groups.map((group) => group.id);
  const questions = groups.flatMap((group) => group.questions);
  const snapshotIds = questions.map((question) => question.id);
  if (new Set(sectionNumbers).size !== sectionNumbers.length || new Set(groupIds).size !== groupIds.length ||
      new Set(snapshotIds).size !== snapshotIds.length || snapshotIds.length !== questionIds.length ||
      snapshotIds.some((questionId) => !questionIds.includes(questionId)) ||
      Object.keys(result.review.answers).some((questionId) => !snapshotIds.includes(questionId))) {
    fail('Review must identify each graded question exactly once');
  }
  const grades = new Map(result.results.map((item) => [item.questionId, item]));
  for (const group of groups) {
    for (const question of group.questions) {
      const expected = gradeQuestion(group, question, result.review.answers[question.id] ?? null);
      const actual = grades.get(question.id);
      if (!actual || expected.marks !== actual.marks || expected.maxMarks !== actual.maxMarks ||
          expected.errorClass !== actual.errorClass ||
          expected.numbers.join(',') !== actual.numbers.join(',')) {
        fail('Review answers and question definitions must match saved grading');
      }
      if (isMultiQuestion(question) && (question.n !== question.numbers.length ||
          question.answers.length !== question.n || new Set(question.answers).size !== question.answers.length)) {
        fail('Inconsistent multi-question definition');
      }
      const options = group.options;
      if (options && question.answers.some((answer) => !Object.hasOwn(options, answer))) {
        fail('Accepted option is missing from the review');
      }
    }
  }
});

const tablesSchema = z.object({
  version: z.literal(1),
  attempts: z.array(attemptSchema),
  answers: z.array(z.object({ attemptId: id, answers, updatedAt: timestamp }).strict()),
  results: z.array(resultSchema),
  highlights: z.array(z.object({
    id, attemptId: id, passage: positiveCount, paragraphIndex: count,
    start: count, end: count, quote: z.string(), note: z.string(), createdAt: timestamp,
  }).strict().refine((highlight) => highlight.end > highlight.start, 'Highlight end must follow start')),
  settings: z.array(z.object({ key: id, value: jsonValue }).strict()),
}).strict().superRefine((data, ctx) => {
  const keys = {
    attempts: data.attempts.map((record) => record.id),
    answers: data.answers.map((record) => record.attemptId),
    results: data.results.map((record) => record.attemptId),
    highlights: data.highlights.map((record) => record.id),
    settings: data.settings.map((record) => record.key),
  };
  for (const [table, ids] of Object.entries(keys)) {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: [table], message: 'Duplicate primary IDs' });
    }
  }
  const attempts = new Map(data.attempts.map((attempt) => [attempt.id, attempt]));
  for (const result of data.results) {
    const attempt = attempts.get(result.attemptId);
    if (attempt && (attempt.testId !== result.testId || attempt.skill !== result.skill)) {
      ctx.addIssue({ code: 'custom', path: ['results'], message: 'Result must match its attempt test and skill' });
    }
  }
});

/** Missing parent attempts are checked against the merged database at import. */
export const backupSchema = z.unknown().superRefine((input, ctx) => {
  if (!isJsonValue(input)) ctx.addIssue({ code: 'custom', message: 'Backup must contain only safe JSON values' });
}).pipe(tablesSchema);

export type BackupData = z.infer<typeof backupSchema>;

/** IndexedDB keeps optional undefined fields; JSON correctly omits those object properties. */
export function normalizeStoredBackup(input: unknown): BackupData {
  if (!isJsonValue(input, new Set(), true)) throw new Error('Stored data contains unsafe JSON values');
  // Settings are arbitrary JSON, not records with known optional fields. Never
  // silently discard an undefined value anywhere inside a user's setting.
  const settings = input !== null && typeof input === 'object'
    ? Object.getOwnPropertyDescriptor(input, 'settings')?.value as unknown : undefined;
  if (!isJsonValue(settings)) throw new Error('Stored settings contain unsafe JSON values');
  const normalized: unknown = JSON.parse(JSON.stringify(input));
  return backupSchema.parse(normalized);
}

/** Check foreign keys only after merging: imports may reference existing attempts. */
export function validateBackupRelations(data: BackupData): void {
  const ids = new Set(data.attempts.map((attempt) => attempt.id));
  for (const record of [...data.answers, ...data.results, ...data.highlights]) {
    if (!ids.has(record.attemptId)) throw new Error('Backup record references a missing attempt');
  }
}

function mergeById<T>(existing: T[], incoming: T[], key: (record: T) => string): T[] {
  const records = new Map(existing.map((record) => [key(record), record]));
  for (const record of incoming) records.set(key(record), record);
  return [...records.values()];
}

/** Pure incoming-wins merge, also validating records retained from the database. */
export function mergeBackupData(existing: BackupData, incoming: BackupData): BackupData {
  const merged = backupSchema.parse({
    version: 1,
    attempts: mergeById(existing.attempts, incoming.attempts, (record) => record.id),
    answers: mergeById(existing.answers, incoming.answers, (record) => record.attemptId),
    results: mergeById(existing.results, incoming.results, (record) => record.attemptId),
    highlights: mergeById(existing.highlights, incoming.highlights, (record) => record.id),
    settings: mergeById(existing.settings, incoming.settings, (record) => record.key),
  });
  validateBackupRelations(merged);
  return merged;
}