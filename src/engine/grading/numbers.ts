/**
 * English number-word ↔ digit equivalence for integers 0–999 (SPEC §4). A digit
 * token equals its English word: `"4"` = `"four"`, `"twenty-one"` = `"21"`,
 * `"one hundred and five"` = `"105"`. Pure and exam-agnostic.
 *
 * The public entry point is {@link canonicaliseNumbers}, which rewrites every
 * number expression in a token list to its canonical digit form so the grader
 * can compare answers written either way.
 */

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const COMPOUND = /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)$/;

interface Parsed {
  value: number;
  /** Index one past the last consumed token. */
  end: number;
}

/** Parse a plain digit token representing an integer 0–999. */
function parseDigitToken(token: string): number | null {
  if (!/^\d{1,3}$/.test(token)) return null;
  return Number(token);
}

/** Parse the "tens and ones" portion (0–99) starting at `i`. */
function parseTensOnes(tokens: string[], i: number): Parsed | null {
  const token = tokens[i];
  if (token === undefined) return null;

  const compound = COMPOUND.exec(token);
  if (compound) {
    return { value: TENS[compound[1]] + ONES[compound[2]], end: i + 1 };
  }

  if (token in TENS) {
    const next = tokens[i + 1];
    if (next !== undefined && next in ONES && ONES[next] >= 1 && ONES[next] <= 9) {
      return { value: TENS[token] + ONES[next], end: i + 2 };
    }
    return { value: TENS[token], end: i + 1 };
  }

  if (token in ONES) {
    return { value: ONES[token], end: i + 1 };
  }

  return null;
}

/** Parse a full English number phrase (0–999) starting at `i`, or `null`. */
function parseNumberWords(tokens: string[], start: number): Parsed | null {
  let i = start;
  let total = 0;
  let consumed = false;

  const hundredsDigit = tokens[i] !== undefined && tokens[i] in ONES ? ONES[tokens[i]] : null;
  if (hundredsDigit !== null && hundredsDigit >= 1 && hundredsDigit <= 9 && tokens[i + 1] === 'hundred') {
    total += hundredsDigit * 100;
    i += 2;
    consumed = true;

    // An optional "and", only valid when real tens/ones follow it.
    const afterAnd = tokens[i] === 'and' ? i + 1 : i;
    const tensOnes = parseTensOnes(tokens, afterAnd);
    if (tensOnes) {
      total += tensOnes.value;
      i = tensOnes.end;
    }
    return { value: total, end: i };
  }

  const tensOnes = parseTensOnes(tokens, i);
  if (tensOnes) {
    total += tensOnes.value;
    i = tensOnes.end;
    consumed = true;
  }

  return consumed ? { value: total, end: i } : null;
}

/**
 * Rewrite every number expression (digit tokens and English words for 0–999) in
 * a whitespace-tokenised list to its canonical integer string. Non-number tokens
 * are preserved. Number words take precedence so `"twenty-one"` collapses to a
 * single `"21"` token.
 */
export function canonicaliseNumbers(tokens: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const words = parseNumberWords(tokens, i);
    if (words && words.end > i) {
      out.push(String(words.value));
      i = words.end;
      continue;
    }
    const digit = parseDigitToken(tokens[i]);
    if (digit !== null) {
      out.push(String(digit));
      i += 1;
      continue;
    }
    out.push(tokens[i]);
    i += 1;
  }
  return out;
}
