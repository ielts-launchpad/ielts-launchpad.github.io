import { useEffect, useRef, useState } from 'react';
import { brand } from '../../config/brand';
import { en } from '../../i18n/en';
import { format } from '../../i18n/format';
import { skillBand } from '../../exams/ielts/bands';
import { RunnerRepository } from '../../lib/storage/repository';
import { AudioPlayer } from '../runner/AudioPlayer';
import {
  answerLocationOffset,
  buildIssueUrl,
  buildResultsModel,
  type ResultInput,
  type ResultQuestionModel,
  type ResultsModel,
} from '../../engine/results/model';

const messages = en.results;
const linkClass = 'text-blue-800 underline decoration-2 underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4';
const buttonClass = 'min-h-11 rounded-lg border border-slate-500 px-4 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-4';

type LoadState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; record: ResultInput; model: ResultsModel };

function Context({ question, listening }: { question: ResultQuestionModel; listening: boolean }): React.JSX.Element | null {
  if (question.context === undefined) return null;
  const { context, highlight } = question;
  return (
    <details className="mt-3 rounded-lg border border-slate-300 p-3">
      <summary className="cursor-pointer font-medium focus-visible:outline-2 focus-visible:outline-offset-4">
        {listening ? messages.transcript : messages.passage}
      </summary>
      <p className="mt-3 whitespace-pre-wrap leading-relaxed">
        {highlight ? <>
          {context.slice(0, highlight.start)}
          <mark className="bg-yellow-200 text-slate-950">{context.slice(highlight.start, highlight.end)}</mark>
          {context.slice(highlight.end)}
        </> : context}
      </p>
    </details>
  );
}

