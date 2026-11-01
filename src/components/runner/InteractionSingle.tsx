import { useId } from 'react';
import type { StandardQuestion } from '@/engine/content/schema';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { QuestionFrame } from './QuestionFrame';
import type { GroupProps } from './types';

/** `single`: one answer per question, rendered as an accessible radio group. */
export function InteractionSingle({ group, controller }: GroupProps): React.JSX.Element {
  const options = Object.entries(group.options ?? {});
  return (
    <ol className="space-y-3">
      {group.questions.map((question) => {
        const q = question as StandardQuestion;
        const selected = controller.getAnswer(q.id);
        const label = q.prompt ?? format(en.runner.navigator.goToQuestion, { n: q.number });
        return (
          <li key={q.id}>
            <QuestionFrame group={group} question={q} controller={controller}>
              {q.prompt && <p className="mb-2 text-slate-800">{q.prompt}</p>}
              <RadioGroup
                name={q.id}
                legend={label}
                options={options}
                value={typeof selected === 'string' ? selected : ''}
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

function RadioGroup({
  name,
  legend,
  options,
  value,
  disabled,
  onChange,
}: {
  name: string;
  legend: string;
  options: [string, string][];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const baseId = useId();
  return (
    <fieldset className="space-y-1" data-testid={`single-${name}`}>
      <legend className="sr-only">{legend}</legend>
      {options.map(([key, label]) => {
        const id = `${baseId}-${key}`;
        return (
          <div key={key} className="flex items-center gap-2">
            <input
              type="radio"
              id={id}
              name={name}
              value={key}
              checked={value === key}
              disabled={disabled}
              onChange={() => onChange(key)}
              className="h-4 w-4"
            />
            <label htmlFor={id} className="text-slate-800">
              <span className="font-medium">{key}</span>
              {label !== key && <span> — {label}</span>}
            </label>
          </div>
        );
      })}
    </fieldset>
  );
}
