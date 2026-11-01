import { describe, expect, it } from 'vitest';
import {
  allQuestionIds,
  answeredQuestionIds,
  findGroup,
  isAnswered,
  navigatorCells,
  toggleMultiSelection,
} from '../../src/engine/runner/answers';
import type { RunnerPassage } from '../../src/engine/runner/types';
import type { QuestionGroup } from '../../src/engine/content/schema';

function singleGroup(): QuestionGroup {
  return {
    id: 'g-single',
    instructions: 'Choose A, B or C.',
    interaction: 'single',
    qtype: 'multiple-choice',
    options: { A: 'a', B: 'b', C: 'c' },
    questions: [
      { id: 'q1', number: 1, prompt: 'One', answers: ['A'], evidence: { quote: 'x' } },
      { id: 'q2', number: 2, prompt: 'Two', answers: ['B'], evidence: { quote: 'y' } },
    ],
  };
}

function multiGroup(): QuestionGroup {
  return {
    id: 'g-multi',
    instructions: 'Choose TWO.',
    interaction: 'multi',
    qtype: 'choose-n',
    options: { A: 'a', B: 'b', C: 'c', D: 'd' },
    questions: [{ id: 'q3', numbers: [3, 4], n: 2, answers: ['A', 'D'] }],
  };
}

function passages(): RunnerPassage[] {
  return [
    {
      passage: 1,
      title: 'Test',
      paragraphs: [{ label: 'A', text: 'Prose.' }],
      groups: [singleGroup(), multiGroup()],
    },
  ];
}

describe('navigatorCells', () => {
  it('produces one cell per number, expanding multi questions, sorted', () => {
    const cells = navigatorCells(passages());
    expect(cells.map((c) => c.number)).toEqual([1, 2, 3, 4]);
    expect(cells.find((c) => c.number === 3)?.questionId).toBe('q3');
    expect(cells.find((c) => c.number === 4)?.questionId).toBe('q3');
  });
});

describe('isAnswered', () => {
  it('treats null/undefined/empty as unanswered', () => {
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered('   ')).toBe(false);
    expect(isAnswered([])).toBe(false);
  });

  it('treats a value or non-empty array as answered', () => {
    expect(isAnswered('A')).toBe(true);
    expect(isAnswered(['A'])).toBe(true);
  });
});

describe('answeredQuestionIds', () => {
  it('collects only answered question ids', () => {
    const ids = answeredQuestionIds(passages(), { q1: 'A', q2: '', q3: ['A'] });
    expect([...ids].sort()).toEqual(['q1', 'q3']);
  });
});

describe('toggleMultiSelection', () => {
  it('adds a new letter below the limit', () => {
    expect(toggleMultiSelection(['A'], 'D', 2)).toEqual({ next: ['A', 'D'], blocked: false });
  });

  it('removes an already-selected letter (deselect)', () => {
    expect(toggleMultiSelection(['A', 'D'], 'A', 2)).toEqual({ next: ['D'], blocked: false });
  });

  it('blocks a new letter once N are selected', () => {
    expect(toggleMultiSelection(['A', 'D'], 'B', 2)).toEqual({ next: ['A', 'D'], blocked: true });
  });

  it('allows deselect-then-select another after the limit is reached', () => {
    const afterDeselect = toggleMultiSelection(['A', 'D'], 'D', 2);
    expect(afterDeselect).toEqual({ next: ['A'], blocked: false });
    const afterReselect = toggleMultiSelection(afterDeselect.next, 'B', 2);
    expect(afterReselect).toEqual({ next: ['A', 'B'], blocked: false });
  });
});

describe('allQuestionIds / findGroup', () => {
  it('lists every question id', () => {
    expect(allQuestionIds(passages())).toEqual(['q1', 'q2', 'q3']);
  });

  it('finds the owning group of a question', () => {
    expect(findGroup(passages(), 'q3')?.id).toBe('g-multi');
    expect(findGroup(passages(), 'missing')).toBeNull();
  });
});
