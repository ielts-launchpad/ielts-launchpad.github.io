/** Pure dashboard aggregation. Storage eligibility and exam rounding belong to callers. */
import { QTYPES, SKILLS, type QType, type Skill } from '../content/schema';
import type { ErrorClass, QuestionResult } from '../grading/grade';

export interface DashboardResult {
  attemptId: string;
  createdAt: number;
  skill: Skill;
  /** Caller supplies an eligible skill band, or null for partial/legacy results. */
  band: number | null;
  questions: Array<QuestionResult & { qtype: QType | null }>;
}

export interface DashboardAccuracy {
  qtype: QType;
  marks: number;
  maxMarks: number;
  percentage: number;
}

export interface DashboardHistoryEntry {
  attemptId: string;
  createdAt: number;
  reading: number | null;
  listening: number | null;
  writing: number | null;
  speaking: number | null;
  overall: number | null;
}

export interface Dashboard {
  latestBands: Record<Skill, number | null>;
  currentBand: number | null;
  history: DashboardHistoryEntry[];
  accuracy: DashboardAccuracy[];
  errors: Record<ErrorClass, number>;
  weaknesses: DashboardAccuracy[];
  unknownQuestionTypes: number;
}

/** Tuple order: reading, listening, writing, speaking. */
export type RoundOverall = (bands: [number, number, number, number]) => number;

const ERROR_CLASSES: ErrorClass[] = ['blank', 'over-limit', 'plural', 'spelling', 'wrong'];
const emptyBands = (): Record<Skill, number | null> => ({
  reading: null,
  listening: null,
  writing: null,
  speaking: null,
});
const lexical = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const validBand = (band: number | null): band is number =>
  band !== null && Number.isFinite(band) && band >= 0;

function overall(bands: Record<Skill, number | null>, roundOverall: RoundOverall): number | null {
  const { reading, listening, writing, speaking } = bands;
  if (reading === null || listening === null || writing === null || speaking === null) return null;
  const value = roundOverall([reading, listening, writing, speaking]);
  return validBand(value) ? value : null;
}

/** Content-based tie-break, independent of input order, object key order and question order. */
function fingerprint(result: DashboardResult): string {
  return JSON.stringify([
    result.skill,
    result.band,
    result.questions
      .map((q) => JSON.stringify([
        q.questionId, q.numbers, q.marks, q.maxMarks, q.correct, q.errorClass, q.qtype ?? null,
      ]))
      .sort(lexical),
  ]);
}

function uniqueResults(results: DashboardResult[]): DashboardResult[] {
  const byId = new Map<string, DashboardResult>();
  for (const result of results) {
    // An invalid timestamp cannot establish recency or a chronological history event.
    if (!Number.isFinite(result.createdAt) || result.createdAt < 0 || !SKILLS.includes(result.skill)) {
      continue;
    }
    const previous = byId.get(result.attemptId);
    if (
      !previous || result.createdAt > previous.createdAt ||
      (result.createdAt === previous.createdAt && lexical(fingerprint(result), fingerprint(previous)) > 0)
    ) {
      byId.set(result.attemptId, result);
    }
  }
  return [...byId.values()].sort((a, b) =>
    a.createdAt - b.createdAt || lexical(a.attemptId, b.attemptId),
  );
}

function validScore(question: QuestionResult): boolean {
  return Number.isFinite(question.marks) && Number.isFinite(question.maxMarks) &&
    question.maxMarks > 0 && question.marks >= 0 && question.marks <= question.maxMarks;
}

/**
 * Latest eligible bands never disappear after a partial result. History retains
 * only the event's skill band; overall uses the latest four eligible bands.
 * Accuracy and errors include all retained attempts, regardless of band eligibility.
 * Invalid score pairs are ignored, not clamped. Unknown qtypes count entries,
 * including invalid-score entries; they still contribute valid error marks.
 * Duplicate ids retain the newest timestamp (lexically greatest fingerprint on ties).
 * Band scale limits are the caller's exam concern; core accepts finite nonnegative bands.
 */
export function buildDashboard(
  results: DashboardResult[],
  roundOverall: RoundOverall = ([reading, listening, writing, speaking]) =>
    reading / 4 + listening / 4 + writing / 4 + speaking / 4,
): Dashboard {
  const latestBands = emptyBands();
  const history: DashboardHistoryEntry[] = [];
  const totals = new Map<QType, { marks: number; maxMarks: number }>();
  const errors: Record<ErrorClass, number> = {
    blank: 0, 'over-limit': 0, plural: 0, spelling: 0, wrong: 0,
  };
  let unknownQuestionTypes = 0;

  for (const result of uniqueResults(results)) {
    if (validBand(result.band)) {
      latestBands[result.skill] = result.band;
      history.push({
        attemptId: result.attemptId,
        createdAt: result.createdAt,
        ...emptyBands(),
        [result.skill]: result.band,
        overall: overall(latestBands, roundOverall),
      });
    }
    for (const question of result.questions) {
      const knownType = question.qtype != null && QTYPES.includes(question.qtype);
      if (!knownType) unknownQuestionTypes += 1;
      if (!validScore(question)) continue;

      if (knownType && question.qtype !== null) {
        const previous = totals.get(question.qtype) ?? { marks: 0, maxMarks: 0 };
        const marks = previous.marks + question.marks;
        const maxMarks = previous.maxMarks + question.maxMarks;
        // Ignore an overflowing addition atomically to retain a meaningful ratio.
        if (Number.isFinite(marks) && Number.isFinite(maxMarks)) {
          totals.set(question.qtype, { marks, maxMarks });
        }
      }
      if (!question.correct && question.errorClass !== null && ERROR_CLASSES.includes(question.errorClass)) {
        const missedMarks = question.maxMarks - question.marks;
        const frequency = errors[question.errorClass] + missedMarks;
        if (Number.isFinite(frequency)) errors[question.errorClass] = frequency;
      }
    }
  }

  const accuracy = [...totals].map(([qtype, score]): DashboardAccuracy => ({
    qtype, ...score, percentage: (score.marks / score.maxMarks) * 100,
  })).sort((a, b) => lexical(a.qtype, b.qtype));
  const weaknesses = accuracy.filter((entry) => entry.marks < entry.maxMarks)
    .sort((a, b) => a.percentage - b.percentage || b.maxMarks - a.maxMarks || lexical(a.qtype, b.qtype))
    .slice(0, 3);

  return {
    latestBands,
    currentBand: history.at(-1)?.overall ?? null,
    history,
    accuracy,
    errors,
    weaknesses,
    unknownQuestionTypes,
  };
}