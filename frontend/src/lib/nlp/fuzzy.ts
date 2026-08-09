import { isKnownFoodPhrase } from './foodVocabulary';

/**
 * Approximate string matching for mistyped food names.
 *
 * This is the only place in the app that guesses. Everything it returns is a
 * suggestion the user sees in the review table before it is logged, and every
 * threshold here is tuned to refuse rather than risk a wrong match — a refusal
 * costs one API call, a wrong match corrupts the diary.
 */

/**
 * Optimal string alignment distance: insertions, deletions, substitutions and
 * transpositions of adjacent characters. Transpositions matter because typing
 * "engg" for "eggs" is one slip, not two.
 */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // Two rolling rows plus the one before them, for the transposition case.
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr: number[] = new Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,      // insertion
        prev[j] + 1,          // deletion
        prev[j - 1] + cost    // substitution
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        curr[j] = Math.min(curr[j], prev2[j - 2] + 1); // transposition
      }
    }
    prev2 = prev;
    prev = curr;
    curr = new Array(b.length + 1);
  }

  return prev[b.length];
}

/**
 * Jaro-Winkler similarity, 0..1.
 *
 * Complements edit distance by rewarding a shared prefix, which is where food
 * typos usually agree — people rarely get the first letters wrong.
 */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;

  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(b.length - 1, i + matchWindow);
    for (let j = start; j <= end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;

  // Winkler boost for a shared prefix, capped at four characters.
  let prefix = 0;
  while (prefix < Math.min(4, a.length, b.length) && a[prefix] === b[prefix]) prefix++;

  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Raw string similarity, 0..1 — the better of the two measures. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const byDistance = 1 - editDistance(a, b) / maxLen;
  return Math.max(byDistance, jaroWinkler(a, b));
}

export interface FuzzyCandidate {
  /** Whatever the caller is matching — an entry id, usually. */
  id: string;
  aliases: string[];
  /** How often this has been logged. Frequent foods earn more benefit of the doubt. */
  timesLogged: number;
}

export interface FuzzyResult {
  id: string;
  confidence: number;
  similarity: number;
  matchedAlias: string;
}

/** Below this a match is never returned. */
export const MIN_CONFIDENCE = 0.72;
/** The best candidate must beat the next by this much, or it is too ambiguous. */
export const MIN_MARGIN = 0.08;
/** Short strings need either a strong similarity or strong frequency evidence. */
const SHORT_QUERY_LENGTH = 4;
const SHORT_QUERY_SIMILARITY = 0.85;
const SHORT_QUERY_MIN_LOGS = 5;

/**
 * Frequency is a prior, not a tiebreaker.
 *
 * A food logged fifty times is overwhelmingly the thing a garbled string was
 * meant to be; one logged once is not. Capped so it can nudge a decision but
 * never carry a poor similarity on its own.
 */
function frequencyBoost(timesLogged: number): number {
  return Math.min(0.15, Math.log1p(Math.max(0, timesLogged)) / 20);
}

/**
 * Whether two strings are even the same *shape* — a prerequisite for one being
 * a misspelling of the other.
 *
 * This exists because Jaro-Winkler rewards a shared prefix so strongly that a
 * short query scores ~0.92 against any longer name beginning with it:
 * "chicken" vs "chicken soup" scores 0.917, comfortably over the threshold.
 * That is correct for the metric and wrong for the purpose. Typing "chicken"
 * once logged an egg this way, because the egg listed "chicken egg" as an
 * alias.
 *
 * A typo keeps the word count and changes the length by a character or two.
 * Anything else is a different phrase, and belongs to the containment stage or
 * to the parser — not here.
 */
function couldBeTypoOf(query: string, alias: string): boolean {
  const queryWords = query.split(' ').length;
  const aliasWords = alias.split(' ').length;
  if (queryWords !== aliasWords) return false;

  const longest = Math.max(query.length, alias.length);
  const allowedDrift = Math.max(2, Math.ceil(longest * 0.25));
  return Math.abs(query.length - alias.length) <= allowedDrift;
}

/**
 * Best match for a query, or null when the evidence is not good enough.
 *
 * Returns null rather than a weak guess in three situations: nothing scored
 * highly enough, two candidates scored too closely to separate, or the query
 * was too short to judge without corroborating frequency.
 */
export function findBestMatch(
  query: string,
  candidates: FuzzyCandidate[]
): FuzzyResult | null {
  if (!query || candidates.length === 0) return null;

  /*
   * The user typed a real food, so they meant it.
   *
   * Letter distance cannot separate a misspelling from a different food:
   * "pear" and "peas" are as close as "gss" and "eggs". What separates them is
   * that "pear" means something. Correcting a word that is already a food
   * would silently log the wrong meal, so anything recognisable is handed to
   * the parser instead, which can actually tell chicken from egg.
   */
  if (isKnownFoodPhrase(query)) return null;

  const scored: FuzzyResult[] = [];

  for (const candidate of candidates) {
    let best: FuzzyResult | null = null;

    for (const alias of candidate.aliases) {
      if (!couldBeTypoOf(query, alias)) continue;

      const sim = similarity(query, alias);
      const confidence = sim * 0.85 + frequencyBoost(candidate.timesLogged);
      if (!best || confidence > best.confidence) {
        best = { id: candidate.id, confidence, similarity: sim, matchedAlias: alias };
      }
    }

    if (best) scored.push(best);
  }

  if (scored.length === 0) return null;
  scored.sort((a, b) => b.confidence - a.confidence);

  const best = scored[0];
  const runnerUp = scored[1];

  if (best.confidence < MIN_CONFIDENCE) return null;

  // Two plausible answers means no answer — defer to the parser.
  if (runnerUp && best.confidence - runnerUp.confidence < MIN_MARGIN) return null;

  if (query.length < SHORT_QUERY_LENGTH) {
    // A three-character string carries too little signal for edit distance
    // alone. Accept it only when it looks nearly right, or when history says
    // this is overwhelmingly the food in question and nothing else is close.
    const wellEstablished =
      (candidates.find((c) => c.id === best.id)?.timesLogged ?? 0) >= SHORT_QUERY_MIN_LOGS;
    const unambiguous = !runnerUp || best.confidence - runnerUp.confidence >= 0.15;

    if (best.similarity < SHORT_QUERY_SIMILARITY && !(wellEstablished && unambiguous)) {
      return null;
    }
  }

  return best;
}
