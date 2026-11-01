import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from 'recharts';
import { buildDashboard, type Dashboard } from '../../engine/analytics/dashboard';
import { findTip, type PracticeTip } from '../../engine/analytics/tips';
import { SKILLS } from '../../engine/content/schema';
import { overallBand } from '../../exams/ielts/bands';
import { en } from '../../i18n/en';
import { toDashboardResults } from '../../lib/analytics/dashboard-results';
import { getDb } from '../../lib/storage/db';
import { RunnerRepository } from '../../lib/storage/repository';

const copy = en.dashboard;
const cell = 'border-b border-slate-300 px-3 py-3 text-left';
const panel = 'min-w-0 rounded-xl border border-slate-300 bg-white p-4 sm:p-6';
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900';
const series = [
  { key: 'reading', label: en.catalog.skills.reading, color: '#1e3a8a', dash: '0' },
  { key: 'listening', label: en.catalog.skills.listening, color: '#166534', dash: '8 4' },
  { key: 'writing', label: en.catalog.skills.writing, color: '#9d174d', dash: '2 3' },
  { key: 'speaking', label: en.catalog.skills.speaking, color: '#6b21a8', dash: '10 3 2 3' },
  { key: 'overall', label: copy.overall, color: '#0f172a', dash: '12 5' },
] as const;
const bandText = (value: number | null): string => value === null ? copy.missing : String(value);
const dateText = (value: number): string => new Date(value).toLocaleDateString('en', {
  year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
});

function ScrollTable({ label, children }: { label: string; children: ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0} className={`mt-4 max-w-full overflow-x-auto ${focus}`}>
    <table className="w-full border-collapse text-sm">{children}</table>
  </div>;
}

