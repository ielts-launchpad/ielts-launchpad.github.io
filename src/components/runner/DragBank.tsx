import { useState } from 'react';
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { StandardQuestion } from '@/engine/content/schema';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import type { GroupProps, RunnerController } from './types';

const t = en.runner.dragBank;

/**
 * `dragBank`: a word bank whose options are placed into `{{n}}` gaps in the
 * template. Supports pointer/touch drag (dnd-kit Mouse/Touch sensors) and
 * click/tap to select an option then activate a gap. Keyboard users use the
 * same select-then-place path with native buttons and Enter/Space.
 */
export function DragBank({ group, controller }: GroupProps): React.JSX.Element {
  const options = Object.entries(group.options ?? {});
  const questions = group.questions as StandardQuestion[];
  const byNumber = new Map(questions.map((q) => [q.number, q]));
  const allowReuse = group.allowReuse ?? false;
  const [selected, setSelected] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');

  const placements: Record<string, string> = {};
  for (const q of questions) {
    const value = controller.getAnswer(q.id);
    if (typeof value === 'string' && value) placements[q.id] = value;
  }
  const usedLetters = new Set(Object.values(placements));

  const place = (questionId: string, letter: string): void => {
    if (!allowReuse) {
      for (const [qid, placed] of Object.entries(placements)) {
        if (placed === letter && qid !== questionId) controller.setAnswer(qid, '');
      }
    }
    controller.setAnswer(questionId, letter);
    setSelected(null);
  };

  const clearSlot = (questionId: string): void => {
    controller.setAnswer(questionId, '');
    setLiveMessage(t.returned);
  };

  // Keyboard users operate the bank via the click-to-place path (focus a chip,
  // activate it, then focus a gap and activate it). A MouseSensor handles
  // pointer drags and a TouchSensor handles touch drags; neither intercepts
  // Enter/Space, so a chip's native click handler still fires for keyboard use.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const onDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event;
    if (!over) return;
    const letter = String(active.id).replace(/^chip-/, '');
    const questionId = String(over.id).replace(/^slot-/, '');
    place(questionId, letter);
  };

  const onSlotActivate = (questionId: string): void => {
    const current = placements[questionId];
    if (current) {
      clearSlot(questionId);
      return;
    }
    if (selected) {
      place(questionId, selected);
      return;
    }
    setLiveMessage(t.selectFirst);
  };

  const segments = (group.template ?? '').split(/(\{\{\d+\}\})/);

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
      <div
        className="whitespace-pre-wrap leading-9 text-slate-800"
        data-testid={`dragbank-template-${group.id}`}
      >
        {segments.map((segment, index) => {
          const match = /^\{\{(\d+)\}\}$/.exec(segment);
          if (!match) return <span key={index}>{segment}</span>;
          const question = byNumber.get(Number(match[1]));
          if (!question) return <span key={index}>{segment}</span>;
          const letter = placements[question.id] ?? '';
          return (
            <Slot
              key={index}
              question={question}
              letter={letter}
              word={letter ? (group.options?.[letter] ?? letter) : ''}
              disabled={controller.submitted}
              controller={controller}
              onActivate={() => onSlotActivate(question.id)}
            />
          );
        })}
      </div>

      <div className="mt-4">
        <p className="mb-1 text-sm font-medium text-slate-700" id={`bank-${group.id}`}>
          {t.bankHeading}
        </p>
        <ul className="flex flex-wrap gap-2" aria-labelledby={`bank-${group.id}`}>
          {options.map(([key, word]) => {
            const used = !allowReuse && usedLetters.has(key);
            return (
              <li key={key}>
                <BankChip
                  letter={key}
                  word={word}
                  used={used}
                  selected={selected === key}
                  disabled={controller.submitted}
                  onSelect={() => setSelected((prev) => (prev === key ? null : key))}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <p role="status" aria-live="polite" className="sr-only" data-testid="dragbank-live">
        {liveMessage}
      </p>
    </DndContext>
  );
}

function Slot({
  question,
  letter,
  word,
  disabled,
  controller,
  onActivate,
}: {
  question: StandardQuestion;
  letter: string;
  word: string;
  disabled: boolean;
  controller: RunnerController;
  onActivate: () => void;
}): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: `slot-${question.id}` });
  const label = letter
    ? format(t.filledSlot, { n: question.number, word })
    : format(t.emptySlot, { n: question.number });

  return (
    <button
      type="button"
      ref={(node) => {
        setNodeRef(node);
        controller.registerQuestion(question.id, node);
      }}
      onClick={onActivate}
      disabled={disabled}
      aria-label={label}
      data-testid={`slot-${question.id}`}
      data-letter={letter}
      className={`mx-1 inline-flex min-w-24 items-center justify-center rounded border px-2 py-1 align-baseline ${
        isOver ? 'border-slate-800 bg-slate-100' : 'border-dashed border-slate-500'
      } ${letter ? 'bg-slate-50 font-medium' : 'text-slate-600'}`}
    >
      {letter ? word : format(t.slotLabel, { n: question.number })}
    </button>
  );
}

function BankChip({
  letter,
  word,
  used,
  selected,
  disabled,
  onSelect,
}: {
  letter: string;
  word: string;
  used: boolean;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}): React.JSX.Element {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip-${letter}`,
    disabled: disabled || used,
  });

  return (
    <button
      type="button"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onSelect}
      disabled={disabled || used}
      aria-pressed={selected}
      aria-label={format(t.bankItem, { letter, word })}
      data-testid={`bank-${letter}`}
      className={`rounded border px-3 py-1 text-slate-900 ${
        selected ? 'border-slate-800 bg-slate-200' : 'border-slate-300 bg-white'
      } ${used ? 'opacity-40' : ''} ${isDragging ? 'opacity-50' : ''}`}
    >
      {word}
    </button>
  );
}
