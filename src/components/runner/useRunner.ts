import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gradeQuestion, type QuestionResult, type UserResponse } from '@/engine/grading/grade';
import type { Question, QuestionGroup } from '@/engine/content/schema';
import type { AnswerMap, ReadingRunnerData, RunnerMode } from '@/engine/runner/types';
import { RunnerRepository } from '@/lib/storage/repository';
import type { HighlightRecord } from '@/lib/storage/db';
import type { RunnerController } from './types';

interface UseRunnerResult {
  loading: boolean;
  controller: RunnerController;
  answers: AnswerMap;
  flagged: Set<string>;
  highlights: HighlightRecord[];
  submitted: boolean;
  result: { raw: number; max: number } | null;
  fontScale: number;
  setFontScale: (scale: number) => void;
  mode: RunnerMode;
  timerStartedAt: number | null;
  submit: () => void;
  focusQuestion: (questionId: string) => void;
  addHighlight: (
    passage: number,
    paragraphIndex: number,
    start: number,
    end: number,
    quote: string,
  ) => void;
  removeHighlight: (id: string) => void;
}

const FONT_SETTING_KEY = 'reading.fontScale';

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Owns persistence, autosave, grading and timer state for the reading runner. */
export function useRunner(data: ReadingRunnerData, mode: RunnerMode): UseRunnerResult {
  const repoRef = useRef<RunnerRepository | null>(null);
  const attemptIdRef = useRef<string>('');
  const answersRef = useRef<AnswerMap>({});
  const nodes = useRef(new Map<string, HTMLElement>());

  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [highlights, setHighlights] = useState<HighlightRecord[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<{ raw: number; max: number } | null>(null);
  const [fontScale, setFontScaleState] = useState(1);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    let active = true;
    const repo = new RunnerRepository();
    repoRef.current = repo;

    void (async () => {
      const existing = await repo.latestInProgress(data.testId, 'reading');
      const now = Date.now();
      let attemptId: string;
      if (existing) {
        attemptId = existing.id;
        const saved = await repo.getAnswers(attemptId);
        const savedHighlights = await repo.getHighlights(attemptId);
        if (!active) return;
        attemptIdRef.current = attemptId;
        answersRef.current = saved;
        setAnswers(saved);
        setFlagged(new Set(existing.flagged));
        setHighlights(savedHighlights);
        setFontScaleState(existing.fontScale || 1);
        setTimerStartedAt(existing.timerStartedAt ?? null);
      } else {
        attemptId = newId();
        const timerStart = mode === 'exam' ? now : undefined;
        await repo.createAttempt({
          id: attemptId,
          testId: data.testId,
          skill: 'reading',
          mode,
          status: 'in-progress',
          startedAt: now,
          updatedAt: now,
          timerStartedAt: timerStart,
          flagged: [],
          fontScale: 1,
        });
        if (!active) return;
        attemptIdRef.current = attemptId;
        setTimerStartedAt(timerStart ?? null);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [data.testId, mode]);

  const setAnswer = useCallback((questionId: string, response: UserResponse): void => {
    setAnswers((prev) => {
      const next = { ...prev, [questionId]: response };
      answersRef.current = next;
      return next;
    });
    void repoRef.current?.upsertAnswer(attemptIdRef.current, questionId, response);
  }, []);

  const toggleFlag = useCallback((questionId: string): void => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      void repoRef.current?.updateAttempt(attemptIdRef.current, { flagged: [...next] });
      return next;
    });
  }, []);

  const checkAnswer = useCallback((questionId: string): void => {
    setChecked((prev) => new Set(prev).add(questionId));
  }, []);

  const registerQuestion = useCallback((questionId: string, node: HTMLElement | null): void => {
    if (node) nodes.current.set(questionId, node);
    else nodes.current.delete(questionId);
  }, []);

  const focusQuestion = useCallback((questionId: string): void => {
    const node = nodes.current.get(questionId);
    if (!node) return;
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.focus();
  }, []);

  const setFontScale = useCallback((scale: number): void => {
    const clamped = Math.min(1.6, Math.max(0.8, Number(scale.toFixed(2))));
    setFontScaleState(clamped);
    void repoRef.current?.updateAttempt(attemptIdRef.current, { fontScale: clamped });
    void repoRef.current?.setSetting(FONT_SETTING_KEY, clamped);
  }, []);

  const addHighlight = useCallback(
    (passage: number, paragraphIndex: number, start: number, end: number, quote: string): void => {
      const record: HighlightRecord = {
        id: newId(),
        attemptId: attemptIdRef.current,
        passage,
        paragraphIndex,
        start,
        end,
        quote,
        note: '',
        createdAt: Date.now(),
      };
      setHighlights((prev) => [...prev, record]);
      void repoRef.current?.addHighlight(record);
    },
    [],
  );

  const removeHighlight = useCallback((id: string): void => {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    void repoRef.current?.removeHighlight(id);
  }, []);

  const gradeOne = useCallback(
    (group: QuestionGroup, question: Question): QuestionResult =>
      gradeQuestion(group, question, answersRef.current[question.id] ?? null),
    [],
  );

  const submit = useCallback((): void => {
    const results: QuestionResult[] = [];
    for (const passage of data.passages) {
      for (const group of passage.groups) {
        for (const question of group.questions) {
          results.push(gradeQuestion(group, question, answersRef.current[question.id] ?? null));
        }
      }
    }
    const raw = results.reduce((sum, r) => sum + r.marks, 0);
    const max = results.reduce((sum, r) => sum + r.maxMarks, 0);
    const now = Date.now();
    setSubmitted(true);
    setResult({ raw, max });
    void repoRef.current?.saveResult({
      attemptId: attemptIdRef.current,
      testId: data.testId,
      skill: 'reading',
      raw,
      max,
      results,
      createdAt: now,
    });
    void repoRef.current?.updateAttempt(attemptIdRef.current, {
      status: 'submitted',
      submittedAt: now,
    });
  }, [data]);

  const controller = useMemo<RunnerController>(
    () => ({
      mode,
      submitted,
      getAnswer: (questionId) => answers[questionId],
      setAnswer,
      isFlagged: (questionId) => flagged.has(questionId),
      toggleFlag,
      isChecked: (questionId) => checked.has(questionId),
      checkAnswer,
      gradeOne,
      registerQuestion,
    }),
    [
      mode,
      submitted,
      answers,
      flagged,
      checked,
      setAnswer,
      toggleFlag,
      checkAnswer,
      gradeOne,
      registerQuestion,
    ],
  );

  return {
    loading,
    controller,
    answers,
    flagged,
    highlights,
    submitted,
    result,
    fontScale,
    setFontScale,
    mode,
    timerStartedAt,
    submit,
    focusQuestion,
    addHighlight,
    removeHighlight,
  };
}
