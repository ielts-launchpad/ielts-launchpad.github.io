import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import alignment from '../../tools/audio/sample-01.alignment.json' with { type: 'json' };
import { sampleAudioDuration, sampleListening } from '../fixtures/sample-audio';

describe('spoken sample provenance and alignment', () => {
  it('pins the encoded audio and matches its measured duration', () => {
    const sha = createHash('sha256').update(readFileSync(sampleListening.audioFsPath)).digest('hex');
    expect(sha).toBe('3162f431bd8e3717076b3db8fb44b7f5f5df0ef62518e37c45b83f4f0f4cd862');
    expect(sampleAudioDuration).toBeCloseTo(alignment.totalSamples / alignment.sampleRate, 3);
    expect(sampleListening.part.durationSec).toBe(alignment.durationSec);
  });

  it('preserves all original turn text with ordered sample-count timestamps and distinct voices', () => {
    const lines = sampleListening.transcriptText.trim().split(/\r?\n/);
    expect(lines).toHaveLength(8);
    expect(alignment.turns).toHaveLength(lines.length);
    const voices = new Map<string, string>();
    let previousEnd = 0;
    alignment.turns.forEach((turn, index) => {
      const match = /^\[(\d+):(\d+\.\d+)\] (\w+): (.+)$/.exec(lines[index]);
      if (!match) throw new Error(`Invalid transcript turn ${index + 1}`);
      const seconds = Number(match[1]) * 60 + Number(match[2]);
      expect(Math.abs(seconds - turn.startSample / alignment.sampleRate)).toBeLessThanOrEqual(0.05);
      expect(match[3]).toBe(turn.speaker);
      expect(match[4]).toBe(turn.chunks.map((chunk) => chunk.text).join(' '));
      expect(turn.startSample).toBeGreaterThan(previousEnd);
      for (const chunk of turn.chunks) {
        expect(chunk.startSample).toBeGreaterThan(previousEnd);
        expect(chunk.endSample).toBeGreaterThan(chunk.startSample);
        expect(chunk.endSample).toBeLessThan(alignment.totalSamples);
        previousEnd = chunk.endSample;
      }
      expect(turn.startSample).toBe(turn.chunks[0].startSample);
      expect(turn.endSample).toBe(previousEnd);
      if (voices.has(turn.speaker)) expect(turn.voice).toBe(voices.get(turn.speaker));
      voices.set(turn.speaker, turn.voice);
    });
    expect(voices.size).toBe(3);
    expect(new Set(voices.values()).size).toBe(3);
  });

  it('places every evidence replay anchor at its spoken phrase onset', () => {
    const questions = sampleListening.part.groups.flatMap((group) => group.questions);
    expect(questions).toHaveLength(Object.keys(alignment.audioStart).length);
    for (const question of questions) {
      const evidence = question.evidence;
      if (!evidence || evidence.audioStart === undefined) throw new Error(`Missing evidence: ${question.id}`);
      const chunk = alignment.turns.flatMap((turn) => turn.chunks)
        .find((entry) => entry.text.toLowerCase().startsWith(evidence.quote.toLowerCase()));
      if (!chunk) throw new Error(`Missing speech anchor: ${question.id}`);
      const recorded = Object.entries(alignment.audioStart).find(([id]) => id === question.id)?.[1];
      expect(evidence.audioStart).toBe(recorded);
      expect(evidence.audioStart).toBe(Math.round(chunk.startSample / alignment.sampleRate * 10) / 10);
      expect(evidence.audioStart).toBeLessThan(sampleListening.part.durationSec);
    }
  });
});