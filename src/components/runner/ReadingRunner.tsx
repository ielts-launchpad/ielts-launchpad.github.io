import { useMemo, useState } from 'react';
import type { ReadingRunnerData, RunnerMode } from '@/engine/runner/types';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { GroupView } from './GroupView';
import { Navigator } from './Navigator';
import { PassagePane } from './PassagePane';
import { Timer } from './Timer';
import { useRunner } from './useRunner';

const t = en.runner;

type MobileTab = 'passage' | 'questions';

function resolveMode(kind: ReadingRunnerData['kind']): RunnerMode {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('mode');
    if (param === 'exam' || param === 'practice') return param;
  }
  return kind === 'mock' ? 'exam' : 'practice';
}

interface ReadingRunnerProps {
  data: ReadingRunnerData;
}

/** Root island for the Reading runner (SPEC §5). */
export function ReadingRunner({ data }: ReadingRunnerProps): React.JSX.Element {
  const [mode] = useState<RunnerMode>(() => resolveMode(data.kind));
  const runner = useRunner(data, mode);
  const [tab, setTab] = useState<MobileTab>('passage');
  const [confirming, setConfirming] = useState(false);

  const groups = useMemo(
    () => data.passages.flatMap((passage) => passage.groups.map((group) => ({ group, passage }))),
    [data.passages],
  );

  if (runner.loading) {
    return (
      <p role="status" className="p-6 text-slate-600">
        {t.reading.loading}
      </p>
    );
  }

  const onNavigate = (questionId: string): void => {
    setTab('questions');
    runner.focusQuestion(questionId);
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      {data.isDraft && (
        <p className="mb-3 rounded bg-amber-100 px-3 py-2 text-sm text-amber-900" role="note">
          {t.reading.draftNotice}
        </p>
      )}

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700"
            data-testid="runner-mode"
          >
            {mode === 'exam' ? t.toolbar.modeExam : t.toolbar.modePractice}
          </span>
          {mode === 'exam' && runner.timerStartedAt !== null && !runner.submitted && (
            <Timer
              startMs={runner.timerStartedAt}
              durationSec={data.durationSec}
              onExpire={runner.submit}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{t.toolbar.fontSizeLabel}</span>
          <button
            type="button"
            onClick={() => runner.setFontScale(runner.fontScale - 0.1)}
            data-testid="font-decrease"
            className="h-8 w-8 rounded border border-slate-300 text-slate-700"
          >
            <span aria-hidden="true">A−</span>
            <span className="sr-only">{t.toolbar.fontDecrease}</span>
          </button>
          <button
            type="button"
            onClick={() => runner.setFontScale(runner.fontScale + 0.1)}
            data-testid="font-increase"
            className="h-8 w-8 rounded border border-slate-300 text-slate-700"
          >
            <span aria-hidden="true">A+</span>
            <span className="sr-only">{t.toolbar.fontIncrease}</span>
          </button>
        </div>
      </header>

      <div className="mb-3 flex gap-2 md:hidden" role="tablist" aria-label={t.reading.title}>
        <TabButton active={tab === 'passage'} onClick={() => setTab('passage')} testId="tab-passage">
          {t.reading.passageTab}
        </TabButton>
        <TabButton
          active={tab === 'questions'}
          onClick={() => setTab('questions')}
          testId="tab-questions"
        >
          {t.reading.questionsTab}
        </TabButton>
      </div>

      <div
        className="grid gap-6 md:grid-cols-2"
        style={{ fontSize: `${runner.fontScale}rem` }}
        data-testid="runner-content"
      >
        <section
          aria-label={t.reading.passageHeading}
          className={`${tab === 'passage' ? 'block' : 'hidden'} md:block`}
          data-testid="passage-section"
        >
          <PassagePane
            passages={data.passages}
            highlights={runner.highlights}
            onAddHighlight={runner.addHighlight}
            onRemoveHighlight={runner.removeHighlight}
          />
        </section>

        <section
          aria-label={t.reading.questionsHeading}
          className={`${tab === 'questions' ? 'block' : 'hidden'} md:block`}
          data-testid="questions-section"
        >
          <div className="mb-4">
            <Navigator
              passages={data.passages}
              answers={runner.answers}
              flagged={runner.flagged}
              onNavigate={onNavigate}
            />
          </div>

          <div className="space-y-8">
            {groups.map(({ group }) => (
              <GroupView key={group.id} group={group} controller={runner.controller} />
            ))}
          </div>

          <div className="mt-8">
            {runner.submitted && runner.result ? (
              <div
                role="status"
                className="rounded border border-green-300 bg-green-50 p-4"
                data-testid="result-banner"
              >
                <h2 className="mb-1 font-semibold text-green-900">{t.result.heading}</h2>
                <p className="text-green-900" data-testid="result-score">
                  {format(t.result.score, { raw: runner.result.raw, max: runner.result.max })}
                </p>
              </div>
            ) : confirming ? (
              <div className="rounded border border-slate-300 p-4" data-testid="submit-confirm">
                <p className="mb-2 text-slate-800">{t.toolbar.submitConfirm}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={runner.submit}
                    className="rounded bg-slate-800 px-4 py-2 text-white"
                    data-testid="submit-confirm-yes"
                  >
                    {t.toolbar.submit}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(false)}
                    className="rounded border border-slate-300 px-4 py-2 text-slate-700"
                    data-testid="submit-confirm-cancel"
                  >
                    {t.result.close}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="rounded bg-slate-800 px-4 py-2 text-white"
                data-testid="submit-button"
              >
                {t.toolbar.submit}
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  testId,
  children,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      data-testid={testId}
      className={`flex-1 rounded px-3 py-2 text-sm font-medium ${
        active ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {children}
    </button>
  );
}
