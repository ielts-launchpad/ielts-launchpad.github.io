import { useState } from 'react';
import { toggleMultiSelection } from '@/engine/runner/answers';
import { isMultiQuestion, type MultiQuestion } from '@/engine/content/schema';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { QuestionFrame } from './QuestionFrame';
import type { GroupProps } from './types';

const t = en.runner.question;

/** `multi` (Choose N): checkbox set with the N-limit enforced in the UI. */
export function InteractionMulti({ group, controller }: GroupProps): React.JSX.Element {
  const options = Object.entries(group.options ?? {});
  return (
    <ol className="space-y-3">
      {group.questions.filter(isMultiQuestion).map((question) => (
        <li key={question.id}>
          <QuestionFrame group={group} question={question} controller={controller}>
            <MultiField question={question} options={options} controller={controller} />
          </QuestionFrame>
        </li>
      ))}
    </ol>
  );
}

function MultiField({
  question,
  options,
  controller,
}: {
  question: MultiQuestion;
  options: [string, string][];
  controller: GroupProps['controller'];
}): React.JSX.Element {
  const [limitHit, setLimitHit] = useState(false);
  const raw = controller.getAnswer(question.id);
  const selected = Array.isArray(raw) ? raw : [];

  const onToggle = (letter: string): void => {
    const { next, blocked } = toggleMultiSelection(selected, letter, question.n);
    setLimitHit(blocked);
    if (!blocked) controller.setAnswer(question.id, next);
  };

  return (
    <fieldset data-testid={`multi-${question.id}`}>
      <legend className="mb-2 text-sm font-medium text-slate-700">
        {format(t.chooseN, { n: question.n })}
      </legend>
      <div className="space-y-1">
        {options.map(([key, label]) => {
          const checked = selected.includes(key);
          return (
            <div key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                id={`${question.id}-${key}`}
                checked={checked}
                disabled={controller.submitted}
                onChange={() => onToggle(key)}
                className="h-4 w-4"
                data-testid={`multi-option-${key}`}
              />
              <label htmlFor={`${question.id}-${key}`} className="text-slate-800">
                <span className="font-medium">{key}</span>
                {label !== key && <span> — {label}</span>}
              </label>
            </div>
          );
        })}
      </div>
      <p
        role="status"
        aria-live="polite"
        className="mt-1 min-h-[1rem] text-xs text-amber-700"
        data-testid={`multi-hint-${question.id}`}
      >
        {limitHit ? format(t.chooseNLimit, { n: question.n }) : ''}
      </p>
    </fieldset>
  );
}
