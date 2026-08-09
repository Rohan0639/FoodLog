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
import {
  SOURCE_RANK, newId, type DictionaryEntry, type PerUnitMacros,
} from '../storage/schema';
import type { FoodEntry } from '../../types';
import { getCurrentIsoString } from '../../utils/date';
import { foodKey, tokensOf } from '../nlp/normalizeText';

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

/** Only the foods captured from a nutrition label. */
export function getPackaged(): DictionaryEntry[] {
  return getAll().filter((entry) => entry.kind === 'scanned');
}

/**
 * Words that may be used to name this entry *partially*.
 *
 * Aliases are deliberately excluded. An alias is a whole-name synonym, good for
 * exact lookup, but its individual words are not: an egg listing "chicken egg"
 * as an alias would otherwise contribute the word "chicken" and answer to it.
 * That is precisely how typing "chicken" once logged an egg.
 */
function entryTokens(entry: DictionaryEntry): string[] {
  return Array.from(
    new Set([
      ...tokensOf(entry.name),
      ...(entry.brand ? tokensOf(entry.brand) : []),
      ...(entry.productName ? tokensOf(entry.productName) : []),
    ])
  );
}

/**
 * The word that says what the food *is*.
 *
 * English puts the head noun last: "chicken soup" is a soup, "whole wheat
 * bread" is a bread. A query that omits it is naming something else —
 * "chicken" is not chicken soup — so a partial match must always include it.
 */
function headNoun(entry: DictionaryEntry): string | null {
  const words = tokensOf(entry.productName || entry.name);
  return words.length > 0 ? words[words.length - 1] : null;
}

export interface TokenMatch {
  entry: DictionaryEntry;
  /** How much of the entry the query pinned down — 1 means it named it fully. */
  specificity: number;
}

/**
 * Finds an entry whose name *contains* every word of the query.
 *
 * This is what lets a packaged food be logged by any subset of its name:
 * "bread", "whole wheat bread", "britannia bread" and the full name all reach
 * the same product, which exact key equality cannot express because the keys
 * differ.
 *
 * Refuses when two products fit equally well — "bread" is meaningless if the
 * library holds two different loaves, and guessing would log the wrong macros.
 */
export function findByTokens(query: string): TokenMatch | null {
  const queryTokens = tokensOf(query);
  if (queryTokens.length === 0) return null;

  const candidates: TokenMatch[] = [];

  for (const entry of readDb().foodDictionary) {
    const tokens = entryTokens(entry);
    if (tokens.length === 0) continue;

    const contained = queryTokens.every((token) => tokens.includes(token));
    if (!contained) continue;

    // Naming only a modifier ("chicken" for chicken soup) is not naming the
    // food. The head noun has to be there.
    const head = headNoun(entry);
    if (head && !queryTokens.includes(head)) continue;

    candidates.push({ entry, specificity: queryTokens.length / tokens.length });
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  /*
   * Several products contain every word of the query, so the query did not
   * pick one out — "bread" fits both a wheat loaf and a white one, and the
   * shorter name is NOT evidence of intent.
   *
   * The one exception is a query that names a product completely: with
   * "milk" and "milk chocolate" stored, "milk" is the whole of the first
   * name and merely part of the second, so it does mean the first.
   */
  const complete = candidates.filter((candidate) => candidate.specificity === 1);
  return complete.length === 1 ? complete[0] : null;
}

/** Substring search over brand and product, for the My Foods list. */
export function search(query: string): DictionaryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return getAll();

  return getAll().filter((entry) =>
    [entry.name, entry.brand, entry.productName]
      .filter(Boolean)
      .some((field) => (field as string).toLowerCase().includes(needle))
  );
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
export function learn(
  entry: FoodEntry,
  source: DictionaryEntry['source'] = 'gemini'
): DictionaryEntry | null {
  const derived = derivePerUnit(entry);
  if (!derived) return null;

  const aliases = aliasesFor(entry);
  if (aliases.length === 0) return null;

  const now = getCurrentIsoString();
  // A food whose figures came from a photographed panel is a packaged product,
  // so it is recorded as one and shown as such in My Foods.
  const fromLabel = source === 'label';
  const packaging = fromLabel
    ? {
        kind: 'scanned' as const,
        brand: entry.brand ?? null,
        productName: (entry.baseFoodName || entry.name || '').trim(),
      }
    : {};

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
        ...packaging,
      };
      return { ...db, foodDictionary: prune([...db.foodDictionary, result]) };
    }

    const existing = db.foodDictionary[existingIndex];

    // Label figures and hand corrections outrank an estimate. A lower-ranked
    // source may still bump the frequency, but never the numbers.
    const keepExistingMacros = SOURCE_RANK[existing.source] > SOURCE_RANK[source];

    result = {
      ...existing,
      aliases: Array.from(new Set([...existing.aliases, ...aliases])),
      baseUnit: keepExistingMacros ? existing.baseUnit : derived.baseUnit,
      perUnit: keepExistingMacros ? existing.perUnit : derived.perUnit,
      timesLogged: existing.timesLogged + 1,
      lastLoggedAt: now,
      source: keepExistingMacros ? existing.source : source,
      // Packaging details are only recorded when the panel itself was the
      // source, and never erased by a later estimate of the same food.
      ...(keepExistingMacros ? {} : packaging),
    };

    const next = [...db.foodDictionary];
    next[existingIndex] = result;
    return { ...db, foodDictionary: next };
  });

  return result;
}

