/**
 * The personal food dictionary.
 *
 * Every confirmed log teaches this store what the user eats and what it is
 * worth nutritionally, expressed per unit so any future quantity can be
 * rescaled from it. It is the local-first replacement for the shared
 * `macro_dictionary` table the old build kept server-side — except this one
 * learns only from its owner and never leaves the device.
 *
 * Phase 1 only *writes* here. Reading it during parsing arrives in Phase 2.
 */

import { readDb, updateDb } from '../storage/localDb';
import { newId, type DictionaryEntry, type PerUnitMacros } from '../storage/schema';
import type { FoodEntry } from '../../types';
import { getCurrentIsoString } from '../../utils/date';
import { foodKey } from '../nlp/normalizeText';

/** Beyond this, the least recently used entries are dropped. */
const MAX_ENTRIES = 2000;

const round = (value: number, dp = 3): number => {
  const factor = 10 ** dp;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
};

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Every learned food, most recently logged first. */
export function getAll(): DictionaryEntry[] {
  return [...readDb().foodDictionary].sort((a, b) =>
    a.lastLoggedAt < b.lastLoggedAt ? 1 : -1
  );
}

/** Exact alias lookup. The fast path Phase 2 will hit first. */
export function findByAlias(text: string): DictionaryEntry | null {
  const key = foodKey(text);
  if (!key) return null;
  return readDb().foodDictionary.find((entry) => entry.aliases.includes(key)) ?? null;
}

export function count(): number {
  return readDb().foodDictionary.length;
}

// ---------------------------------------------------------------------------
// Deriving per-unit macros
// ---------------------------------------------------------------------------

/**
 * Works out what one unit of this food is worth.
 *
 * Prefers the per-unit figures the parser returned, because they describe the
 * food itself rather than the portion that happened to be logged. Falls back to
 * dividing the logged macros by the logged quantity, which is what makes
 * learning work for rule-parsed and hand-edited entries too.
 */
export function derivePerUnit(entry: FoodEntry): { perUnit: PerUnitMacros; baseUnit: string } | null {
  const hasParserUnits =
    typeof entry.caloriesPerUnit === 'number' && Number.isFinite(entry.caloriesPerUnit);

  if (hasParserUnits) {
    return {
      baseUnit: entry.baseUnit || entry.unit || 'serving',
      perUnit: {
        calories: round(entry.caloriesPerUnit as number),
        protein: round(entry.proteinPerUnit ?? 0),
        carbs: round(entry.carbsPerUnit ?? 0),
        fats: round(entry.fatPerUnit ?? 0),
        sugar: round(entry.sugarPerUnit ?? 0),
        fiber: round(entry.fiberPerUnit ?? 0),
      },
    };
  }

  const quantity = entry.quantity;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return {
    baseUnit: entry.unit || 'serving',
    perUnit: {
      calories: round((entry.calories || 0) / quantity),
      protein: round((entry.protein || 0) / quantity),
      carbs: round((entry.carbs || 0) / quantity),
      fats: round((entry.fats || 0) / quantity),
      sugar: round((entry.sugar || 0) / quantity),
      fiber: round((entry.fiber || 0) / quantity),
    },
  };
}

/**
 * Every alias worth indexing this entry under.
 *
 * `sourceText` is the important one: it is the exact fragment the user typed.
 * Learning it means a misspelling that the AI resolved correctly becomes an
 * *exact* hit next time, with no fuzzy guessing involved — the dictionary
 * gradually absorbs however this particular person writes.
 */
function aliasesFor(entry: FoodEntry): string[] {
  const candidates = [
    entry.name,
    entry.baseFoodName,
    entry.sourceText,
    ...(entry.aliases ?? []),
  ];

  const keys = candidates
    .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
    .map(foodKey)
    .filter(Boolean);

  return Array.from(new Set(keys));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Records one confirmed food.
 *
 * Called on confirm rather than on parse: by then the user has seen the numbers
 * in the review table and accepted them, so what gets learned is what they
 * actually endorsed.
 */
export function learn(entry: FoodEntry, source: 'gemini' | 'user' = 'gemini'): DictionaryEntry | null {
  const derived = derivePerUnit(entry);
  if (!derived) return null;

  const aliases = aliasesFor(entry);
  if (aliases.length === 0) return null;

  const now = getCurrentIsoString();
  let result: DictionaryEntry | null = null;

  updateDb((db) => {
    const existingIndex = db.foodDictionary.findIndex((candidate) =>
      candidate.aliases.some((alias) => aliases.includes(alias))
    );

    if (existingIndex === -1) {
      result = {
        id: newId(),
        name: (entry.baseFoodName || entry.name || '').trim().toLowerCase(),
        aliases,
        baseUnit: derived.baseUnit,
        perUnit: derived.perUnit,
        timesLogged: 1,
        lastLoggedAt: now,
        createdAt: now,
        source,
      };
      return { ...db, foodDictionary: prune([...db.foodDictionary, result]) };
    }

    const existing = db.foodDictionary[existingIndex];

    // A hand-corrected entry is the user's own answer — a later parse must not
    // quietly replace it. Only another manual edit may.
    const keepExistingMacros = existing.source === 'user' && source !== 'user';

    result = {
      ...existing,
      aliases: Array.from(new Set([...existing.aliases, ...aliases])),
      baseUnit: keepExistingMacros ? existing.baseUnit : derived.baseUnit,
      perUnit: keepExistingMacros ? existing.perUnit : derived.perUnit,
      timesLogged: existing.timesLogged + 1,
      lastLoggedAt: now,
      source: keepExistingMacros ? existing.source : source,
    };

    const next = [...db.foodDictionary];
    next[existingIndex] = result;
    return { ...db, foodDictionary: next };
  });

  return result;
}

/** Records a batch, e.g. every item in one confirmed review. */
export function learnMany(entries: FoodEntry[], source: 'gemini' | 'user' = 'gemini'): number {
  let learned = 0;
  for (const entry of entries) {
    if (learn(entry, source)) learned++;
  }
  return learned;
}

/**
 * Teaches an entry a new spelling.
 *
 * This is what closes the loop on typos: when a user corrects a row, the text
 * they originally typed becomes an alias, so the same mistake resolves exactly
 * next time instead of relying on fuzzy matching.
 */
export function addAlias(entryId: string, rawText: string): void {
  const key = foodKey(rawText);
  if (!key) return;

  updateDb((db) => ({
    ...db,
    foodDictionary: db.foodDictionary.map((entry) =>
      entry.id === entryId && !entry.aliases.includes(key)
        ? { ...entry, aliases: [...entry.aliases, key] }
        : entry
    ),
  }));
}

export function remove(entryId: string): void {
  updateDb((db) => ({
    ...db,
    foodDictionary: db.foodDictionary.filter((entry) => entry.id !== entryId),
  }));
}

export function clear(): void {
  updateDb((db) => ({ ...db, foodDictionary: [] }));
}

/** Drops the least recently used entries once the store gets too large. */
function prune(entries: DictionaryEntry[]): DictionaryEntry[] {
  if (entries.length <= MAX_ENTRIES) return entries;
  return [...entries]
    .sort((a, b) => (a.lastLoggedAt < b.lastLoggedAt ? 1 : -1))
    .slice(0, MAX_ENTRIES);
}