export default function ResultsPage(): React.JSX.Element {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [playback, setPlayback] = useState<{ src: string; offset: number; id: number } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const attemptId = new URLSearchParams(window.location.search).get('attemptId');
        if (!attemptId?.trim()) {
          if (!cancelled) setState({ status: 'missing' });
          return;
        }
        // The stored snapshot is the source of truth, never current test files.
        const record: ResultInput | undefined = await new RunnerRepository().getResult(attemptId);
        if (!cancelled) setState(record
          ? { status: 'ready', record, model: buildResultsModel(record) }
          : { status: 'missing' });
      } catch {
        if (!cancelled) setState({ status: 'missing' });
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (state.status !== 'loading') heading.current?.focus();
  }, [state.status]);

  const playAnswer = (src: string, start: number): void => {
    setPlayback((previous) => ({ src, offset: answerLocationOffset(start), id: (previous?.id ?? 0) + 1 }));
  };

  if (state.status !== 'ready') return (
    <section className="space-y-4">
      <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4">
        {state.status === 'loading' ? messages.heading : messages.notFound}
      </h1>
      <p role="status">{state.status === 'loading' ? messages.loading : messages.notFoundDetail}</p>
      <a className={linkClass} href="/tests">{messages.testsLink}</a>
    </section>
  );

  const { model, record } = state;
  const band = model.canEstimateBand && model.variant
    ? skillBand(model.skill, model.variant, model.raw)
    : null;
  const initialAudio = model.skill === 'listening'
    ? model.questions.find((question) => question.audio)?.audio
    : undefined;

  return (
    <div className="min-w-0 space-y-8 break-words" data-testid="results-page">
      <header className="space-y-3">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-bold focus-visible:outline-2 focus-visible:outline-offset-4">{messages.heading}</h1>
        <p className="text-slate-700">{messages[model.skill]} · {model.testId}</p>
        <a className={linkClass} href="/tests">{messages.testsLink}</a>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-5">
          <dt className="font-medium">{messages.rawScore}</dt>
          <dd className="mt-2 text-3xl font-bold tabular-nums" data-testid="results-score">{model.raw}/{model.max}</dd>
        </div>
        {model.max === 40 ? <div className="rounded-xl border border-slate-300 bg-slate-50 p-5">
          <dt className="font-medium">{messages.estimatedBand}</dt>
          <dd className="mt-2 font-semibold" data-testid="results-band">{band ?? messages.unavailableBand}</dd>
          {band !== null && <dd className="mt-2 text-sm text-slate-700">{messages.bandDisclaimer}</dd>}
        </div> : <div className="rounded-xl border border-slate-300 bg-slate-50 p-5">
          <dt className="font-medium">{messages.percentage}</dt>
          <dd className="mt-2 text-3xl font-bold tabular-nums" data-testid="results-percentage">
            {format(messages.percentageValue, { percentage: model.percentage })}
          </dd>
          <dd className="mt-2 text-sm text-slate-700">{messages.partialBand}</dd>
        </div>}
      </dl>

      {initialAudio && <AudioPlayer src={playback?.src ?? initialAudio} mode="practice"
        audioLabel={messages.audioLabel} audioTestId="results-audio" playbackRequest={playback ?? undefined} />}

      <section aria-labelledby="results-breakdown" className="space-y-3">
        <h2 id="results-breakdown" className="text-2xl font-semibold">{messages.breakdown}</h2>
        {model.sections.length ? <ul className="space-y-2">
          {model.sections.map((section) => <li key={section.number} data-testid={`section-score-${section.number}`} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-300 p-4">
            <span>{format(messages.section, { number: section.number })}{section.title && `: ${section.title}`}</span>
            <span className="font-semibold tabular-nums">{section.raw}/{section.max}</span>
          </li>)}
        </ul> : <p>{messages.reviewUnavailable}</p>}
      </section>

      <section aria-labelledby="results-review" className="space-y-4">
        <h2 id="results-review" className="text-2xl font-semibold">{messages.review}</h2>
        {model.questions.map((question) => <article key={question.questionId}
          data-testid={`review-${question.questionId}`}
          aria-labelledby={`review-${question.questionId}`} className="min-w-0 rounded-xl border border-slate-300 p-4 sm:p-6">
          <h3 id={`review-${question.questionId}`} className="text-lg font-semibold">
            {format(messages.question, { numbers: question.numbers.join(', ') })}
          </h3>
          {question.prompt && <p className="mt-2">{question.prompt}</p>}
          <p className="mt-2 font-semibold">
            {question.correct ? messages.correct : question.marks > 0 ? messages.partiallyCorrect : messages.incorrect}
            {' · '}{question.marks}/{question.maxMarks}
          </p>
          <dl className="mt-4 space-y-3">
            <div><dt className="font-medium">{messages.userAnswer}</dt>
              <dd>{!question.hasSnapshot && !model.hasReview ? messages.unavailable
                : question.userAnswers.filter((answer) => answer.trim()).join('; ') || messages.noAnswer}</dd></div>
            <div><dt className="font-medium">{messages.correctAnswers}</dt>
              <dd>{question.correctAnswers.join('; ') || messages.unavailable}</dd></div>
            <div><dt className="font-medium">{messages.errorClass}</dt>
              <dd>{question.errorClass ? messages.errors[question.errorClass] : messages.noError}</dd></div>
            <div><dt className="font-medium">{messages.explanation}</dt>
              <dd>{typeof question.explanation === 'string' ? question.explanation
                : question.explanation && Object.keys(question.explanation).length > 0 ? <ul className="list-inside list-disc">
                  {Object.entries(question.explanation).map(([option, explanation]) => <li key={option}>{option}: {explanation}</li>)}
                </ul> : messages.noExplanation}</dd></div>
            <div><dt className="font-medium">{messages.evidence}</dt>
              <dd>{question.evidence ? <>
                <blockquote className="border-l-4 border-slate-300 pl-3">{question.evidence.quote}</blockquote>
                {!question.highlight && <p className="mt-2 text-sm">{messages.evidenceNotLocated}</p>}
              </> : messages.noEvidence}</dd></div>
          </dl>
          <Context question={question} listening={model.skill === 'listening'} />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            {model.skill === 'listening' && question.audio && question.evidence?.audioStart !== undefined &&
              <button type="button" className={buttonClass}
                onClick={() => playAnswer(question.audio!, question.evidence!.audioStart!)}>
                {messages.playAnswer}
              </button>}
            <a className={linkClass} href={buildIssueUrl(brand.repoUrl, model.testId, question.questionId,
              record.review?.answers[question.questionId] ?? null)}>{messages.issueLink}</a>
          </div>
        </article>)}
      </section>
    </div>
  );
}