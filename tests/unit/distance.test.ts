import { describe, expect, it } from 'vitest';
import { damerauLevenshtein } from '../../src/engine/grading/distance';

describe('damerauLevenshtein', () => {
  it('is zero for identical strings', () => {
    expect(damerauLevenshtein('river', 'river')).toBe(0);
  });

  it('counts single insertions and deletions', () => {
    expect(damerauLevenshtein('river', 'rivers')).toBe(1);
    expect(damerauLevenshtein('rivers', 'river')).toBe(1);
  });

  it('counts substitutions', () => {
    expect(damerauLevenshtein('river', 'rover')).toBe(1);
  });

  it('counts adjacent transpositions as one edit', () => {
    expect(damerauLevenshtein('recieve', 'receive')).toBe(1);
    expect(damerauLevenshtein('ab', 'ba')).toBe(1);
  });

  it('accumulates multiple edits', () => {
    expect(damerauLevenshtein('kitten', 'sitting')).toBe(3);
  });

  it('returns max + 1 once the distance provably exceeds max', () => {
    expect(damerauLevenshtein('abc', 'xyz', 2)).toBe(3);
    expect(damerauLevenshtein('short', 'a much longer string', 2)).toBe(3);
  });

  it('still returns the exact value when within max', () => {
    expect(damerauLevenshtein('colour', 'color', 2)).toBe(1);
  });
});
