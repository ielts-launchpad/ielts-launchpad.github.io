import { useEffect, useRef, useState } from 'react';
import {
  dueWarnings,
  formatClock,
  isExpired,
  remainingSec,
  type WarningThreshold,
} from '@/engine/runner/timer';
import { en } from '@/i18n/en';

const t = en.runner.timer;

const WARNING_MESSAGE: Record<WarningThreshold, string> = {
  600: t.warningTen,
  300: t.warningFive,
};

interface TimerProps {
  /** Epoch ms when the countdown started. */
  startMs: number;
  durationSec: number;
  /** Called once when the countdown reaches zero (exam-mode auto-submit). */
  onExpire: () => void;
}

/** Exam-mode countdown. The UI owns the clock so fake clocks can drive it. */
export function Timer({ startMs, durationSec, onExpire }: TimerProps): React.JSX.Element {
  const [remaining, setRemaining] = useState(() => remainingSec(startMs, durationSec, Date.now()));
  const [message, setMessage] = useState('');
  const prevRef = useRef(remaining);
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = (): void => {
      const next = remainingSec(startMs, durationSec, Date.now());
      for (const threshold of dueWarnings(prevRef.current, next)) {
        setMessage(WARNING_MESSAGE[threshold]);
      }
      prevRef.current = next;
      setRemaining(next);
      if (isExpired(next) && !firedRef.current) {
        firedRef.current = true;
        setMessage(t.expired);
        onExpire();
      }
    };
    const id = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(id);
  }, [startMs, durationSec, onExpire]);

  const low = remaining <= 300;

  return (
    <div className="flex items-center gap-2" data-testid="timer">
      <span className="text-sm text-slate-600">{t.label}</span>
      <span
        className={`font-mono text-lg font-semibold ${low ? 'text-red-700' : 'text-slate-900'}`}
        data-testid="timer-clock"
        data-remaining={remaining}
      >
        {formatClock(remaining)}
      </span>
      <span role="status" aria-live="assertive" className="sr-only" data-testid="timer-announce">
        {message}
      </span>
    </div>
  );
}
