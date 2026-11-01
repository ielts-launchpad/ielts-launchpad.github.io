import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import type { RunnerMode } from '@/engine/runner/types';
import { clampAudioPosition, formatAudioTime, seekAudioPosition } from '@/engine/audio/playback';
import { en } from '@/i18n/en';
import { format } from '@/i18n/format';
import './AudioPlayer.css';

const t = en.runner.listening;
const buttonClass = 'min-h-11 rounded border border-slate-700 px-3 py-2 text-slate-900 hover:bg-slate-200 focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-4 disabled:opacity-50';

interface AudioPlayerProps {
  src: string;
  durationSec?: number;
  startOffset?: number;
  mode: RunnerMode;
  disabled?: boolean;
  autoPlay?: boolean;
  resume?: boolean;
  audioLabel?: string;
  audioTestId?: string;
  /** A new id replays an answer location even if its source/offset is unchanged. */
  playbackRequest?: { id: number; offset: number };
  onStarted?: () => void;
  onPaused?: () => void;
  onProgress?: (position: number) => void;
  onEnded?: () => void;
}

function rangeStyle(value: number, max: number): CSSProperties & { '--audio-position': string } {
  return { '--audio-position': `${max > 0 ? (clampAudioPosition(value, max) / max) * 100 : 0}%` };
}

/** Abort a superseded request before it can seek/play a different answer's source. */
function waitForMetadata(audio: HTMLAudioElement, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error('aborted'));
  if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      audio.removeEventListener('loadedmetadata', ready);
      audio.removeEventListener('error', failed);
      signal.removeEventListener('abort', failed);
    };
    const ready = () => { cleanup(); resolve(); };
    const failed = () => { cleanup(); reject(new Error('metadata unavailable')); };
    const timeout = window.setTimeout(failed, 15_000);
    audio.addEventListener('loadedmetadata', ready, { once: true });
    audio.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', failed, { once: true });
  });
}

