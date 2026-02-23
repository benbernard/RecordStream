/**
 * Simple fuzzy string matching for the AddStageModal search.
 *
 * Checks if all characters in the query appear in order within the target
 * string (case-insensitive). Returns a score based on match quality:
 * consecutive matches and early matches score higher.
 */

export interface FuzzyResult {
  matches: boolean;
  score: number;
}

export function fuzzyMatch(query: string, target: string): FuzzyResult {
  if (query.length === 0) return { matches: true, score: 1 };

  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Quick check: exact substring match scores highest
  const substringIdx = t.indexOf(q);
  if (substringIdx !== -1) {
    // Prefer matches at word boundaries (start of string or after space/-)
    const atBoundary =
      substringIdx === 0 ||
      t[substringIdx - 1] === " " ||
      t[substringIdx - 1] === "-";
    return { matches: true, score: atBoundary ? 100 : 80 };
  }

  // Fuzzy: check all query chars appear in order
  let qi = 0;
  let score = 0;
  let prevMatchIdx = -2; // for detecting consecutive matches

  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Consecutive match bonus
      if (ti === prevMatchIdx + 1) {
        score += 5;
      } else {
        score += 1;
      }
      // Early match bonus
      if (ti < 5) score += 2;
      prevMatchIdx = ti;
      qi++;
    }
  }

  if (qi < q.length) {
    return { matches: false, score: 0 };
  }

  return { matches: true, score };
}

/**
 * Filter and sort items by fuzzy match quality.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
): T[] {
  if (query.length === 0) return items;

  const scored = items
    .map((item) => {
      const result = fuzzyMatch(query, getText(item));
      return { item, ...result };
    })
    .filter((r) => r.matches)
    .sort((a, b) => b.score - a.score);

  return scored.map((r) => r.item);
}
