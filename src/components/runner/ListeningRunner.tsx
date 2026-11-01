import { useCallback, useMemo, useState } from 'react';
import type { AnswerMap, ListeningRunnerData, ReadingRunnerData } from '@/engine/runner/types';
import { resolveRunnerMode } from '@/engine/runner/mode';
import { initialListeningState, LISTENING_REVIEW_SEC, transitionListening, type ListeningEvent } from '@/engine/runner/listening';
import type { ResultReview } from '@/engine/results/model';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import { AudioPlayer } from './AudioPlayer';
import { GroupView } from './GroupView';
import { Navigator } from './Navigator';
import { Timer } from './Timer';
import { useRunner } from './useRunner';

const t = en.runner;

/** Listening shares M3 questions and persistence, without exposing transcripts until results. */
export function ListeningRunner({ data }: { data: ListeningRunnerData }): React.JSX.Element {
  const [mode] = useState(() => resolveRunnerMode(data.kind, window.location.search));
  const [autoPlay, setAutoPlay] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const adapter = useMemo<ReadingRunnerData>(() => ({
    ...data, durationSec: 0,
    passages: data.parts.map((part) => ({ passage: part.part, title: '', paragraphs: [], groups: part.groups })),
  }), [data]);
  const buildReview = useCallback((answers: AnswerMap): ResultReview => ({
    answers: structuredClone(answers), variant: data.variant, kind: data.kind,
    sections: data.parts.map((part) => ({
      number: part.part, title: '', text: part.transcript, audio: part.audio, groups: structuredClone(part.groups),
    })),
  }), [data]);
  const runner = useRunner(adapter, mode, 'listening', buildReview);
  const state = runner.listening ?? initialListeningState();
  const part = data.parts[state.partIndex] ?? data.parts[0];

  const dispatch = (event: ListeningEvent): void => {
    const next = transitionListening(state, event, mode, data.parts.length, Date.now());
    if (next !== state) runner.setListening(next);
    if (next.phase === 'submitted') runner.submit();
  };

  if (runner.loading) return <p role="status" data-testid="save-status" className="p-6 text-slate-700">
    {runner.saveError ? t.toolbar.saveError : t.toolbar.loading}
  </p>;

  return (
    <div data-testid="listening-runner" data-saved={runner.saved} data-phase={state.phase} className="space-y-6">
      <h1 className="text-3xl font-bold text-slate-900">{t.listening.title}</h1>
      {data.isDraft && <p role="note" className="rounded bg-amber-100 p-3 text-sm text-amber-950">
        {t.reading.draftNotice} {data.testId === 'sample-01' || data.testId === 'mock-listening-fixture' ? t.listening.sampleAudio : ''}
      </p>}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <span data-testid="runner-mode" className="rounded bg-slate-200 px-3 py-1 text-sm text-slate-900">
          {mode === 'exam' ? t.toolbar.modeExam : t.toolbar.modePractice}
        </span>
        <p role="status" aria-live="polite" data-testid="save-status" className="text-sm text-slate-700">
          {runner.saveError ? t.toolbar.saveError : runner.saved ? t.toolbar.saved : t.toolbar.saving}
        </p>
        <div className="flex items-center gap-2">
          <span>{t.toolbar.fontSizeLabel}</span>
          <button type="button" className="min-h-11 rounded border border-slate-400 px-3" data-testid="font-decrease"
            onClick={() => runner.setFontScale(runner.fontScale - 0.1)}>
            <span aria-hidden="true">A−</span><span className="sr-only">{t.toolbar.fontDecrease}</span>
          </button>
          <button type="button" className="min-h-11 rounded border border-slate-400 px-3" data-testid="font-increase"
            onClick={() => runner.setFontScale(runner.fontScale + 0.1)}>
            <span aria-hidden="true">A+</span><span className="sr-only">{t.toolbar.fontIncrease}</span>
          </button>
        </div>
      </header>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" style={{ fontSize: `${runner.fontScale}rem` }}>
        <section aria-label={t.listening.audioLabel} className="min-w-0 space-y-4">
          <h2 className="text-xl font-semibold" data-testid="listening-part">{format(t.listening.part, { n: part.part })}</h2>
          {mode === 'practice' && <label className="block">
            {t.listening.partSelect}
            <select value={state.partIndex} disabled={runner.submitted} data-testid="part-select" className="ml-2 rounded border border-slate-400 p-2"
              onChange={(event) => { setAutoPlay(false); dispatch({ type: 'part', index: Number(event.target.value) }); }}>
              {data.parts.map((item, index) => <option key={item.part} value={index}>{format(t.listening.part, { n: item.part })}</option>)}
            </select>
          </label>}
          <AudioPlayer key={state.partIndex} src={part.audio} durationSec={part.durationSec} startOffset={state.position}
            mode={mode} disabled={runner.submitted || state.phase === 'review'} autoPlay={autoPlay}
            resume={state.phase === 'playing'} onStarted={() => {
              setAutoPlay(true);
              if (state.phase !== 'playing') dispatch({ type: 'play' });
            }} onPaused={() => {
              setAutoPlay(false);
              dispatch({ type: 'pause' });
            }} onProgress={(position) => {
              if ((mode === 'practice' || state.phase === 'playing') && Math.floor(position) !== Math.floor(state.position)) {
                runner.setListening({ ...state, position });
              }
            }} onEnded={() => dispatch({ type: 'ended' })} />
          {state.phase === 'review' && state.reviewStartedAt !== null && !runner.submitted && (
            <section aria-label={t.listening.reviewTimer} data-testid="listening-review" className="rounded border border-amber-300 bg-amber-50 p-4">
              <h2 className="mb-2 font-semibold text-amber-950">{t.listening.review}</h2>
              <Timer startMs={state.reviewStartedAt} durationSec={LISTENING_REVIEW_SEC} onExpire={() => dispatch({ type: 'tick' })} />
            </section>
          )}
        </section>
        <section aria-label={t.listening.heading} className="min-w-0 space-y-6" data-testid="listening-questions">
          <Navigator passages={adapter.passages} answers={runner.answers} flagged={runner.flagged} onNavigate={runner.focusQuestion} />
          {data.parts.map((item) => <section key={item.part} className="space-y-4" aria-label={format(t.listening.part, { n: item.part })}>
            <h2 className="text-xl font-semibold">{format(t.listening.part, { n: item.part })}</h2>
            {item.groups.map((group) => <GroupView key={group.id} group={group} controller={runner.controller} />)}
          </section>)}
          {runner.submitted && runner.result ? <div role="status" data-testid="result-banner" className="rounded border border-green-300 bg-green-50 p-4 text-green-950">
            <p data-testid="result-score">{format(t.result.score, { raw: runner.result.raw, max: runner.result.max })}</p>
            {runner.saved && <a href={runner.resultUrl} data-testid="results-link" className="mt-3 inline-block font-semibold underline">{t.result.view}</a>}
          </div> : confirming ? <div className="space-y-3 rounded border border-slate-300 p-4">
            <p>{t.toolbar.submitConfirm}</p>
            <button type="button" className="min-h-11 rounded bg-slate-800 px-4 text-white" data-testid="submit-confirm-yes" onClick={runner.submit}>{t.toolbar.submit}</button>
            <button type="button" className="ml-3 min-h-11 rounded border border-slate-400 px-4" onClick={() => setConfirming(false)}>{t.result.close}</button>
          </div> : <button type="button" className="min-h-11 rounded bg-slate-800 px-4 py-2 text-white disabled:opacity-50"
            disabled={mode === 'exam' && state.phase !== 'review'} data-testid="submit-button" onClick={() => setConfirming(true)}>{t.toolbar.submit}</button>}
        </section>
      </div>
    </div>
  );
}