/** Shared Listening/Results player: hidden media, accessible controls, play-once guard. */
export function AudioPlayer({ src, durationSec = 0, startOffset = 0, mode, disabled = false, autoPlay = false,
  resume = false, audioLabel = t.audioLabel, audioTestId = 'listening-audio', playbackRequest,
  onStarted, onPaused, onProgress, onEnded }: AudioPlayerProps): React.JSX.Element {
  const audio = useRef<HTMLAudioElement>(null);
  const permittedPosition = useRef(startOffset);
  const initialOffset = useRef(startOffset);
  const lastSource = useRef(src);
  const mounted = useRef(true);
  const hasStarted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startOffset);
  const [duration, setDuration] = useState(durationSec);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState(1);
  const timeId = useId();
  const hintId = useId();
  const exam = mode === 'exam';

  useEffect(() => {
    mounted.current = true;
    const player = audio.current;
    return () => { mounted.current = false; player?.pause(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (autoPlay) {
      void audio.current?.play().catch(() => { if (!cancelled) setError(true); });
    }
    return () => { cancelled = true; };
  }, [autoPlay]);

  useEffect(() => {
    if (disabled) audio.current?.pause();
  }, [disabled]);

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    const controller = new AbortController();
    if (lastSource.current !== src) {
      lastSource.current = src;
      hasStarted.current = false;
      initialOffset.current = 0;
      permittedPosition.current = 0;
      setPosition(0);
      setDuration(durationSec);
      player.load();
    }
    setLoading(true);
    setError(false);
    const prepare = async () => {
      try {
        await waitForMetadata(player, controller.signal);
        if (controller.signal.aborted) return;
        const total = Number.isFinite(player.duration) && player.duration > 0 ? player.duration : durationSec;
        const offset = clampAudioPosition(playbackRequest?.offset ?? initialOffset.current, total);
        setDuration(total);
        permittedPosition.current = offset;
        player.currentTime = offset;
        setPosition(offset);
        setLoading(false);
        if (playbackRequest && !exam && !disabled) await player.play();
      } catch {
        if (!controller.signal.aborted) { setLoading(false); setError(true); }
      }
    };
    void prepare();
    return () => controller.abort();
    // Persisted position changes are not new playback requests. Part changes remount this player.
  }, [src, playbackRequest?.id]);

  const play = (): void => {
    if (disabled) return;
    setError(false);
    const player = audio.current;
    const requestedSource = player?.src;
    void player?.play().catch(() => {
      if (mounted.current && audio.current?.src === requestedSource) setError(true);
    });
  };

  const seek = (next: number): void => {
    const player = audio.current;
    if (!player || disabled || exam) return;
    const target = clampAudioPosition(next, duration);
    player.currentTime = target;
    setPosition(target);
    onProgress?.(target);
  };

  const updatePosition = (): void => {
    const player = audio.current;
    if (!player || player.seeking) return;
    permittedPosition.current = player.currentTime;
    setPosition(player.currentTime);
    onProgress?.(player.currentTime);
  };

  const elapsedText = formatAudioTime(duration > 0 && position >= duration ? Math.ceil(duration) : position);
  const totalText = formatAudioTime(Math.ceil(duration));
  const timeText = format(t.timeValue, { elapsed: elapsedText, total: totalText });

  return (
    <div className="audio-player space-y-4 rounded-xl border border-slate-300 p-4" data-testid="audio-player" role="group" aria-label={audioLabel}>
      <audio ref={audio} src={src} hidden preload="metadata" data-testid={audioTestId}
        onLoadedMetadata={() => {
          const player = audio.current;
          if (player && Number.isFinite(player.duration)) setDuration(player.duration);
        }}
        onPlay={() => { hasStarted.current = true; setPlaying(true); setError(false); onStarted?.(); }}
        onPause={() => {
          if (!mounted.current) return;
          setPlaying(false);
          if (!exam && !disabled) onPaused?.();
          const player = audio.current;
          if (mounted.current && exam && !disabled && player && !player.ended && hasStarted.current) {
            void player.play().catch(() => setError(true));
          }
        }}
        onSeeking={() => {
          const player = audio.current;
          if (exam && player && Math.abs(player.currentTime - permittedPosition.current) > 0.4) {
            player.currentTime = permittedPosition.current;
          }
        }}
        onTimeUpdate={updatePosition}
        onSeeked={updatePosition}
        onEnded={() => { setPlaying(false); updatePosition(); onEnded?.(); }}
        onError={() => setError(true)} />
      {exam && <p className="text-sm text-slate-700">{t.examNotice}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonClass} disabled={disabled || playing} onClick={play} data-testid="audio-play">
          {exam ? resume ? t.resume : t.start : t.play}
        </button>
        <button type="button" className={buttonClass} disabled={disabled || exam || !playing}
          onClick={() => audio.current?.pause()} data-testid="audio-pause">{t.pause}</button>
        <button type="button" className={buttonClass} disabled={disabled || exam} data-testid="audio-replay" onClick={() => {
          if (audio.current) audio.current.currentTime = 0;
          play();
        }}>{t.replay}</button>
      </div>
      <label className="block text-sm font-medium text-slate-800">
        {exam ? t.progress : t.seek}
        <input type="range" min={0} max={Math.max(0, duration)} step={0.1} value={clampAudioPosition(position, duration)}
          disabled={disabled || exam || duration <= 0} aria-readonly={exam || undefined}
          aria-valuetext={timeText} aria-describedby={exam ? timeId : `${timeId} ${hintId}`}
          data-testid="audio-seek" className="audio-range" style={rangeStyle(position, duration)}
          onChange={(event) => seek(Number(event.target.value))} onKeyDown={(event) => {
            if (exam || disabled) return;
            const changes: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 };
            if (event.key in changes) {
              event.preventDefault();
              seek(seekAudioPosition(audio.current?.currentTime ?? position, changes[event.key], duration));
            } else if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault();
              if (audio.current?.paused) play();
              else audio.current?.pause();
            }
          }} />
      </label>
      <p id={timeId} data-testid="audio-time" className="text-sm tabular-nums text-slate-900">{timeText}</p>
      {!exam && <p id={hintId} className="text-sm text-slate-700">{t.keyboardHint}</p>}
      <label className="block text-sm font-medium text-slate-800">
        {t.volume}
        <input type="range" min={0} max={1} step={0.1} value={volume} data-testid="audio-volume"
          className="audio-range" style={rangeStyle(volume, 1)} onChange={(event) => {
          const next = Number(event.target.value);
          setVolume(next);
          if (audio.current) audio.current.volume = next;
        }} />
      </label>
      <p role="status" aria-live="polite" className="text-sm text-slate-700" data-testid="audio-status">
        {error ? t.audioError : loading ? t.audioLoading : playing ? t.playing : ''}
      </p>
    </div>
  );
}