/**
 * Deterministic grading for Listening & Reading (SPEC §4). Exam-agnostic: works
 * off the content schema types and returns raw marks plus an error
 * classification per question. Band mapping and overall rounding are IELTS
 * specifics and live in `src/exams/ielts/bands.ts`.
 */
import {
  isMultiQuestion,
  type MultiQuestion,
  type Question,
  type QuestionGroup,
  type Skill,
  type StandardQuestion,
} from '../content/schema';
import type { LoadedTest } from '../content/loader';
import { countWords, expandOptionalWords } from '../text/words';
import { canonicalAnswer, canonicalOption } from './normalise';
import { damerauLevenshtein } from './distance';

/** A user's response to one question. */
export type UserResponse = string | string[] | null;

/** How a wrong answer missed (SPEC §4). `null` on a fully correct answer. */
export type ErrorClass = 'blank' | 'over-limit' | 'plural' | 'spelling' | 'wrong';

export interface QuestionResult {
  questionId: string;
  numbers: number[];
  marks: number;
  maxMarks: number;
  correct: boolean;
  errorClass: ErrorClass | null;
}

export interface SkillScore {
  skill: Skill;
  raw: number;
  max: number;
  results: QuestionResult[];
}

export interface TestResult {
  skills: SkillScore[];
}

function asArray(response: UserResponse): string[] {
  if (response === null) return [];
  return Array.isArray(response) ? response : [response];
}

function firstString(response: UserResponse): string {
  const arr = asArray(response);
  return arr.length > 0 ? arr[0] : '';
}

/** Accepted canonical forms for a gap question (optional words expanded). */
function acceptedGapForms(question: StandardQuestion): string[] {
  const forms = new Set<string>();
  for (const answer of question.answers) {
    for (const variant of expandOptionalWords(answer)) {
      forms.add(canonicalAnswer(variant));
    }
  }
  return [...forms];
}

function isPluralDiff(a: string, b: string): boolean {
  return a === `${b}s` || a === `${b}es` || b === `${a}s` || b === `${a}es`;
}

function classifyGap(userCanon: string, accepted: string[]): ErrorClass {
  for (const a of accepted) {
    if (isPluralDiff(userCanon, a)) return 'plural';
  }
  if (userCanon.length >= 4) {
    for (const a of accepted) {
      if (damerauLevenshtein(userCanon, a, 2) <= 2) return 'spelling';
    }
  }
  return 'wrong';
}

function gradeGap(
  group: QuestionGroup,
  question: StandardQuestion,
  response: UserResponse,
): QuestionResult {
  const raw = firstString(response);
  const base = { questionId: question.id, numbers: [question.number], maxMarks: 1 };

  if (raw.trim() === '') {
    return { ...base, marks: 0, correct: false, errorClass: 'blank' };
  }

  if (group.wordLimit) {
    const count = countWords(raw, { numberAllowed: group.wordLimit.numberAllowed });
    if (count > group.wordLimit.words) {
      return { ...base, marks: 0, correct: false, errorClass: 'over-limit' };
    }
  }

  const accepted = acceptedGapForms(question);
  const userCanon = canonicalAnswer(raw);
  if (accepted.includes(userCanon)) {
    return { ...base, marks: 1, correct: true, errorClass: null };
  }
  return { ...base, marks: 0, correct: false, errorClass: classifyGap(userCanon, accepted) };
}

function gradeOption(question: StandardQuestion, response: UserResponse): QuestionResult {
  const base = { questionId: question.id, numbers: [question.number], maxMarks: 1 };
  const raw = firstString(response);

  if (raw.trim() === '') {
    return { ...base, marks: 0, correct: false, errorClass: 'blank' };
  }

  const accepted = new Set(question.answers.map(canonicalOption));
  if (accepted.has(canonicalOption(raw))) {
    return { ...base, marks: 1, correct: true, errorClass: null };
  }
  return { ...base, marks: 0, correct: false, errorClass: 'wrong' };
}

function gradeMulti(question: MultiQuestion, response: UserResponse): QuestionResult {
  const base = { questionId: question.id, numbers: question.numbers, maxMarks: question.n };
  const accepted = new Set(question.answers.map(canonicalOption));
  const picked = new Set(asArray(response).map(canonicalOption).filter(Boolean));

  if (picked.size === 0) {
    return { ...base, marks: 0, correct: false, errorClass: 'blank' };
  }

  let marks = 0;
  for (const letter of picked) if (accepted.has(letter)) marks += 1;
  const correct = marks === question.n;
  return { ...base, marks, correct, errorClass: correct ? null : 'wrong' };
}

/** Grade a single question against a user response. */
export function gradeQuestion(
  group: QuestionGroup,
  question: Question,
  response: UserResponse,
): QuestionResult {
  if (isMultiQuestion(question)) {
    return gradeMulti(question, response);
  }
  if (group.interaction === 'gap') {
    return gradeGap(group, question, response);
  }
  return gradeOption(question, response);
}

interface SkillSource {
  skill: Skill;
  groups: QuestionGroup[];
}

function scoreSkill(source: SkillSource, responses: Record<string, UserResponse>): SkillScore {
  const results: QuestionResult[] = [];
  for (const group of source.groups) {
    for (const question of group.questions) {
      results.push(gradeQuestion(group, question, responses[question.id] ?? null));
    }
  }
  const raw = results.reduce((sum, r) => sum + r.marks, 0);
  const max = results.reduce((sum, r) => sum + r.maxMarks, 0);
  return { skill: source.skill, raw, max, results };
}

/**
 * Grade a whole test's Listening and Reading sections. Writing and Speaking are
 * graded by the AI worker (SPEC §8) and are not included here.
 */
export function gradeTest(test: LoadedTest, responses: Record<string, UserResponse>): TestResult {
  const sources: SkillSource[] = [];
  if (test.listening.length > 0) {
    sources.push({ skill: 'listening', groups: test.listening.flatMap((l) => l.part.groups) });
  }
  if (test.reading.length > 0) {
    sources.push({ skill: 'reading', groups: test.reading.flatMap((r) => r.passage.groups) });
  }
  return { skills: sources.map((s) => scoreSkill(s, responses)) };
}
