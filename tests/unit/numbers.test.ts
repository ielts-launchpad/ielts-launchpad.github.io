import { describe, expect, it } from 'vitest';
import { canonicaliseNumbers } from '../../src/engine/grading/numbers';

const canon = (s: string): string => canonicaliseNumbers(s.split(' ')).join(' ');

describe('canonicaliseNumbers', () => {
  it('maps single-word ones and teens to digits', () => {
    expect(canon('zero')).toBe('0');
    expect(canon('four')).toBe('4');
    expect(canon('nine')).toBe('9');
    expect(canon('nineteen')).toBe('19');
  });

  it('maps tens, with space or hyphen compounds', () => {
    expect(canon('twenty')).toBe('20');
    expect(canon('twenty-one')).toBe('21');
    expect(canon('twenty one')).toBe('21');
    expect(canon('ninety-nine')).toBe('99');
  });

  it('maps hundreds with and without "and"', () => {
    expect(canon('one hundred')).toBe('100');
    expect(canon('three hundred and five')).toBe('305');
    expect(canon('three hundred five')).toBe('305');
    expect(canon('nine hundred and ninety-nine')).toBe('999');
  });

  it('leaves digit tokens as integers and passes non-numbers through', () => {
    expect(canon('4')).toBe('4');
    expect(canon('21')).toBe('21');
    expect(canon('main entrance')).toBe('main entrance');
  });

  it('makes word and digit forms compare equal', () => {
    expect(canon('twenty-one')).toBe(canon('21'));
    expect(canon('four')).toBe(canon('4'));
    expect(canon('one hundred and twenty-three')).toBe(canon('123'));
  });

  it('canonicalises numbers embedded in phrases', () => {
    expect(canon('four people')).toBe('4 people');
    expect(canon('platform twenty-one')).toBe('platform 21');
    expect(canon('room three hundred and five')).toBe('room 305');
  });

  it('does not treat "and" alone as part of a number', () => {
    expect(canon('bread and butter')).toBe('bread and butter');
  });

  it('leaves a bare "hundred" without a leading digit alone', () => {
    expect(canon('hundred')).toBe('hundred');
  });
});
