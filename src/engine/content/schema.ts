import { z } from 'zod';

/**
 * Zod content schemas for IELTS test content (SPEC §3).
 *
 * These are the exam-agnostic shapes the loader and validator rely on. Semantic
 * cross-file rules (contiguous numbering, evidence-quote presence, word limits,
 * etc.) live in the validator (SPEC §3 rules 2–6); this module covers rule 1
 * (schema validity) plus the structural constraints that are naturally local to
 * a single group or file.
 */

/** Allowed IELTS question-type tags (SPEC §3). Order is not significant. */
export const QTYPES = [
  'multiple-choice',
  'choose-n',
  'true-false-not-given',
  'yes-no-not-given',
  'matching-headings',
  'matching-information',
  'matching-features',
  'matching-sentence-endings',
  'sentence-completion',
  'summary-completion',
  'note-completion',
  'table-completion',
  'flow-chart-completion',
  'form-completion',
  'diagram-labelling',
  'map-plan-labelling',
  'short-answer',
] as const;

export const qtypeSchema = z.enum(QTYPES);
export type QType = z.infer<typeof qtypeSchema>;

/** Interaction model used to render and grade a group (SPEC §3). */
export const INTERACTIONS = ['single', 'multi', 'select', 'dragBank', 'gap'] as const;
export const interactionSchema = z.enum(INTERACTIONS);
export type Interaction = z.infer<typeof interactionSchema>;

export const SKILLS = ['listening', 'reading', 'writing', 'speaking'] as const;
export const skillSchema = z.enum(SKILLS);
export type Skill = z.infer<typeof skillSchema>;

/** Evidence anchoring an answer to the source (SPEC §3, §6). */
export const evidenceSchema = z
  .object({
    quote: z.string().min(1),
    audioStart: z.number().nonnegative().optional(),
    paragraph: z.string().min(1).optional(),
  })
  .strict();
export type Evidence = z.infer<typeof evidenceSchema>;

/** Word limit for `gap` interactions (SPEC §3, §4). */
export const wordLimitSchema = z
  .object({
    words: z.number().int().positive(),
    numberAllowed: z.boolean().optional().default(false),
  })
  .strict();
export type WordLimit = z.infer<typeof wordLimitSchema>;

const idSchema = z.string().min(1);

/** A standard (one-answer-slot) question: single/select/dragBank/gap. */
export const standardQuestionSchema = z
  .object({
    id: idSchema,
    number: z.number().int().positive(),
    prompt: z.string().min(1).optional(),
    answers: z.array(z.string().min(1)).min(1),
    evidence: evidenceSchema,
    explanation: z.string().min(1).optional(),
    subskill: z.string().min(1).optional(),
  })
  .strict();
export type StandardQuestion = z.infer<typeof standardQuestionSchema>;

/** A `multi` (Choose N) question covering several numbers at once (SPEC §3). */
export const multiQuestionSchema = z
  .object({
    id: idSchema,
    numbers: z.array(z.number().int().positive()).min(2),
    n: z.number().int().positive(),
    answers: z.array(z.string().min(1)).min(1),
    evidence: evidenceSchema.optional(),
    explanation: z.record(z.string().min(1)).optional(),
    subskill: z.string().min(1).optional(),
  })
  .strict();
export type MultiQuestion = z.infer<typeof multiQuestionSchema>;

export const questionSchema = z.union([standardQuestionSchema, multiQuestionSchema]);
export type Question = z.infer<typeof questionSchema>;

/** True when a parsed question is the `multi` (Choose N) variant. */
export const isMultiQuestion = (q: Question): q is MultiQuestion => 'numbers' in q;

