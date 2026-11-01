import { describe, expect, it } from 'vitest';
import { clampAudioPosition, formatAudioTime, seekAudioPosition } from '../../src/engine/audio/playback';

describe('audio positions', () => {
  it('clamps finite positions and rejects invalid positions/durations', () => {
    expect(clampAudioPosition(5.2, 23.92)).toBe(5.2);
    expect(clampAudioPosition(-5, 24)).toBe(0);
    expect(clampAudioPosition(30, 23.92)).toBe(23.92);
    for (const value of [NaN, Infinity, -Infinity]) {
      expect(clampAudioPosition(value, 24)).toBe(0);
      expect(clampAudioPosition(5, value)).toBe(0);
    }
    expect(clampAudioPosition(5, -1)).toBe(0);
  });

  it('seeks exactly five seconds in either direction without crossing the bounds', () => {
    expect(seekAudioPosition(8, 5, 24)).toBe(13);
    expect(seekAudioPosition(8, -5, 24)).toBe(3);
    expect(seekAudioPosition(2, -5, 24)).toBe(0);
    expect(seekAudioPosition(22, 5, 23.92)).toBe(23.92);
    expect(seekAudioPosition(5, NaN, 24)).toBe(5);
  });
});

describe('audio time text', () => {
  it.each([[0, '0:00'], [5.9, '0:05'], [24, '0:24'], [65, '1:05'], [3600, '60:00'],
    [-1, '0:00'], [NaN, '0:00'], [Infinity, '0:00']] as const)('formats %s as %s', (seconds, expected) => {
    expect(formatAudioTime(seconds)).toBe(expected);
  });
});