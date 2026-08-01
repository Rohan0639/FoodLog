/**
 * A local cache of parser results, keyed by the phrase that produced them.
 *
 * This is the local-first replacement for the server's `macro_dictionary`
 * table: once a phrase has been parsed, logging it again is instant and works
 * with no network at all. Only successful parses are cached — caching an
 * "invalid" verdict would permanently reject a phrase the parser might handle
 * correctly on a later attempt.
 */

import { readDb, updateDb } from '../storage/localDb';
import type { GeminiResponse } from '../../types';
import { getCurrentIsoString } from '../../utils/date';

/** Oldest entries are evicted past this many, to bound the store's size. */
const MAX_ENTRIES = 200;

/** Cache key: whitespace- and case-normalised input text. */
function cacheKey(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

/** A previously parsed result for this phrase, if one was stored. */
export function getCachedParse(text: string): GeminiResponse | null {
  const key = cacheKey(text);
  if (!key) return null;
  return readDb().parseCache[key]?.response ?? null;
}

/** Stores a successful parse. Invalid verdicts are ignored by design. */
export function setCachedParse(text: string, response: GeminiResponse): void {
  const key = cacheKey(text);
  if (!key || response?.status !== 'valid') return;

  updateDb((db) => {
    const next = { ...db.parseCache, [key]: { response, cachedAt: getCurrentIsoString() } };

    const keys = Object.keys(next);
    if (keys.length > MAX_ENTRIES) {
      keys
        .sort((a, b) => (next[a].cachedAt < next[b].cachedAt ? -1 : 1))
        .slice(0, keys.length - MAX_ENTRIES)
        .forEach((stale) => delete next[stale]);
    }

    return { ...db, parseCache: next };
  });
}

/** Empties the cache. */
export function clearParseCache(): void {
  updateDb((db) => ({ ...db, parseCache: {} }));
}
