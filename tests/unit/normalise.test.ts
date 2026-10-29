import { describe, expect, it } from 'vitest';
import { canonicalAnswer, canonicalOption } from '../../src/engine/grading/normalise';

describe('canonicalAnswer', () => {
  it('trims, collapses whitespace and lower-cases', () => {
    expect(canonicalAnswer('  The   Main  Entrance ')).toBe('the main entrance');
  });

  it('ignores a single trailing full stop', () => {
    expect(canonicalAnswer('entrance.')).toBe('entrance');
    expect(canonicalAnswer('4.')).toBe('4');
  });

  it('applies number equivalence', () => {
    expect(canonicalAnswer('Twenty-One')).toBe('21');
    expect(canonicalAnswer('four')).toBe(canonicalAnswer('4'));
  });

  it('returns empty string for blank input', () => {
    expect(canonicalAnswer('   ')).toBe('');
  });
});

describe('canonicalOption', () => {
  it('upper-cases and trims option letters', () => {
    expect(canonicalOption(' a ')).toBe('A');
    expect(canonicalOption('b')).toBe('B');
  });
});
