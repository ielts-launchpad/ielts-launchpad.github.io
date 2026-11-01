/**
 * IELTS raw-score → band tables and overall-band rounding (SPEC §4). Exam
 * specifics live here, not in the exam-agnostic engine.
 *
 * VERIFY AGAINST ielts.org BEFORE RELEASE. These brackets reproduce the tables
 * in SPEC §4; the General Training Reading brackets below 15/40 continue the
 * published table and must be double-checked.
 */
import type { Skill } from '../../engine/content/schema';

/** A descending list of `{ min, band }`: the band is the first entry with `raw >= min`. */
interface Bracket {
  min: number;
  band: number;
}

const LISTENING: Bracket[] = [
  { min: 39, band: 9 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8 },
  { min: 32, band: 7.5 },
  { min: 30, band: 7 },
  { min: 26, band: 6.5 },
  { min: 23, band: 6 },
  { min: 18, band: 5.5 },
  { min: 16, band: 5 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3 },
  { min: 4, band: 2.5 },
  { min: 2, band: 2 },
  { min: 1, band: 1 },
  { min: 0, band: 0 },
];

const ACADEMIC_READING: Bracket[] = [
  { min: 39, band: 9 },
  { min: 37, band: 8.5 },
  { min: 35, band: 8 },
  { min: 33, band: 7.5 },
  { min: 30, band: 7 },
  { min: 27, band: 6.5 },
  { min: 23, band: 6 },
  { min: 19, band: 5.5 },
  { min: 15, band: 5 },
  { min: 13, band: 4.5 },
  { min: 10, band: 4 },
  { min: 8, band: 3.5 },
  { min: 6, band: 3 },
  { min: 4, band: 2.5 },
  { min: 2, band: 2 },
  { min: 1, band: 1 },
  { min: 0, band: 0 },
];

const GENERAL_READING: Bracket[] = [
  { min: 40, band: 9 },
  { min: 39, band: 8.5 },
  { min: 37, band: 8 },
  { min: 36, band: 7.5 },
  { min: 34, band: 7 },
  { min: 32, band: 6.5 },
  { min: 30, band: 6 },
  { min: 27, band: 5.5 },
  { min: 23, band: 5 },
  { min: 19, band: 4.5 },
  { min: 15, band: 4 },
  // Below 15/40 is not tabulated in SPEC §4; continuation pending verification.
  { min: 13, band: 3.5 },
  { min: 11, band: 3 },
  { min: 9, band: 2.5 },
  { min: 6, band: 2 },
  { min: 1, band: 1 },
  { min: 0, band: 0 },
];

function bandFromTable(raw: number, table: Bracket[]): number {
  const score = Math.max(0, Math.floor(raw));
  for (const bracket of table) {
    if (score >= bracket.min) return bracket.band;
  }
  return 0;
}

/** Listening raw score (0–40) → band. */
export function listeningBand(raw: number): number {
  return bandFromTable(raw, LISTENING);
}

/** Academic Reading raw score (0–40) → band. */
export function academicReadingBand(raw: number): number {
  return bandFromTable(raw, ACADEMIC_READING);
}

/** General Training Reading raw score (0–40) → band. */
export function generalReadingBand(raw: number): number {
  return bandFromTable(raw, GENERAL_READING);
}

/** Reading band for the given variant. */
export function readingBand(variant: 'academic' | 'general', raw: number): number {
  return variant === 'general' ? generalReadingBand(raw) : academicReadingBand(raw);
}

/** Band for a deterministically graded skill (Listening or Reading). */
export function skillBand(skill: Skill, variant: 'academic' | 'general', raw: number): number | null {
  if (skill === 'listening') return listeningBand(raw);
  if (skill === 'reading') return readingBand(variant, raw);
  return null; // Writing/Speaking bands come from the AI worker (SPEC §8).
}

/**
 * Overall band from the four skill bands (SPEC §4): mean, then round the
 * fractional part — `< .25` down, `.25–<.75` to `.5`, `>= .75` up to the next
 * whole band.
 */
export function overallBand(bands: number[]): number {
  if (bands.length === 0) return 0;
  const mean = bands.reduce((sum, b) => sum + b, 0) / bands.length;
  const rounded = Math.round(mean * 1e6) / 1e6;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}
