/**
 * Answer normalisation for deterministic grading (SPEC §4). Produces the
 * canonical matching form: trimmed, internal whitespace collapsed, lower-cased,
 * a single trailing full stop ignored, and every number expression rewritten to
 * its digit form so word/digit variants compare equal. Pure and exam-agnostic.
 */
import { foldForMatch } from '../text/words';
import { canonicaliseNumbers } from './numbers';

/**
 * Canonical matching form of a single answer string. Optional-word expansion is
 * handled separately (a single written answer can expand to several accepted
 * variants); this operates on one concrete string.
 */
export function canonicalAnswer(value: string): string {
  const folded = foldForMatch(value).replace(/\.$/, '').trim();
  if (folded === '') return '';
  const tokens = folded.split(' ').filter(Boolean);
  return canonicaliseNumbers(tokens).join(' ');
}

/** Normalise an option letter (e.g. a Choose-N / matching answer) for comparison. */
export function canonicalOption(value: string): string {
  return value.trim().toUpperCase();
}
