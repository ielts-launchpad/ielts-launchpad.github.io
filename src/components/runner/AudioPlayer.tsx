import { useEffect, useRef, useState } from 'react';
import type { RunnerMode } from '@/engine/runner/types';
import { en } from '@/i18n/en';

const t = en.runner.listening;
const buttonClass = 'min-h-11 rounded border border-slate-400 px-3 py-2 disabled:opacity-50';

interface AudioPlayerProps {
  src: string;
  durationSec: number;
  startOffset: number;
  mode: RunnerMode;
  disabled: boolean;
  autoPlay: boolean;
  resume: boolean;
  onStarted: () => void;
  onPaused: () => void;
  onProgress: (position: number) => void;
  onEnded: () => void;
}

/** Native audio decoding with labelled controls and a guarded play-once exam path. */
export function AudioPlayer({ src, durationSec, startOffset, mode, disabled, autoPlay,
  resume, onStarted, onPaused, onProgress, onEnded }: AudioPlayerProps): React.JSX.Element {
  const audio = useRef<HTMLAudioElement>(null);
  const permittedPosition = useRef(startOffset);
  const restoreOffset = useRef(startOffset);
  const mounted = useRef(true);
  const hasStarted = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startOffset);
  const [error, setError] = useState(false);
  const [volume, setVolume] = useState(1);
  const exam = mode === 'exam';

  useEffect(() => {
    mounted.current = true;
    if (autoPlay) {
      void audio.current?.play().catch(() => setError(true));
    }
    return () => { mounted.current = false; };
  }, [autoPlay]);

  useEffect(() => {
    if (disabled) audio.current?.pause();
  }, [disabled]);

  const play = (): void => {
    setError(false);
    void audio.current?.play().catch(() => setError(true));
  };

  return (
    <div className="space-y-4 rounded-xl border border-slate-300 bg-slate-50 p-4" data-testid="audio-player">
      <audio ref={audio} src={src} preload="metadata" aria-label={t.audioLabel} data-testid="listening-audio"
        onLoadedMetadata={() => {
          const player = audio.current;
          if (player && restoreOffset.current > 0) {
            player.currentTime = Math.min(restoreOffset.current, durationSec);
            restoreOffset.current = 0;
          }
        }}
        onPlay={() => { hasStarted.current = true; setPlaying(true); onStarted(); }}
        onPause={() => {
          setPlaying(false);
          if (!exam) onPaused();
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
        onTimeUpdate={() => {
          const player = audio.current;
          if (!player || player.seeking) return;
          permittedPosition.current = player.currentTime;
          setPosition(player.currentTime);
          onProgress(player.currentTime);
        }}
        onEnded={() => { setPlaying(false); onEnded(); }}
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
        {t.seek}
        <input type="range" min={0} max={durationSec} step={0.1} value={position}
          disabled={disabled || exam} data-testid="audio-seek" className="block w-full" onChange={(event) => {
            if (audio.current) audio.current.currentTime = Number(event.target.value);
            setPosition(Number(event.target.value));
          }} />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        {t.volume}
        <input type="range" min={0} max={1} step={0.1} value={volume} className="block w-full" onChange={(event) => {
          const next = Number(event.target.value);
          setVolume(next);
          if (audio.current) audio.current.volume = next;
        }} />
      </label>
      <p role="status" aria-live="polite" className="text-sm text-slate-700" data-testid="audio-status">
        {error ? t.audioError : playing ? t.playing : ''}
      </p>
    </div>
  );
}