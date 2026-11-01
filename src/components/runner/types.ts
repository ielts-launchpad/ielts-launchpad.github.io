/**
 * Shared prop contracts for the Reading runner's React components (SPEC §5).
 * The controller is the single surface the root runner exposes to every
 * interaction component: read/write answers, flag state, practice-mode checking
 * and the current mode. Keeping it here avoids prop-drilling many callbacks.
 */
import type { Question, QuestionGroup } from '@/engine/content/schema';
import type { QuestionResult, UserResponse } from '@/engine/grading/grade';
import type { RunnerMode } from '@/engine/runner/types';

export interface RunnerController {
  mode: RunnerMode;
  submitted: boolean;
  getAnswer: (questionId: string) => UserResponse | undefined;
  setAnswer: (questionId: string, response: UserResponse) => void;
  isFlagged: (questionId: string) => boolean;
  toggleFlag: (questionId: string) => void;
  /** Practice mode only: reveal grading for a single question. */
  isChecked: (questionId: string) => boolean;
  checkAnswer: (questionId: string) => void;
  gradeOne: (group: QuestionGroup, question: Question) => QuestionResult;
  /** Register a DOM node for a question so the navigator can focus it. */
  registerQuestion: (questionId: string, node: HTMLElement | null) => void;
}

export interface GroupProps {
  group: QuestionGroup;
  controller: RunnerController;
}
