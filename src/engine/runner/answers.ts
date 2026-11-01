/**
 * Pure answer-state helpers for the Reading runner (SPEC §4, §5). No React or
 * storage dependency: every function is a plain data transform so the selection
 * rules (Choose-N limit, answered/flag state, navigator mapping) are unit
 * testable in isolation and reused by the UI and the autosave layer.
 */
import { isMultiQuestion, type QuestionGroup } from '../content/schema';
import type { UserResponse } from '../grading/grade';
import type { AnswerMap, RunnerPassage } from './types';

/** A single numbered cell in the 1–40 navigator, mapped to its question. */
export interface NavigatorCell {
  number: number;
  questionId: string;
  groupId: string;
  passage: number;
}

/** Flatten every passage/group/question into ordered navigator cells. */
export function navigatorCells(passages: RunnerPassage[]): NavigatorCell[] {
  const cells: NavigatorCell[] = [];
  for (const passage of passages) {
    for (const group of passage.groups) {
      for (const question of group.questions) {
        const numbers = isMultiQuestion(question) ? question.numbers : [question.number];
        for (const number of numbers) {
          cells.push({
            number,
            questionId: question.id,
            groupId: group.id,
            passage: passage.passage,
          });
        }
      }
    }
  }
  return cells.sort((a, b) => a.number - b.number);
}

/** Whether a response counts as answered (non-empty) for progress display. */
export function isAnswered(response: UserResponse | undefined): boolean {
  if (response === null || response === undefined) return false;
  if (Array.isArray(response)) return response.length > 0;
  return response.trim() !== '';
}

/** Count of distinct answered questions across all passages. */
export function answeredQuestionIds(passages: RunnerPassage[], answers: AnswerMap): Set<string> {
  const ids = new Set<string>();
  for (const passage of passages) {
    for (const group of passage.groups) {
      for (const question of group.questions) {
        if (isAnswered(answers[question.id])) ids.add(question.id);
      }
    }
  }
  return ids;
}

/** Result of a Choose-N toggle: the next selection and whether it was blocked. */
export interface MultiToggleResult {
  next: string[];
  /** True when the pick was rejected because the limit of N was already met. */
  blocked: boolean;
}

/**
 * Toggle a letter in a Choose-N selection. Selecting an already-picked letter
 * deselects it; selecting a new letter when N are already chosen is blocked and
 * leaves the selection unchanged (SPEC §4: the UI prevents selecting more
 * than N).
 */
export function toggleMultiSelection(current: string[], letter: string, n: number): MultiToggleResult {
  if (current.includes(letter)) {
    return { next: current.filter((l) => l !== letter), blocked: false };
  }
  if (current.length >= n) {
    return { next: current, blocked: true };
  }
  return { next: [...current, letter], blocked: false };
}

/** All question ids declared across the passages (used to size progress). */
export function allQuestionIds(passages: RunnerPassage[]): string[] {
  const ids: string[] = [];
  for (const passage of passages) {
    for (const group of passage.groups) {
      for (const question of group.questions) ids.push(question.id);
    }
  }
  return ids;
}

/** Find the group a question belongs to, or null. */
export function findGroup(passages: RunnerPassage[], questionId: string): QuestionGroup | null {
  for (const passage of passages) {
    for (const group of passage.groups) {
      if (group.questions.some((q) => q.id === questionId)) return group;
    }
  }
  return null;
}
