import { useId } from 'react';
import type { StandardQuestion } from '@/engine/content/schema';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { QuestionFrame } from './QuestionFrame';
import type { GroupProps } from './types';

/** `select`: each question picks one option letter from a shared list. */
export function InteractionSelect({ group, controller }: GroupProps): React.JSX.Element {
  const options = Object.entries(group.options ?? {});
  const allowReuse = group.allowReuse ?? false;
  const questions = group.questions as StandardQuestion[];

  const usedByOthers = (currentId: string): Set<string> => {
    if (allowReuse) return new Set();
    const used = new Set<string>();
    for (const q of questions) {
      if (q.id === currentId) continue;
      const value = controller.getAnswer(q.id);
      if (typeof value === 'string' && value) used.add(value);
    }
    return used;
  };

  return (
    <ol className="space-y-3">
      {questions.map((q) => {
        const selected = controller.getAnswer(q.id);
        const disabledOptions = usedByOthers(q.id);
        return (
          <li key={q.id}>
            <QuestionFrame group={group} question={q} controller={controller}>
              {q.prompt && <p className="mb-2 text-slate-800">{q.prompt}</p>}
              <SelectField
                questionId={q.id}
                label={q.prompt ?? format(en.runner.navigator.goToQuestion, { n: q.number })}
                options={options}
                value={typeof selected === 'string' ? selected : ''}
                disabledOptions={disabledOptions}
                disabled={controller.submitted}
                onChange={(value) => controller.setAnswer(q.id, value)}
              />
            </QuestionFrame>
          </li>
        );
      })}
    </ol>
  );
}

function SelectField({
  questionId,
  label,
  options,
  value,
  disabledOptions,
  disabled,
  onChange,
}: {
  questionId: string;
  label: string;
  options: [string, string][];
  value: string;
  disabledOptions: Set<string>;
  disabled: boolean;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const id = useId();
  return (
    <>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-slate-900"
        data-testid={`select-${questionId}`}
      >
        <option value="">{en.runner.question.blankSelect}</option>
        {options.map(([key, label]) => (
          <option key={key} value={key} disabled={disabledOptions.has(key)}>
            {label === key ? key : `${key} — ${label}`}
          </option>
        ))}
      </select>
    </>
  );
}
