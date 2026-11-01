import { describe, expect, it } from 'vitest';
import {
  countWords,
  expandOptionalWords,
  foldForMatch,
  normaliseWhitespace,
  stripTranscriptMarkup,
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

describe('stripTranscriptMarkup', () => {
  it('removes [mm:ss.s] timestamps and leading speaker labels', () => {
    const input = '[00:08.2] CLERK: Thank you.\n[00:12.4] VISITOR: Where next?';
    expect(foldForMatch(stripTranscriptMarkup(input))).toBe('thank you. where next?');
  });

  it('lets a quote span several lines once markup is stripped', () => {
    const input = '[00:00.0] NARRATOR: the quick brown\n[00:02.0] CLERK: fox jumps over';
    expect(foldForMatch(stripTranscriptMarkup(input))).toContain('the quick brown fox jumps over');
  });

  it('does not strip a mid-line colon that is not a speaker label', () => {
    const input = '[00:01.0] NARRATOR: the ratio was 3:1 overall';
    expect(foldForMatch(stripTranscriptMarkup(input))).toBe('the ratio was 3:1 overall');
  });
});
