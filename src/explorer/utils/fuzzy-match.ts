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

export interface FuzzyFilterOptions<T> {
  /**
   * Extract a short "name" field from each item. When provided, the query is
   * matched against the name first. Name matches receive a large score bonus
   * so they always rank above description-only matches.
   */
  getName?: (item: T) => string;
  /**
   * Minimum score required to include an item in results. Items scoring below
   * this threshold are filtered out. Default: 0 (show all matches).
   */
  minScore?: number;
}

/**
 * Filter and sort items by fuzzy match quality.
 *
 * When `options.getName` is provided, matching is two-tier:
 *   1. Try matching the query against the name (with a +200 score bonus).
 *   2. If the name doesn't match, fall back to full-text matching.
 *
 * This ensures that an operation whose *name* matches the query always ranks
 * above operations that only match via their description text.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getText: (item: T) => string,
  options?: FuzzyFilterOptions<T>,
): T[] {
  if (query.length === 0) return items;

  const getName = options?.getName;
  const minScore = options?.minScore ?? 0;

  const scored = items
    .map((item) => {
      // Tier 1: match against name (if extractor provided)
      if (getName) {
        const nameResult = fuzzyMatch(query, getName(item));
        if (nameResult.matches) {
          // Bonus for name match + tiebreaker favoring shorter names
          // (the query covers a larger fraction of shorter names).
          const name = getName(item);
          const coverageBonus = Math.round((query.length / name.length) * 50);
          return { item, matches: true, score: nameResult.score + 200 + coverageBonus };
        }
      }
      // Tier 2: match against full text (name + description)
      const result = fuzzyMatch(query, getText(item));
      return { item, ...result };
    })
    .filter((r) => r.matches && r.score >= minScore)
    .sort((a, b) => b.score - a.score);

  return scored.map((r) => r.item);
}