/** Records a batch, e.g. every item in one confirmed review. */
export function learnMany(
  entries: FoodEntry[],
  source: DictionaryEntry['source'] = 'gemini'
): number {
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

/** A nutrition panel as read off a package. */
export interface PackagedFoodInput {
  brand: string | null;
  productName: string;
  baseQuantity: number;
  baseUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  barcode?: string | null;
  imageUrl?: string | null;
}

/**
 * Saves a food captured from its nutrition label.
 *
 * The panel states macros for a serving ("2 slices = 132 kcal"), so they are
 * divided down to one unit here — that is the form every lookup and rescale in
 * the app already speaks, which is why a scanned food needs no special handling
 * anywhere downstream.
 *
 * Stored as `source: 'label'`, which outranks an estimate: once a real panel
 * has been read, no later guess may overwrite those numbers.
 */
export function savePackagedFood(input: PackagedFoodInput): DictionaryEntry | null {
  const servings = input.baseQuantity > 0 ? input.baseQuantity : 1;
  const displayName = [input.brand, input.productName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim()
    .toLowerCase();

  if (!displayName) return null;

  const perUnit: PerUnitMacros = {
    calories: round(input.calories / servings),
    protein: round(input.protein / servings),
    carbs: round(input.carbs / servings),
    fats: round(input.fat / servings),
    sugar: round(input.sugar / servings),
    fiber: round(input.fiber / servings),
  };

  // Indexed under the full name and the product name alone, so either finds it.
  const aliases = Array.from(
    new Set(
      [displayName, input.productName, input.brand]
        .filter((part): part is string => Boolean(part && part.trim()))
        .map(foodKey)
        .filter(Boolean)
    )
  );

  const now = getCurrentIsoString();
  let saved: DictionaryEntry | null = null;

  updateDb((db) => {
    const existingIndex = db.foodDictionary.findIndex((candidate) =>
      candidate.aliases.some((alias) => aliases.includes(alias))
    );

    const base: DictionaryEntry = {
      id: existingIndex === -1 ? newId() : db.foodDictionary[existingIndex].id,
      name: displayName,
      kind: 'scanned',
      brand: input.brand?.trim() || null,
      productName: input.productName.trim(),
      barcode: input.barcode ?? null,
      imageUrl: input.imageUrl ?? null,
      aliases,
      baseUnit: input.baseUnit || 'serving',
      perUnit,
      timesLogged: existingIndex === -1 ? 0 : db.foodDictionary[existingIndex].timesLogged,
      lastLoggedAt: existingIndex === -1 ? now : db.foodDictionary[existingIndex].lastLoggedAt,
      createdAt: existingIndex === -1 ? now : db.foodDictionary[existingIndex].createdAt,
      source: 'label',
    };

    saved = base;

    if (existingIndex === -1) {
      return { ...db, foodDictionary: prune([...db.foodDictionary, base]) };
    }

    // Rescanning a product replaces its figures — the newer panel is the truth.
    const next = [...db.foodDictionary];
    next[existingIndex] = {
      ...base,
      aliases: Array.from(new Set([...db.foodDictionary[existingIndex].aliases, ...aliases])),
    };
    saved = next[existingIndex];
    return { ...db, foodDictionary: next };
  });

  return saved;
}

/** Applies a manual edit from the My Foods screen. */
export function update(entryId: string, patch: Partial<PackagedFoodInput>): DictionaryEntry | null {
  let updated: DictionaryEntry | null = null;

  updateDb((db) => ({
    ...db,
    foodDictionary: db.foodDictionary.map((entry) => {
      if (entry.id !== entryId) return entry;

      const servings = patch.baseQuantity && patch.baseQuantity > 0 ? patch.baseQuantity : 1;
      const hasMacros = typeof patch.calories === 'number';

      updated = {
        ...entry,
        brand: patch.brand !== undefined ? patch.brand : entry.brand,
        productName: patch.productName ?? entry.productName,
        name: [
          patch.brand !== undefined ? patch.brand : entry.brand,
          patch.productName ?? entry.productName ?? entry.name,
        ]
          .filter((part): part is string => Boolean(part && part.trim()))
          .join(' ')
          .toLowerCase() || entry.name,
        baseUnit: patch.baseUnit ?? entry.baseUnit,
        perUnit: hasMacros
          ? {
              calories: round((patch.calories ?? 0) / servings),
              protein: round((patch.protein ?? 0) / servings),
              carbs: round((patch.carbs ?? 0) / servings),
              fats: round((patch.fat ?? 0) / servings),
              sugar: round((patch.sugar ?? 0) / servings),
              fiber: round((patch.fiber ?? 0) / servings),
            }
          : entry.perUnit,
        // A hand edit is the highest authority there is.
        source: 'user',
      };

      // Keep the new name findable.
      const nameKey = foodKey(updated.name);
      if (nameKey && !updated.aliases.includes(nameKey)) {
        updated.aliases = [...updated.aliases, nameKey];
      }

      return updated;
    }),
  }));

  return updated;
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