/** A group of questions sharing instructions, an interaction and a qtype. */
export const questionGroupSchema = z
  .object({
    id: idSchema,
    instructions: z.string().min(1),
    interaction: interactionSchema,
    qtype: qtypeSchema,
    template: z.string().min(1).optional(),
    image: z.string().min(1).optional(),
    options: z.record(z.string().min(1)).optional(),
    allowReuse: z.boolean().optional(),
    wordLimit: wordLimitSchema.optional(),
    questions: z.array(questionSchema).min(1),
  })
  .strict()
  .superRefine((group, ctx) => {
    const optionInteractions: Interaction[] = ['single', 'multi', 'select', 'dragBank'];

    if (optionInteractions.includes(group.interaction)) {
      if (!group.options || Object.keys(group.options).length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `interaction "${group.interaction}" requires non-empty options`,
        });
      }
    } else if (group.options) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['options'],
        message: `interaction "${group.interaction}" must not define options`,
      });
    }

    if (group.interaction === 'gap') {
      if (!group.wordLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['wordLimit'],
          message: 'gap interaction requires a wordLimit',
        });
      }
    } else if (group.wordLimit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wordLimit'],
        message: 'wordLimit is only valid for the gap interaction',
      });
    }

    if (group.allowReuse !== undefined && !['select', 'dragBank'].includes(group.interaction)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowReuse'],
        message: 'allowReuse is only valid for select or dragBank interactions',
      });
    }

    const multiShaped = group.questions.filter(isMultiQuestion);
    if (group.interaction === 'multi') {
      if (multiShaped.length !== group.questions.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['questions'],
          message: 'multi interaction requires every question to use numbers/n',
        });
      }
    } else if (multiShaped.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['questions'],
        message: `interaction "${group.interaction}" must use single-number questions`,
      });
    }
  });
export type QuestionGroup = z.infer<typeof questionGroupSchema>;

/** `listening/part-<n>.yaml` (SPEC §3). */
export const listeningPartSchema = z
  .object({
    part: z.number().int().min(1).max(4),
    audio: z.string().min(1),
    durationSec: z.number().positive(),
    transcript: z.string().min(1),
    groups: z.array(questionGroupSchema).min(1),
  })
  .strict();
export type ListeningPart = z.infer<typeof listeningPartSchema>;

/** `reading/passage-<n>.yaml` (SPEC §3). */
export const readingPassageSchema = z
  .object({
    passage: z.number().int().min(1).max(3),
    title: z.string().min(1),
    file: z.string().min(1),
    groups: z.array(questionGroupSchema).min(1),
  })
  .strict();
export type ReadingPassage = z.infer<typeof readingPassageSchema>;

const chartSchema = z
  .object({
    type: z.enum(['bar', 'line', 'pie', 'table', 'process', 'map']),
    title: z.string().min(1),
    xLabel: z.string().optional(),
    yLabel: z.string().optional(),
    series: z.array(z.unknown()).optional(),
  })
  .strict();

const modelAnswerSchema = z
  .object({
    band: z.number().min(0).max(9),
    text: z.string().min(1).optional(),
    examinerNotes: z.string().min(1).optional(),
    part: z.number().int().min(1).max(3).optional(),
  })
  .strict();

/** `writing/task-<n>.yaml` (SPEC §3). */
export const writingTaskSchema = z
  .object({
    task: z.union([z.literal(1), z.literal(2)]),
    minutes: z.number().int().positive(),
    minWords: z.number().int().positive(),
    prompt: z.string().min(1),
    chart: chartSchema.optional(),
    modelAnswers: z.array(modelAnswerSchema).optional(),
  })
  .strict();
export type WritingTask = z.infer<typeof writingTaskSchema>;

const speakingTurnSchema = z
  .object({
    topic: z.string().min(1).optional(),
    questions: z.array(z.string().min(1)).min(1),
    audio: z.array(z.string().min(1)).optional(),
  })
  .strict();

/** `speaking/speaking.yaml` (SPEC §3). */
export const speakingSchema = z
  .object({
    part1: z.array(speakingTurnSchema).min(1),
    part2: z
      .object({
        cueCard: z.string().min(1),
        bullets: z.array(z.string().min(1)).min(1),
        prepSec: z.number().int().positive(),
        speakSec: z.number().int().positive(),
        audio: z.string().min(1).optional(),
      })
      .strict(),
    part3: z
      .object({
        questions: z.array(z.string().min(1)).min(1),
        audio: z.array(z.string().min(1)).optional(),
      })
      .strict(),
    modelAnswers: z.array(modelAnswerSchema).optional(),
  })
  .strict();
export type Speaking = z.infer<typeof speakingSchema>;

/** `meta.yaml` (SPEC §3). */
export const metaSchema = z
  .object({
    id: idSchema,
    exam: z.literal('ielts'),
    variant: z.enum(['academic', 'general']),
    kind: z.enum(['mock', 'practice']),
    title: z.string().min(1),
    status: z.enum(['draft', 'published']),
    skills: z.array(skillSchema).min(1),
    license: z.string().min(1),
    version: z.number().int().positive(),
  })
  .strict();
export type Meta = z.infer<typeof metaSchema>;
