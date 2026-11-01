/**
 * Damerau–Levenshtein edit distance (optimal string alignment variant) used to
 * classify near-miss spelling errors (SPEC §4 error classification). Counts
 * insertions, deletions, substitutions and transpositions of adjacent
 * characters. Pure and exam-agnostic.
 *
 * `max` lets callers stop early: once the best achievable distance exceeds
 * `max`, the exact value no longer matters, so `max + 1` is returned.
 */
export function damerauLevenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;

  for (let i = 1; i < rows; i++) {
    let rowMin = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost, // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, d[i - 2][j - 2] + 1); // transposition
      }
      d[i][j] = best;
      rowMin = Math.min(rowMin, best);
    }
    if (rowMin > max) return max + 1;
  }

  return d[rows - 1][cols - 1];
}
