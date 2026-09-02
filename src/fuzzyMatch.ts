// Lightweight fuzzy text-similarity helpers used to catch near-duplicate task
// lineage entries and summary sentences (e.g. a checkpoint saved after only a
// status tweak, or reworded phrasing of the same update).

/** Default similarity score (0–1) above which two strings are treated as duplicates. */
export const DEFAULT_FUZZY_THRESHOLD = 0.85;

/** Lowercases and splits text into word tokens, stripping punctuation. */
export function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function bigrams(tokens: string[]): string[] {
  if (tokens.length < 2) return tokens;
  const pairs: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) pairs.push(`${tokens[i]} ${tokens[i + 1]}`);
  return pairs;
}

/**
 * Sørensen–Dice coefficient over word bigrams: 1 = identical content, 0 = no overlap.
 * Tolerant of minor edits (typos, added/removed words, punctuation/casing) while still
 * distinguishing genuinely different sentences.
 */
export function textSimilarity(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;

  const bigramsA = bigrams(tokenizeWords(left));
  const bigramsB = bigrams(tokenizeWords(right));
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0;

  const remaining = new Map<string, number>();
  for (const gram of bigramsB) remaining.set(gram, (remaining.get(gram) ?? 0) + 1);

  let overlap = 0;
  for (const gram of bigramsA) {
    const count = remaining.get(gram) ?? 0;
    if (count > 0) {
      overlap++;
      remaining.set(gram, count - 1);
    }
  }

  return (2 * overlap) / (bigramsA.length + bigramsB.length);
}

/** True when two strings are similar enough to be considered near-duplicates. */
export function isFuzzyDuplicate(a: string, b: string, threshold = DEFAULT_FUZZY_THRESHOLD): boolean {
  return textSimilarity(a, b) >= threshold;
}

/**
 * True when `shortTokens` is (near-)identically restated as the leading tokens of
 * `longTokens` — i.e. the shorter text's content is fully subsumed by the start of
 * the longer one, so keeping both would just repeat the same opening clause.
 * Guarded by `minTokens` so short generic phrases ("deployed to prod") don't get
 * treated as redundant just because a longer, unrelated sentence happens to start
 * the same way.
 */
export function isPrefixContainment(
  shortTokens: string[],
  longTokens: string[],
  minRatio = 0.9,
  minTokens = 5
): boolean {
  if (shortTokens.length < minTokens || shortTokens.length > longTokens.length) return false;
  let matches = 0;
  for (let i = 0; i < shortTokens.length; i++) {
    if (shortTokens[i] === longTokens[i]) matches++;
  }
  return matches / shortTokens.length >= minRatio;
}
