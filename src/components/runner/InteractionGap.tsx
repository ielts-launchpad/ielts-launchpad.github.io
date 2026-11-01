import { useEffect, useId, useRef } from 'react';
import { countWords } from '@/engine/text/words';
import type { StandardQuestion } from '@/engine/content/schema';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { QuestionFrame } from './QuestionFrame';
import type { GroupProps, RunnerController } from './types';

const t = en.runner.question;

/** `gap`: free-text answers with a live word-limit hint; supports templates. */
export function InteractionGap({ group, controller }: GroupProps): React.JSX.Element {
  const questions = group.questions as StandardQuestion[];

  if (group.template) {
    return (
      <TemplateGaps group={group} controller={controller} questions={questions} />
    );
  }

  return (
    <ol className="space-y-3">
      {questions.map((q) => (
        <li key={q.id}>
          <QuestionFrame group={group} question={q} controller={controller}>
            {q.prompt && <p className="mb-2 text-slate-800">{q.prompt}</p>}
            <GapField question={q} group={group} controller={controller} />
          </QuestionFrame>
        </li>
      ))}
    </ol>
  );
}

function TemplateGaps({
  group,
  controller,
  questions,
}: GroupProps & { questions: StandardQuestion[] }): React.JSX.Element {
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  // Split the template on {{n}} tokens, keeping the captured number.
  const segments = (group.template ?? '').split(/(\{\{\d+\}\})/);
  return (
    <div className="whitespace-pre-wrap leading-8 text-slate-800" data-testid="gap-template">
      {segments.map((segment, index) => {
        const match = /^\{\{(\d+)\}\}$/.exec(segment);
        if (!match) return <span key={index}>{segment}</span>;
        const question = byNumber.get(Number(match[1]));
        if (!question) return <span key={index}>{segment}</span>;
        return (
          <span key={index} className="inline-block align-baseline">
            <GapField question={question} group={group} controller={controller} inline />
          </span>
        );
      })}
    </div>
  );
}

function GapField({
  question,
  group,
  controller,
  inline = false,
}: {
  question: StandardQuestion;
  group: GroupProps['group'];
  controller: RunnerController;
  inline?: boolean;
}): React.JSX.Element {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const value = controller.getAnswer(question.id);
  const text = typeof value === 'string' ? value : '';
  const limit = group.wordLimit;
  const words = limit ? countWords(text, { numberAllowed: limit.numberAllowed }) : 0;
  const over = limit ? words > limit.words : false;

  useEffect(() => {
    if (inline) controller.registerQuestion(question.id, ref.current);
    return () => {
      if (inline) controller.registerQuestion(question.id, null);
    };
  }, [controller.registerQuestion, inline, question.id]);

  return (
    <span className={inline ? 'inline-flex flex-col' : 'block'}>
      <label htmlFor={id} className="sr-only">
        {format(en.runner.navigator.goToQuestion, { n: question.number })}
      </label>
      <input
        ref={inline ? ref : undefined}
        id={id}
        type="text"
        value={text}
        disabled={controller.submitted}
        onChange={(event) => controller.setAnswer(question.id, event.target.value)}
        aria-invalid={over}
        className={`rounded border px-2 py-1 text-slate-900 ${
          over ? 'border-red-500' : 'border-slate-300'
        } ${inline ? 'mx-1 w-32' : 'w-full'}`}
        data-testid={`gap-${question.id}`}
      />
      {limit && (
        <span
          role="status"
          aria-live="polite"
          className={`text-xs ${over ? 'text-red-700' : 'text-slate-600'}`}
          data-testid={`gap-hint-${question.id}`}
        >
          {over ? format(t.overLimit, { n: limit.words }) : format(t.wordsRemaining, { n: limit.words })}
        </span>
      )}
    </span>
  );
}
