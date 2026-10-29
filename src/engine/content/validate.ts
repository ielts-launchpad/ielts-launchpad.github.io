import { existsSync, readFileSync } from 'node:fs';
import {
  isMultiQuestion,
  SKILLS,
  type Interaction,
  type Question,
  type QuestionGroup,
  type Skill,
} from './schema';
import type { LoadedTest } from './loader';
import {
  countWords,
  expandOptionalWords,
  foldForMatch,
  stripTranscriptMarkup,
} from '../text/words';
import { oggOpusDurationSec } from '../audio/ogg';
import { gradeQuestion, gradeTest, type UserResponse } from '../grading/grade';

/**
 * Content validation (SPEC §3 rules 1–6). Pure over a {@link LoadedTest} so it
 * is unit-testable; the CLI wraps it. Rule 7 (perfect-answer-sheet) is added by
 * the grading milestone (M2.4).
 *
 * Rule 2 (exactly 4 listening parts / 3 reading passages, 40 contiguous
 * questions) applies only to `kind: mock`. Practice sets are partial by design
 * (SPEC §2), so for them only per-skill number uniqueness is enforced.
 */
export interface Problem {
  file: string;
  rule: number;
  message: string;
}

const OPTION_INTERACTIONS: Interaction[] = ['single', 'multi', 'select', 'dragBank'];

/** Interactions whose questions take a single option letter as the answer. */
const SINGLE_ANSWER_INTERACTIONS: Interaction[] = ['single', 'select', 'dragBank'];

function questionNumbers(question: Question): number[] {
  return isMultiQuestion(question) ? question.numbers : [question.number];
}

interface GroupContext {
  group: QuestionGroup;
  file: string;
  sourceText: string | null;
  isTranscript: boolean;
}

/** Validate a single loaded test, returning every problem found. */
export function validateTest(test: LoadedTest): Problem[] {
  const problems: Problem[] = [];
  const id = test.meta.id;

  const groups: GroupContext[] = [];
  for (const { part, transcriptText, audioFsPath } of test.listening) {
    const file = `${id}/listening/part-${part.part}`;
    for (const group of part.groups) {
      groups.push({ group, file, sourceText: transcriptText, isTranscript: true });
    }
    // Rule 6: audio files exist.
    if (!existsSync(audioFsPath)) {
      problems.push({ file, rule: 6, message: `audio file not found: ${part.audio}` });
    }
    // Rule 5: a listening transcript must be present and non-empty so evidence
    // quotes can be checked against it.
    if (transcriptText.trim() === '') {
      problems.push({ file, rule: 5, message: `transcript ${part.transcript} is missing or empty` });
    }
    // Rule 6: every audioStart must fall inside the part's declared duration.
    for (const group of part.groups) {
      for (const question of group.questions) {
        const start = question.evidence?.audioStart;
        if (start !== undefined && start >= part.durationSec) {
          problems.push({
            file,
            rule: 6,
            message: `question ${question.id}: audioStart ${start}s is not before durationSec ${part.durationSec}s`,
          });
        }
      }
    }
    // Rule 6: the real audio duration must match durationSec within ±1 s.
    checkAudioDuration(file, part.durationSec, audioFsPath, problems);
  }
  for (const { passage, markdownText } of test.reading) {
    const file = `${id}/reading/passage-${passage.passage}`;
    for (const group of passage.groups) {
      groups.push({ group, file, sourceText: markdownText, isTranscript: false });
    }
    // Rule 6: reading passages are 650–1000 words.
    const words = countPassageWords(markdownText);
    if (words < 650 || words > 1000) {
      problems.push({
        file,
        rule: 6,
        message: `passage is ${words} words; must be 650–1000`,
      });
    }
  }

  // Rule 1: ids unique across the whole test (groups + questions).
  checkUniqueIds(groups, problems);

  // Rule 1: meta.skills is consistent with the content that exists.
  checkSkills(test, problems);

  // Rule 2: structure (mocks only) / number uniqueness (practice).
  checkStructure(test, problems);

  for (const ctx of groups) {
    checkGroup(ctx, problems);
  }

  // Rule 7: the auto-generated perfect answer sheet scores full marks, every
  // listed variant is accepted and every non-answer option is rejected.
  checkPerfectAnswerSheet(test, problems);

  return problems;
}

/** Rule 6: compare the audio file's real duration with its declared value. */
function checkAudioDuration(
  file: string,
  durationSec: number,
  audioFsPath: string,
  problems: Problem[],
): void {
  if (!existsSync(audioFsPath)) return; // missing-file is reported separately.
  let actual: number | null;
  try {
    actual = oggOpusDurationSec(readFileSync(audioFsPath));
  } catch {
    actual = null;
  }
  if (actual === null) return; // unreadable/non-Ogg: not a duration problem here.
  if (Math.abs(actual - durationSec) > 1) {
    problems.push({
      file,
      rule: 6,
      message: `audio is ${actual.toFixed(1)}s but durationSec is ${durationSec}s (must match within ±1s)`,
    });
  }
}

