/**
 * Text primitives shared by the content validator (SPEC §3 rules 3 & 5) and,
 * later, the grading engine (SPEC §4). Kept small and pure so both can reuse
 * them. The grading engine (M2) extends these with number↔word equivalence and
 * case-folding for answer matching; this module provides what M1 validation
 * needs.
 */

/** Trim and collapse all internal whitespace runs to a single space. */
export function normaliseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Case-insensitive, whitespace-normalised form used for verbatim matching. */
export function foldForMatch(value: string): string {
  return normaliseWhitespace(value).toLowerCase();
}

/**
 * Expand optional words wrapped in parentheses into every accepted form.
 * `"(the) river"` → `["river", "the river"]`. Multiple optional tokens expand to
 * all combinations. Returns unique, whitespace-normalised variants.
 */
export function expandOptionalWords(answer: string): string[] {
  const tokens = normaliseWhitespace(answer).split(' ').filter(Boolean);
  let variants: string[][] = [[]];

  for (const token of tokens) {
    const optional = /^\((.+)\)$/.exec(token);
    if (optional) {
      const word = optional[1];
      variants = variants.flatMap((v) => [v, [...v, word]]);
    } else {
      variants = variants.map((v) => [...v, token]);
    }
  }

  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of variants) {
    const joined = v.join(' ');
    if (!seen.has(joined)) {
      seen.add(joined);
      result.push(joined);
    }
  }
  return result;
}

const NUMERIC_TOKEN = /^\d[\d.,:/-]*$/;

/**
 * Count words per IELTS rules (SPEC §4): words are whitespace tokens; a
 * hyphenated token counts as one word; when `numberAllowed`, a single numeric
 * token is not counted as a word.
 */
export function countWords(value: string, options: { numberAllowed?: boolean } = {}): number {
  const tokens = normaliseWhitespace(value).split(' ').filter(Boolean);
  let count = tokens.length;
  if (options.numberAllowed) {
    const firstNumeric = tokens.findIndex((t) => NUMERIC_TOKEN.test(t));
    if (firstNumeric !== -1) {
      count -= 1;
    }
  }
  return count;
}