/** Pure view also supports rendering recommendations without browser storage. */
export function DashboardView({ dashboard, tips }: { dashboard: Dashboard; tips: readonly PracticeTip[] }) {
  return <div className="grid min-w-0 gap-6" data-testid="dashboard-data">
    <section className={panel} aria-labelledby="dashboard-current">
      <h2 id="dashboard-current" className="text-xl font-semibold">{copy.current}</h2>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
        {SKILLS.map((skill) => <div key={skill}>
          <dt className="text-slate-700">{en.catalog.skills[skill]}</dt>
          <dd className="mt-1 text-3xl font-bold" data-testid={`current-${skill}`}>{bandText(dashboard.latestBands[skill])}</dd>
        </div>)}
        <div><dt className="text-slate-700">{copy.overall}</dt>
          <dd className="mt-1 text-3xl font-bold" data-testid="current-overall">{bandText(dashboard.currentBand)}</dd></div>
      </dl>
      <p className="mt-4 text-sm text-slate-700">{copy.fullOnly}</p>
      <p className="mt-2 text-sm text-slate-700">{copy.disclaimer}</p>
    </section>

    <section className={panel} aria-labelledby="dashboard-history">
      <h2 id="dashboard-history" className="text-xl font-semibold">{copy.history}</h2>
      {dashboard.history.length === 0 ? <p className="mt-4">{copy.noHistory}</p> : <>
        <p className="mt-3">{copy.chartSummary}</p>
        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2" aria-label={copy.chartLabel}>
          {series.map((entry) => <li key={entry.key} className="flex items-center gap-2">
            <svg width="32" height="12" aria-hidden="true"><line x1="0" x2="32" y1="6" y2="6" stroke={entry.color} strokeWidth="3" strokeDasharray={entry.dash} /></svg>
            {entry.label}
          </li>)}
        </ul>
        <div className="mt-4 h-64 min-w-0 w-full" aria-hidden="true" data-testid="dashboard-chart">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <LineChart data={dashboard.history} accessibilityLayer={false} margin={{ top: 12, right: 12, bottom: 12, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="createdAt" tickFormatter={dateText} minTickGap={35} tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 9]} ticks={[0, 3, 6, 9]} width={28} tick={{ fontSize: 12 }} />
              {series.map((entry) => <Line key={entry.key} dataKey={entry.key} name={entry.label} stroke={entry.color}
                strokeDasharray={entry.dash} strokeWidth={2} dot={{ r: 4 }} connectNulls isAnimationActive={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <ScrollTable label={copy.history}>
          <caption className="sr-only">{copy.history}</caption>
          <thead><tr><th scope="col" className={cell}>{copy.date}</th>{series.map((entry) => <th key={entry.key} scope="col" className={cell}>{entry.label}</th>)}</tr></thead>
          <tbody>{dashboard.history.map((entry) => <tr key={entry.attemptId} data-testid="history-row">
            <th scope="row" className={`${cell} whitespace-nowrap`}><time dateTime={new Date(entry.createdAt).toISOString()}>{dateText(entry.createdAt)}</time></th>
            {series.map((column) => <td key={column.key} className={cell}>{bandText(entry[column.key])}</td>)}
          </tr>)}</tbody>
        </ScrollTable>
      </>}
    </section>

    <section className={panel} aria-labelledby="dashboard-accuracy">
      <h2 id="dashboard-accuracy" className="text-xl font-semibold">{copy.accuracy}</h2>
      {dashboard.unknownQuestionTypes > 0 && <p className="mt-3" data-testid="dashboard-legacy">{copy.legacy}</p>}
      {dashboard.accuracy.length === 0 ? <p className="mt-4">{copy.noAccuracy}</p> : <ScrollTable label={copy.accuracy}>
        <caption className="sr-only">{copy.accuracy}</caption>
        <thead><tr>{[copy.questionType, copy.marks, copy.maximum, copy.percentage].map((label) => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
        <tbody>{dashboard.accuracy.map((entry) => <tr key={entry.qtype} data-testid={`accuracy-${entry.qtype}`}>
          <th scope="row" className={cell}>{copy.qtypes[entry.qtype]}</th><td className={cell}>{entry.marks}</td>
          <td className={cell}>{entry.maxMarks}</td><td className={cell}>{Math.round(entry.percentage)}%</td>
        </tr>)}</tbody>
      </ScrollTable>}
    </section>

    <section className={panel} aria-labelledby="dashboard-errors">
      <h2 id="dashboard-errors" className="text-xl font-semibold">{copy.errors}</h2>
      <p className="mt-3">{copy.errorsDetail}</p>
      <ScrollTable label={copy.errors}>
        <caption className="sr-only">{copy.errors}</caption>
        <thead><tr><th scope="col" className={cell}>{copy.errorType}</th><th scope="col" className={cell}>{copy.count}</th></tr></thead>
        <tbody>{Object.entries(dashboard.errors).map(([error, count]) => <tr key={error} data-testid={`error-${error}`}>
          <th scope="row" className={cell}>{en.results.errors[error as keyof typeof dashboard.errors]}</th><td className={cell}>{count}</td>
        </tr>)}</tbody>
      </ScrollTable>
    </section>

    <section className={panel} aria-labelledby="dashboard-weaknesses">
      <h2 id="dashboard-weaknesses" className="text-xl font-semibold">{copy.weaknesses}</h2>
      {dashboard.weaknesses.length === 0 ? <p className="mt-4">{copy.noWeaknesses}</p> : <ol className="mt-4 grid gap-4">
        {dashboard.weaknesses.map((entry) => <li key={entry.qtype} className="rounded-lg bg-slate-50 p-4" data-testid={`weakness-${entry.qtype}`}>
          <h3 className="font-semibold">{copy.qtypes[entry.qtype]}</h3>
          <p className="mt-1 text-sm">{copy.percentage}: {Math.round(entry.percentage)}% · {copy.marks}: {entry.marks}/{entry.maxMarks}</p>
          <p className="mt-2"><span className="font-semibold">{copy.recommendation}: </span>{findTip(tips, entry.qtype) ?? copy.fallbackTip}</p>
        </li>)}
      </ol>}
    </section>
  </div>;
}

type LoadState = { status: 'loading' | 'error' | 'empty' } | { status: 'ready'; dashboard: Dashboard };

export default function DashboardPage({ tips }: { tips: PracticeTip[] }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const mounted = useRef(false);
  const pending = useRef(false);
  const focusAfterRetry = useRef(false);
  const status = useRef<HTMLParagraphElement>(null);

  async function load(): Promise<void> {
    if (pending.current) return;
    pending.current = true;
    setState({ status: 'loading' });
    try {
      // Explicit open permits retry after Dexie cached an earlier open failure.
      await getDb().open();
      const records = await new RunnerRepository().listResults();
      const dashboard = buildDashboard(toDashboardResults(records), overallBand);
      if (mounted.current) setState(records.length ? { status: 'ready', dashboard } : { status: 'empty' });
    } catch {
      if (mounted.current) setState({ status: 'error' });
    } finally { pending.current = false; }
  }

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (focusAfterRetry.current && state.status !== 'loading') {
      status.current?.focus();
      focusAfterRetry.current = false;
    }
  }, [state]);

  const message = state.status === 'ready' ? copy.current : copy[state.status];
  return <div className="mt-6 min-w-0" data-testid="dashboard-page" aria-busy={state.status === 'loading'}>
    <p ref={status} tabIndex={-1} role="status" data-testid="dashboard-status" className={state.status === 'ready' ? 'sr-only' : 'text-slate-700'}>{message}</p>
    {state.status === 'error' && <button type="button" className={`mt-4 min-h-11 rounded border-2 border-slate-700 px-4 py-2 ${focus}`}
      onClick={() => { focusAfterRetry.current = true; void load(); }}>{copy.retry}</button>}
    {state.status === 'empty' && <a href="/tests" className={`mt-4 inline-block py-3 font-semibold underline ${focus}`}>{copy.testsLink}</a>}
    {state.status === 'ready' && <DashboardView dashboard={state.dashboard} tips={tips} />}
  </div>;
}