function countPassageWords(markdown: string): number {
  // Drop paragraph labels like [A] and collapse whitespace before counting.
  const text = markdown.replace(/\[[A-Z]\]/g, ' ').replace(/[#>*_`-]/g, ' ');
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

function checkUniqueIds(groups: GroupContext[], problems: Problem[]): void {
  const seen = new Set<string>();
  const report = (value: string, file: string): void => {
    if (seen.has(value)) {
      problems.push({ file, rule: 1, message: `duplicate id: ${value}` });
    }
    seen.add(value);
  };
  for (const { group, file } of groups) {
    report(group.id, file);
    for (const question of group.questions) report(question.id, file);
  }
}

/** Rule 1: `meta.skills` must match the content that is actually present. */
function checkSkills(test: LoadedTest, problems: Problem[]): void {
  const id = test.meta.id;
  const file = `${id}/meta.yaml`;
  const listed = new Set(test.meta.skills);
  const present: Record<Skill, boolean> = {
    listening: test.listening.length > 0,
    reading: test.reading.length > 0,
    writing: test.writing.length > 0,
    speaking: test.speaking !== null,
  };

  for (const skill of SKILLS) {
    if (listed.has(skill) && !present[skill]) {
      problems.push({ file, rule: 1, message: `meta.skills lists "${skill}" but no ${skill} content exists` });
    }
    if (!listed.has(skill) && present[skill]) {
      problems.push({ file, rule: 1, message: `${skill} content exists but "${skill}" is not in meta.skills` });
    }
  }

  if (test.meta.kind === 'mock') {
    for (const skill of SKILLS) {
      if (!listed.has(skill)) {
        problems.push({ file, rule: 1, message: `a mock must list all four skills; missing "${skill}"` });
      }
    }
  }
}

function collectNumbers(groups: QuestionGroup[]): number[] {
  return groups.flatMap((g) => g.questions.flatMap(questionNumbers));
}

function checkStructure(test: LoadedTest, problems: Problem[]): void {
  const id = test.meta.id;
  const isMock = test.meta.kind === 'mock';

  const listeningGroups = test.listening.flatMap((l) => l.part.groups);
  const readingGroups = test.reading.flatMap((r) => r.passage.groups);

  if (isMock) {
    if (test.listening.length > 0 && test.listening.length !== 4) {
      problems.push({
        file: `${id}/listening`,
        rule: 2,
        message: `listening has ${test.listening.length} parts; a mock needs exactly 4`,
      });
    }
    if (test.reading.length > 0 && test.reading.length !== 3) {
      problems.push({
        file: `${id}/reading`,
        rule: 2,
        message: `reading has ${test.reading.length} passages; a mock needs exactly 3`,
      });
    }
    if (test.listening.length > 0) {
      checkContiguous(`${id}/listening`, collectNumbers(listeningGroups), problems);
    }
    if (test.reading.length > 0) {
      checkContiguous(`${id}/reading`, collectNumbers(readingGroups), problems);
    }
  } else {
    checkUniqueNumbers(`${id}/listening`, collectNumbers(listeningGroups), problems);
    checkUniqueNumbers(`${id}/reading`, collectNumbers(readingGroups), problems);
  }
}

function checkContiguous(file: string, numbers: number[], problems: Problem[]): void {
  const sorted = [...numbers].sort((a, b) => a - b);
  if (sorted.length !== 40) {
    problems.push({ file, rule: 2, message: `expected 40 questions, found ${sorted.length}` });
  }
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      problems.push({
        file,
        rule: 2,
        message: `question numbers must be contiguous 1–40 (break near ${sorted[i]})`,
      });
      break;
    }
  }
}

function checkUniqueNumbers(file: string, numbers: number[], problems: Problem[]): void {
  const seen = new Set<number>();
  for (const n of numbers) {
    if (seen.has(n)) {
      problems.push({ file, rule: 2, message: `duplicate question number: ${n}` });
    }
    seen.add(n);
  }
}

function checkGroup(ctx: GroupContext, problems: Problem[]): void {
  const { group, file } = ctx;

  // Rule 4: option integrity for option-based interactions.
  if (OPTION_INTERACTIONS.includes(group.interaction) && group.options) {
    const values = Object.values(group.options);
    if (new Set(values).size !== values.length) {
      problems.push({ file, rule: 4, message: `group ${group.id} has duplicate option values` });
    }
    const keys = new Set(Object.keys(group.options));
    for (const question of group.questions) {
      if (isMultiQuestion(question)) {
        if (question.n !== question.numbers.length || question.n !== question.answers.length) {
          problems.push({
            file,
            rule: 4,
            message: `question ${question.id}: n, numbers and answers must have equal length`,
          });
        }
      } else if (
        SINGLE_ANSWER_INTERACTIONS.includes(group.interaction) &&
        !group.acceptAlternatives &&
        question.answers.length !== 1
      ) {
        problems.push({
          file,
          rule: 4,
          message: `question ${question.id}: expected exactly one answer (set acceptAlternatives: true to allow more)`,
        });
      }
      for (const answer of question.answers) {
        if (!keys.has(answer)) {
          problems.push({
            file,
            rule: 4,
            message: `question ${question.id}: answer "${answer}" is not an option key`,
          });
        }
      }
    }
  }

  // Rule 3: gap answers obey the word limit after optional-word expansion.
  if (group.interaction === 'gap' && group.wordLimit) {
    const limit = group.wordLimit;
    for (const question of group.questions) {
      for (const answer of question.answers) {
        for (const variant of expandOptionalWords(answer)) {
          const count = countWords(variant, { numberAllowed: limit.numberAllowed });
          if (count > limit.words) {
            problems.push({
              file,
              rule: 3,
              message: `question ${question.id}: answer "${variant}" is ${count} words (limit ${limit.words})`,
            });
          }
        }
      }
    }
  }

  // Rule 6: template placeholders match the group's question numbers.
  if (group.template) {
    const placeholders = new Set(
      [...group.template.matchAll(/\{\{\s*(\d+)\s*\}\}/g)].map((m) => Number(m[1])),
    );
    const numbers = new Set(group.questions.flatMap(questionNumbers));
    for (const p of placeholders) {
      if (!numbers.has(p)) {
        problems.push({
          file,
          rule: 6,
          message: `group ${group.id}: template placeholder {{${p}}} has no matching question number`,
        });
      }
    }
    for (const n of numbers) {
      if (!placeholders.has(n)) {
        problems.push({
          file,
          rule: 6,
          message: `group ${group.id}: question number ${n} is missing from the template`,
        });
      }
    }
  }

  // Rule 5: evidence quotes appear verbatim in the source text. For listening
  // transcripts, timestamps and speaker labels are stripped first so a quote may
  // span several lines. A missing/empty transcript is reported in validateTest.
  if (ctx.sourceText && ctx.sourceText.trim() !== '') {
    const cleaned = ctx.isTranscript ? stripTranscriptMarkup(ctx.sourceText) : ctx.sourceText;
    const haystack = foldForMatch(cleaned);
    for (const question of group.questions) {
      if (question.evidence && !haystack.includes(foldForMatch(question.evidence.quote))) {
        problems.push({
          file,
          rule: 5,
          message: `question ${question.id}: evidence quote not found verbatim in source`,
        });
      }
    }
  }
}

/**
 * Rule 7: the auto-generated perfect answer sheet scores full marks, every
 * listed answer variant is accepted, and every non-answer option is rejected.
 * Exercises the grading engine (SPEC §4) against the content itself.
 */
function checkPerfectAnswerSheet(test: LoadedTest, problems: Problem[]): void {
  const id = test.meta.id;

  const skillGroups: { skill: Skill; file: string; group: QuestionGroup }[] = [
    ...test.listening.flatMap(({ part }) =>
      part.groups.map((group) => ({
        skill: 'listening' as const,
        file: `${id}/listening/part-${part.part}`,
        group,
      })),
    ),
    ...test.reading.flatMap(({ passage }) =>
      passage.groups.map((group) => ({
        skill: 'reading' as const,
        file: `${id}/reading/passage-${passage.passage}`,
        group,
      })),
    ),
  ];

  const perfect: Record<string, UserResponse> = {};

  for (const { file, group } of skillGroups) {
    for (const question of group.questions) {
      perfect[question.id] = perfectResponse(group, question);

      // Every listed answer variant must be accepted on its own.
      for (const variant of acceptedResponses(group, question)) {
        if (!gradeQuestion(group, question, variant).correct) {
          problems.push({
            file,
            rule: 7,
            message: `question ${question.id}: listed answer ${JSON.stringify(variant)} is not accepted`,
          });
        }
      }

      // Every option that is not an answer must be rejected.
      if (group.options && !isMultiQuestion(question)) {
        const answerKeys = new Set(question.answers.map((a) => a.toUpperCase()));
        for (const key of Object.keys(group.options)) {
          if (!answerKeys.has(key.toUpperCase()) && gradeQuestion(group, question, key).correct) {
            problems.push({
              file,
              rule: 7,
              message: `question ${question.id}: non-answer option "${key}" was accepted`,
            });
          }
        }
      }
    }
  }

  const result = gradeTest(test, perfect);
  for (const score of result.skills) {
    if (score.raw !== score.max) {
      problems.push({
        file: `${id}/${score.skill}`,
        rule: 7,
        message: `perfect answer sheet scores ${score.raw}/${score.max}; expected a full score`,
      });
    }
  }
}

/** The response that should earn full marks for a question. */
function perfectResponse(group: QuestionGroup, question: Question): UserResponse {
  if (isMultiQuestion(question)) return [...question.answers];
  if (group.interaction === 'gap') return expandOptionalWords(question.answers[0])[0];
  return question.answers[0];
}

/** Every individual response that must be accepted for a question. */
function acceptedResponses(group: QuestionGroup, question: Question): UserResponse[] {
  if (isMultiQuestion(question)) return [[...question.answers]];
  if (group.interaction === 'gap') {
    return question.answers.flatMap((answer) => expandOptionalWords(answer));
  }
  return question.answers;
}
