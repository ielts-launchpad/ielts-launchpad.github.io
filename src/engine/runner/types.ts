/**
 * Serializable shapes passed from the Astro build step into the client-side
 * Reading runner (SPEC §5). Kept exam-agnostic and free of any Node or React
 * dependency so the same types describe build-time data and in-browser state.
 */
import type { QuestionGroup } from '../content/schema';
import type { UserResponse } from '../grading/grade';

/** How the runner behaves (SPEC §5). */
export type RunnerMode = 'exam' | 'practice';

/** One rendered passage paragraph; `label` is the `[A]` marker when present. */
export interface RunnerParagraph {
  label: string | null;
  text: string;
}

/** A reading passage prepared for the client: prose split into paragraphs. */
export interface RunnerPassage {
  passage: number;
  title: string;
  paragraphs: RunnerParagraph[];
  groups: QuestionGroup[];
}

/** Everything the Reading runner island needs, fully JSON-serialisable. */
export interface ReadingRunnerData {
  variant?: 'academic' | 'general';
  testId: string;
  testTitle: string;
  kind: 'mock' | 'practice';
  isDraft: boolean;
  /** Exam-mode countdown length; Reading is 60 minutes (SPEC §5). */
  durationSec: number;
  passages: RunnerPassage[];
}

export interface RunnerListeningPart {
  part: number;
  audio: string;
  durationSec: number;
  transcript: string;
  groups: QuestionGroup[];
}

export interface ListeningRunnerData {
  testId: string;
  testTitle: string;
  variant: 'academic' | 'general';
  kind: 'mock' | 'practice';
  isDraft: boolean;
  parts: RunnerListeningPart[];
}

/** User answers keyed by question id (matches {@link UserResponse}). */
export type AnswerMap = Record<string, UserResponse>;
