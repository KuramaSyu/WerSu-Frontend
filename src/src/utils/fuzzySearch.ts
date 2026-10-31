export interface FuzzyMatch {
  /** Higher is better. */
  score: number;
  /** Indices of the matched characters in `text`, for highlighting. */
  indices: number[];
}

/**
 * Case-insensitive subsequence match.
 *
 * Returns `null` when `query` is not a subsequence of `text`; otherwise a
 * score (higher = better) plus the matched character indices. Consecutive
 * runs and word-boundary hits are rewarded so "abc" ranks "abc" above
 * "a-b-c".
 */
export function fuzzyMatch(query: string, text: string): FuzzyMatch | null {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return null;
  if (text.length === 0) return null;
  const t = text.toLowerCase();

  const indices: number[] = [];
  let score = 0;
  let cursor = 0;
  let prevMatch = -2;
  let consecutive = 0;

  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = -1;
    for (let i = cursor; i < t.length; i++) {
      if (t[i] === ch) {
        found = i;
        break;
      }
    }
    if (found === -1) return null;

    indices.push(found);

    if (found === prevMatch + 1) {
      consecutive += 1;
      score += 8 + consecutive * 2;
    } else {
      consecutive = 0;
      score += 2;
    }

    // Reward matches at the start of the string or a word.
    if (found === 0 || /[\s\-_/.]/.test(t[found - 1])) {
      score += 6;
    }

    prevMatch = found;
    cursor = found + 1;
  }

  // Prefer shorter candidates and earlier first matches.
  score -= Math.floor(t.length / 20);
  score -= indices[0] ?? 0;

  return { score, indices };
}
