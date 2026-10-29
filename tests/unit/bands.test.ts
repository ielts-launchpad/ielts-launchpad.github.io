import { describe, expect, it } from 'vitest';
import {
  academicReadingBand,
  generalReadingBand,
  listeningBand,
  overallBand,
  readingBand,
  skillBand,
} from '../../src/exams/ielts/bands';

// Full boundary tables from SPEC §4. Each pair is [rawScore, expectedBand].
const LISTENING: [number, number][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 2],
  [4, 2.5],
  [5, 2.5],
  [6, 3],
  [7, 3],
  [8, 3.5],
  [9, 3.5],
  [10, 4],
  [12, 4],
  [13, 4.5],
  [15, 4.5],
  [16, 5],
  [17, 5],
  [18, 5.5],
  [22, 5.5],
  [23, 6],
  [25, 6],
  [26, 6.5],
  [29, 6.5],
  [30, 7],
  [31, 7],
  [32, 7.5],
  [34, 7.5],
  [35, 8],
  [36, 8],
  [37, 8.5],
  [38, 8.5],
  [39, 9],
  [40, 9],
];

const ACADEMIC_READING: [number, number][] = [
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 2],
  [4, 2.5],
  [5, 2.5],
  [6, 3],
  [7, 3],
  [8, 3.5],
  [9, 3.5],
  [10, 4],
  [12, 4],
  [13, 4.5],
  [14, 4.5],
  [15, 5],
  [18, 5],
  [19, 5.5],
  [22, 5.5],
  [23, 6],
  [26, 6],
  [27, 6.5],
  [29, 6.5],
  [30, 7],
  [32, 7],
  [33, 7.5],
  [34, 7.5],
  [35, 8],
  [36, 8],
  [37, 8.5],
  [38, 8.5],
  [39, 9],
  [40, 9],
];

const GENERAL_READING: [number, number][] = [
  [40, 9],
  [39, 8.5],
  [38, 8],
  [37, 8],
  [36, 7.5],
  [35, 7],
  [34, 7],
  [33, 6.5],
  [32, 6.5],
  [31, 6],
  [30, 6],
  [29, 5.5],
  [27, 5.5],
  [26, 5],
  [23, 5],
  [22, 4.5],
  [19, 4.5],
  [18, 4],
  [15, 4],
];

describe('listeningBand', () => {
  it.each(LISTENING)('raw %i → band %f', (raw, band) => {
    expect(listeningBand(raw)).toBe(band);
  });
});

describe('academicReadingBand', () => {
  it.each(ACADEMIC_READING)('raw %i → band %f', (raw, band) => {
    expect(academicReadingBand(raw)).toBe(band);
  });
});

describe('generalReadingBand', () => {
  it.each(GENERAL_READING)('raw %i → band %f', (raw, band) => {
    expect(generalReadingBand(raw)).toBe(band);
  });
});

describe('readingBand', () => {
  it('selects the academic table by default', () => {
    expect(readingBand('academic', 30)).toBe(7);
  });

  it('selects the general table for general training', () => {
    expect(readingBand('general', 30)).toBe(6);
  });
});

describe('skillBand', () => {
  it('maps listening and reading, and returns null for writing/speaking', () => {
    expect(skillBand('listening', 'academic', 30)).toBe(7);
    expect(skillBand('reading', 'academic', 30)).toBe(7);
    expect(skillBand('writing', 'academic', 30)).toBeNull();
    expect(skillBand('speaking', 'academic', 30)).toBeNull();
  });
});

describe('overallBand', () => {
  // SPEC §4: < .25 down, .25–<.75 to .5, >= .75 up.
  const cases: [number[], number][] = [
    [[6.5, 6.5, 5, 7], 6.5], // mean 6.25 → .25 rounds to .5
    [[4, 3.5, 4, 4], 4], // mean 3.875 → .875 rounds up
    [[6.5, 6.5, 6.5, 6], 6.5], // mean 6.375 → .375 to .5
    [[3.5, 4, 4, 4], 4], // mean 3.875 → up
    [[6, 6, 6, 6], 6], // exact whole
    [[6.5, 6, 5.5, 6], 6], // mean 6.0
    [[5, 5, 5, 5.5], 5], // mean 5.125 → .125 down
    [[5, 5, 5, 6], 5.5], // mean 5.25 → .25 to .5
    [[6, 6, 6, 5], 6], // mean 5.75 → .75 up
    [[7, 7, 6.5, 6.5], 7], // mean 6.75 → .75 up
    [[5.5, 5.5, 5.5, 5], 5.5], // mean 5.375 → to .5
    [[7, 6.5, 6.5, 6.5], 6.5], // mean 6.625 → .625 to .5
  ];

  it.each(cases)('bands %j → overall %f', (bands, expected) => {
    expect(overallBand(bands)).toBe(expected);
  });

  it('returns 0 for no skills', () => {
    expect(overallBand([])).toBe(0);
  });
});
