import { useMemo } from 'react';
import {
  answeredQuestionIds,
  navigatorCells,
  type NavigatorCell,
} from '@/engine/runner/answers';
import type { AnswerMap, RunnerPassage } from '@/engine/runner/types';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';

const t = en.runner.navigator;

interface NavigatorProps {
  passages: RunnerPassage[];
  answers: AnswerMap;
  flagged: Set<string>;
  onNavigate: (questionId: string, passage: number) => void;
}

/** 1–40 question navigator with answered/flagged status (SPEC §5). */
export function Navigator({ passages, answers, flagged, onNavigate }: NavigatorProps): React.JSX.Element {
  const cells = useMemo(() => navigatorCells(passages), [passages]);
  const answered = useMemo(() => answeredQuestionIds(passages, answers), [passages, answers]);
  const answeredCount = answered.size;
  const flaggedCount = flagged.size;

  return (
    <nav aria-label={t.heading} data-testid="navigator">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">{t.heading}</h2>
      <p className="mb-2 text-xs text-slate-600">
        {answeredCount} {t.answered} · {flaggedCount} {t.flagged}
      </p>
      <ol className="flex flex-wrap gap-1">
        {cells.map((cell) => (
          <li key={cell.number}>
            <NavigatorButton
              cell={cell}
              isAnswered={answered.has(cell.questionId)}
              isFlagged={flagged.has(cell.questionId)}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ol>
    </nav>
  );
}

function stateLabel(isAnswered: boolean, isFlagged: boolean): string {
  if (isAnswered && isFlagged) return t.stateAnsweredFlagged;
  if (isFlagged) return t.stateFlagged;
  if (isAnswered) return t.stateAnswered;
  return t.stateUnanswered;
}

function NavigatorButton({
  cell,
  isAnswered,
  isFlagged,
  onNavigate,
}: {
  cell: NavigatorCell;
  isAnswered: boolean;
  isFlagged: boolean;
  onNavigate: (questionId: string, passage: number) => void;
}): React.JSX.Element {
  const state = stateLabel(isAnswered, isFlagged);
  return (
    <button
      type="button"
      onClick={() => onNavigate(cell.questionId, cell.passage)}
      aria-label={format(t.status, { n: cell.number, state })}
      data-testid={`nav-${cell.number}`}
      data-answered={isAnswered}
      data-flagged={isFlagged}
      className={`relative h-8 w-8 rounded border text-xs font-medium ${
        isAnswered ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-700'
      }`}
    >
      {cell.number}
      {isFlagged && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500"
        />
      )}
    </button>
  );
}
