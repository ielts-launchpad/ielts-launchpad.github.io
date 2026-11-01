import type { RunnerMode } from './types';

export const LISTENING_REVIEW_SEC = 120;

export interface ListeningState {
  phase: 'ready' | 'playing' | 'review' | 'submitted';
  partIndex: number;
  position: number;
  reviewStartedAt: number | null;
}

export type ListeningEvent =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'seek'; position: number }
  | { type: 'ended' }
  | { type: 'tick' }
  | { type: 'part'; index: number };

export function initialListeningState(): ListeningState {
  return { phase: 'ready', partIndex: 0, position: 0, reviewStartedAt: null };
}

export function reviewRemaining(state: ListeningState, now: number): number {
  if (state.reviewStartedAt === null) return LISTENING_REVIEW_SEC;
  return Math.max(0, LISTENING_REVIEW_SEC - Math.floor((now - state.reviewStartedAt) / 1000));
}

/** Pure play-once state machine; exam pause/seek/part changes are ignored. */
export function transitionListening(
  state: ListeningState,
  event: ListeningEvent,
  mode: RunnerMode,
  partCount: number,
  now: number,
): ListeningState {
  if (state.phase === 'submitted') return state;
  if (event.type === 'tick') {
    return state.phase === 'review' && reviewRemaining(state, now) === 0
      ? { ...state, phase: 'submitted' } : state;
  }
  if (state.phase === 'review') return state;
  switch (event.type) {
    case 'play': return { ...state, phase: 'playing' };
    case 'pause': return mode === 'practice' ? { ...state, phase: 'ready' } : state;
    case 'seek': return mode === 'practice' ? { ...state, position: Math.max(0, event.position) } : state;
    case 'part': return mode === 'practice' && event.index >= 0 && event.index < partCount
      ? { ...initialListeningState(), partIndex: event.index } : state;
    case 'ended':
      if (mode === 'practice') return { ...state, phase: 'ready', position: 0 };
      if (state.phase !== 'playing') return state;
      return state.partIndex + 1 < partCount
        ? { ...state, partIndex: state.partIndex + 1, position: 0 }
        : { ...state, phase: 'review', position: 0, reviewStartedAt: now };
  }
}