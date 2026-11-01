/** Pure media-position helpers; independent of browser, exam and UI state. */
export function clampAudioPosition(position: number, duration: number): number {
  const limit = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  return Number.isFinite(position) ? Math.min(limit, Math.max(0, position)) : 0;
}

export function seekAudioPosition(position: number, change: number, duration: number): number {
  const current = clampAudioPosition(position, duration);
  return clampAudioPosition(current + (Number.isFinite(change) ? change : 0), duration);
}

export function formatAudioTime(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}