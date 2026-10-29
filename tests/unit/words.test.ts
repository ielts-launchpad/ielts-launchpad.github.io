import { describe, expect, it } from 'vitest';
import {
  countWords,
  expandOptionalWords,
  foldForMatch,
  normaliseWhitespace,
} from '../../src/engine/text/words';

describe('normaliseWhitespace', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normaliseWhitespace('  a   b\n\tc ')).toBe('a b c');
  });
});

describe('foldForMatch', () => {
  it('lowercases and normalises whitespace', () => {
    expect(foldForMatch('The  BEES\nare Busy')).toBe('the bees are busy');
  });
});

describe('expandOptionalWords', () => {
  it('expands a single optional word into both forms', () => {
    expect(expandOptionalWords('(the) river')).toEqual(['river', 'the river']);
  });

  it('expands multiple optional words into all combinations', () => {
    expect(expandOptionalWords('(the) (big) dog')).toEqual([
      'dog',
      'big dog',
      'the dog',
      'the big dog',
    ]);
  });

  it('returns the answer unchanged when there are no optional words', () => {
    expect(expandOptionalWords('city council')).toEqual(['city council']);
  });
});

describe('countWords', () => {
  it('counts whitespace-separated tokens', () => {
    expect(countWords('one two three')).toBe(3);
  });

  it('treats a hyphenated token as a single word', () => {
    expect(countWords('well-kept hives')).toBe(2);
  });

  it('does not count a numeric token when numberAllowed is set', () => {
    expect(countWords('20 euros', { numberAllowed: true })).toBe(1);
  });

  it('counts the numeric token when numberAllowed is not set', () => {
    expect(countWords('20 euros')).toBe(2);
  });
});
