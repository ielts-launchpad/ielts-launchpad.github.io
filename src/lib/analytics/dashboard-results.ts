/** Pure adapter: saved review identifies question types and IELTS band eligibility. */
import type { DashboardResult } from '../../engine/analytics/dashboard';
import type { QType } from '../../engine/content/schema';
import { buildResultsModel } from '../../engine/results/model';
import { skillBand } from '../../exams/ielts/bands';
import type { ResultRecord } from '../storage/db';

export function toDashboardResult(record: ResultRecord): DashboardResult {
  const model = buildResultsModel(record);
  const types = new Map<string, QType>();
  for (const section of record.review?.sections ?? []) {
    for (const group of section.groups) {
      for (const question of group.questions) types.set(question.id, group.qtype);
    }
  }
  return {
    attemptId: record.attemptId,
    createdAt: record.createdAt,
    skill: record.skill,
    band: model.canEstimateBand && model.variant !== null
      ? skillBand(record.skill, model.variant, record.raw) : null,
    questions: record.results.map((question) => ({
      ...question, numbers: [...question.numbers], qtype: types.get(question.questionId) ?? null,
    })),
  };
}

export function toDashboardResults(records: readonly ResultRecord[]): DashboardResult[] {
  return records.map(toDashboardResult);
}