import { useEffect, useRef, type ReactNode } from 'react';
import { isMultiQuestion, type Question, type QuestionGroup } from '@/engine/content/schema';
import { en } from '@/i18n/en';
import type { RunnerController } from './types';

const t = en.runner.question;

interface QuestionFrameProps {
  group: QuestionGroup;
  question: Question;
  controller: RunnerController;
  /** Hide the per-question flag/check chrome (e.g. template-embedded gaps). */
  bare?: boolean;
  children: ReactNode;
}

/** Numbered wrapper around a question: label, flag toggle and practice check. */
export function QuestionFrame({
  group,
  question,
  controller,
  bare = false,
  children,
}: QuestionFrameProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const numbers = isMultiQuestion(question)
    ? question.numbers.join('–')
    : String(question.number);

  useEffect(() => {
    controller.registerQuestion(question.id, ref.current);
    return () => controller.registerQuestion(question.id, null);
  }, [controller.registerQuestion, question.id]);

  const flagged = controller.isFlagged(question.id);
  const checked = controller.isChecked(question.id);
  const showCheck = controller.mode === 'practice' && !controller.submitted;

  return (
    <div
      ref={ref}
      id={`question-${question.id}`}
      data-question-id={question.id}
      data-testid={`question-${numbers}`}
      tabIndex={-1}
      className="scroll-mt-24 rounded-md border border-slate-200 p-3"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="font-semibold text-slate-900" data-testid="question-number">
          {numbers}
        </span>
        {!bare && (
          <button
            type="button"
            onClick={() => controller.toggleFlag(question.id)}
            aria-pressed={flagged}
            className={`rounded px-2 py-1 text-xs ${
              flagged ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-700'
            }`}
            data-testid="flag-toggle"
          >
            {flagged ? t.unflag : t.flag}
          </button>
        )}
      </div>

      {children}

      {showCheck && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => controller.checkAnswer(question.id)}
            className="rounded bg-slate-800 px-3 py-1 text-xs text-white"
            data-testid="check-answer"
          >
            {t.checkAnswer}
          </button>
          {checked && <CheckResult group={group} question={question} controller={controller} />}
        </div>
      )}
    </div>
  );
}

function CheckResult({
  group,
  question,
  controller,
}: {
  group: QuestionGroup;
  question: Question;
  controller: RunnerController;
}): React.JSX.Element {
  const result = controller.gradeOne(group, question);
  return (
    <p
      role="status"
      className={`mt-1 text-xs font-medium ${result.correct ? 'text-green-700' : 'text-red-700'}`}
      data-testid="check-result"
      data-correct={result.correct}
    >
      {result.correct ? t.correct : t.incorrect}
    </p>
  );
}
