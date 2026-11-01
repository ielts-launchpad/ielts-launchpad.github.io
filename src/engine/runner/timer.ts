/**
 * Pure countdown-timer logic for the Reading runner (SPEC §5). The UI owns the
 * wall clock (so Playwright's fake clock can drive it); these helpers decide
 * which warnings are due and when the attempt must auto-submit. No timers or
 * side effects here — just arithmetic over "seconds remaining".
 */

/** Reading section length: 60 minutes (SPEC §5). */
export const READING_DURATION_SEC = 3600;

/** Warning thresholds in seconds: 10 minutes and 5 minutes remaining (SPEC §5). */
export const WARNING_THRESHOLDS_SEC = [600, 300] as const;

export type WarningThreshold = (typeof WARNING_THRESHOLDS_SEC)[number];

/** Seconds remaining given a start time, duration, and the current time. */
export function remainingSec(startMs: number, durationSec: number, nowMs: number): number {
  const elapsed = Math.floor((nowMs - startMs) / 1000);
  return Math.max(0, durationSec - elapsed);
}

/**
 * Thresholds crossed when the countdown moves from `prev` to `next` seconds
 * remaining (strictly above the threshold before, at or below it after). Used
 * so each warning fires exactly once as time ticks down.
 */
export function dueWarnings(prev: number, next: number): WarningThreshold[] {
  return WARNING_THRESHOLDS_SEC.filter((t) => prev > t && next <= t);
}

/** Whether the countdown has reached zero (auto-submit in exam mode). */
export function isExpired(remaining: number): boolean {
  return remaining <= 0;
}

/** Format seconds as `MM:SS` for display. */
export function formatClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
