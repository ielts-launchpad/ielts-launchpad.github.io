/** Pure snapshot-to-review mapping. No browser, brand or exam dependencies. */
import type { Evidence, QuestionGroup } from '../content/schema';
import type { QuestionResult, UserResponse } from '../grading/grade';
import type { AnswerMap, ReadingRunnerData } from '../runner/types';

export interface ResultSection {
  number: number;
  title: string;
  text: string;
  groups: QuestionGroup[];
  audio?: string;
}

export interface ResultReview {
  answers: AnswerMap;
  sections: ResultSection[];
  variant: 'academic' | 'general';
  kind: 'mock' | 'practice';
}

/** Structural contract: storage can add `review` without coupling this engine to Dexie. */
export interface ResultInput {
  skill: 'reading' | 'listening';
  raw: number;
  max: number;
  results: QuestionResult[];
  testId: string;
  review?: ResultReview;
}

export interface EvidenceRange {
  /** UTF-16 offsets in the original input, suitable for String.slice. */
  start: number;
  end: number;
}

export interface ResultQuestionModel extends QuestionResult {
  userAnswers: string[];
  correctAnswers: string[];
  prompt?: string;
  explanation?: string | Record<string, string>;
  evidence?: Evidence;
  context?: string;
  highlight: EvidenceRange | null;
  audio?: string;
  hasSnapshot: boolean;
}

export interface ResultSectionModel {
  number: number;
  title: string;
  raw: number;
  max: number;
  questions: ResultQuestionModel[];
}

export interface ResultsModel {
  testId: string;
  skill: ResultInput['skill'];
  raw: number;
  max: number;
  /** UI supplies the exam-specific band mapper only when this is true. */
  canEstimateBand: boolean;
  variant: ResultReview['variant'] | null;
  sections: ResultSectionModel[];
  questions: ResultQuestionModel[];
  hasReview: boolean;
}

export function buildReadingReview(
  data: ReadingRunnerData,
  answers: AnswerMap,
  variant: ResultReview['variant'] = 'academic',
): ResultReview {
  return {
    answers: structuredClone(answers),
    variant,
    kind: data.kind,
    sections: data.passages.map((passage) => ({
      number: passage.passage,
      title: passage.title,
      text: passage.paragraphs
        .map((paragraph) => `${paragraph.label ? `[${paragraph.label}] ` : ''}${paragraph.text}`)
        .join('\n\n'),
      groups: structuredClone(passage.groups),
    })),
  };
}

/** Strip transcript metadata only, retaining the spoken text and line breaks. */
export function stripTranscriptHeaders(text: string): string {
  return text.replace(
    /^[\t ]*(?:\[\d{1,3}:\d{2}(?:\.\d+)?\][\t ]*)?(?:[^\n\r:]+:[\t ]*)?/gm,
    '',
  );
}

/** Exact, case-insensitive, whitespace-normalised matching; never fuzzy. */
export function findEvidenceRange(
  text: string,
  quote: string,
  transcript = false,
): EvidenceRange | null {
  // Index each retained character back into the original input. Removed speaker
  // headers may lie inside a spanning range, but cannot affect quote matching.
  const removed = new Set<number>();
  if (transcript) {
    const headers = /^[\t ]*(?:\[\d{1,3}:\d{2}(?:\.\d+)?\][\t ]*)?(?:[^\n\r:]+:[\t ]*)?/gm;
    for (const match of text.matchAll(headers)) {
      for (let i = match.index; i < match.index + match[0].length; i += 1) removed.add(i);
    }
  }
  let normalised = '';
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (removed.has(i)) continue;
    const character = /\s/u.test(text[i]) ? ' ' : text[i];
    if (character === ' ' && normalised.endsWith(' ')) {
      ends[ends.length - 1] = i + 1;
    } else {
      normalised += character;
      starts.push(i);
      ends.push(i + 1);
    }
  }
  const needle = quote.replace(/\s+/gu, ' ').trim();
  if (!needle) return null;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(escaped, 'iu').exec(normalised);
  if (!match) return null;
  return { start: starts[match.index], end: ends[match.index + match[0].length - 1] };
}

export function answerLocationOffset(audioStart: number): number {
  return Number.isFinite(audioStart) ? Math.max(0, audioStart - 3) : 0;
}

export function buildIssueUrl(
  repoUrl: string,
  testId: string,
  questionId: string,
  userAnswer: UserResponse,
): string {
  const url = new URL(`${repoUrl.replace(/\/+$/u, '')}/issues/new`);
  url.searchParams.set('title', `${testId}: ${questionId}`);
  url.searchParams.set('body', JSON.stringify({ testId, questionId, userAnswer }, null, 2));
  return url.href;
}

function responseValues(response: UserResponse | undefined): string[] {
  return response == null ? [] : Array.isArray(response) ? [...response] : [response];
}

export function buildResultsModel(result: ResultInput): ResultsModel {
  const snapshots = new Map<string, ResultQuestionModel>();
  const grades = new Map(result.results.map((grade) => [grade.questionId, grade]));
  const sections = (result.review?.sections ?? []).map((section): ResultSectionModel => {
    const context = result.skill === 'listening' ? stripTranscriptHeaders(section.text) : section.text;
    const questions: ResultQuestionModel[] = [];
    for (const group of section.groups) {
      for (const question of group.questions) {
        const grade = grades.get(question.id);
        if (!grade) continue;
        const formatOption = (value: string): string =>
          group.options?.[value] ? `${value}: ${group.options[value]}` : value;
        const model: ResultQuestionModel = {
          ...grade,
          numbers: [...grade.numbers],
          userAnswers: responseValues(result.review?.answers[question.id]).map(formatOption),
          correctAnswers: question.answers.map(formatOption),
          prompt: 'prompt' in question ? question.prompt : undefined,
          explanation: question.explanation,
          evidence: question.evidence,
          context,
          highlight: question.evidence ? findEvidenceRange(context, question.evidence.quote) : null,
          audio: section.audio,
          hasSnapshot: true,
        };
        snapshots.set(question.id, model);
        questions.push(model);
      }
    }
    return {
      number: section.number,
      title: section.title,
      raw: questions.reduce((sum, question) => sum + question.marks, 0),
      max: questions.reduce((sum, question) => sum + question.maxMarks, 0),
      questions,
    };
  });
  return {
    testId: result.testId,
    skill: result.skill,
    raw: result.raw,
    max: result.max,
    canEstimateBand: result.review !== undefined,
    variant: result.review?.variant ?? null,
    sections,
    questions: result.results.map((grade) => snapshots.get(grade.questionId) ?? {
      ...grade,
      numbers: [...grade.numbers],
      userAnswers: responseValues(result.review?.answers[grade.questionId]),
      correctAnswers: [],
      highlight: null,
      hasSnapshot: false,
    }),
    hasReview: result.review !== undefined,
  };
}