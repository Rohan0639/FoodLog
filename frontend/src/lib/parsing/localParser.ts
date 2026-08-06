/**
 * Resolves a phrase against the user's own food dictionary before any network
 * call is considered.
 *
 * The output is deliberately shaped like a parser response, so callers cannot
 * tell whether an item came from here or from the AI — everything downstream
 * (review table, confirm, logging) is untouched.
 *
 * The ladder, in order, stopping at the first hit per part:
 *   1. exact alias         "2 eggs"      — deterministic
 *   2. normalised alias    "two eggs"    — deterministic
 *   3. fuzzy + frequency   "2 gss"       — a guess, shown for review
 *   4. miss                              — handed to the AI
 */

import type { GeminiResponse, ParsedItem } from '../../types';
import type { DictionaryEntry } from '../storage/schema';
import { scaleMacrosByQuantity } from '../../utils/unitConverter';
import { parsePhrase, splitParts, surfaceForms } from '../nlp/normalizeText';
import { findBestMatch } from '../nlp/fuzzy';
import * as dictionaryService from '../services/dictionaryService';

export type MatchStage = 'exact' | 'partial' | 'fuzzy';

export interface LocalMatch {
  /** The phrase fragment the user actually typed. */
  sourceText: string;
  entry: DictionaryEntry;
  quantity: number;
  unit: string;
  confidence: number;
  stage: MatchStage;
}

export interface LocalParseResult {
  matched: LocalMatch[];
  /** Fragments the dictionary could not answer for. */
  unmatched: string[];
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Matches every fragment of a phrase independently.
 *
 * Splitting happens on "and", "," and "+" only — never "with" — so each
 * fragment is a standalone food and can safely be resolved on its own.
 */
export function matchPhrase(text: string): LocalParseResult {
  const parts = splitParts(text);
  const matched: LocalMatch[] = [];
  const unmatched: string[] = [];

  if (parts.length === 0) return { matched, unmatched };

  const dictionary = dictionaryService.getAll();
  if (dictionary.length === 0) {
    return { matched, unmatched: parts };
  }

  for (const part of parts) {
    const parsed = parsePhrase(part);
    if (!parsed.foodKey) {
      unmatched.push(part);
      continue;
    }

    // Stages 1-2: exact alias hit after normalisation. Cannot misfire.
    const exact = dictionary.find((entry) => entry.aliases.includes(parsed.foodKey));
    if (exact) {
      matched.push({
        sourceText: part,
        entry: exact,
        quantity: parsed.quantity ?? 1,
        unit: parsed.unit ?? exact.baseUnit,
        confidence: 1,
        stage: 'exact',
      });
      continue;
    }

    // Stage 2.5: part of a longer name — "bread" naming "britannia whole wheat
    // bread". Still deterministic: every word must be present, and a tie
    // between two products is refused rather than guessed.
    const partial = dictionaryService.findByTokens(parsed.foodKey);
    if (partial) {
      matched.push({
        sourceText: part,
        entry: partial.entry,
        quantity: parsed.quantity ?? 1,
        unit: parsed.unit ?? partial.entry.baseUnit,
        confidence: partial.specificity,
        stage: 'partial',
      });
      continue;
    }

    // Stage 3: a guess, and only when the evidence clears every guard.
    // Plural forms are included because a mistyped plural resembles the plural.
    const fuzzy = findBestMatch(
      parsed.foodKey,
      dictionary.map((entry) => ({
        id: entry.id,
        aliases: entry.aliases.flatMap(surfaceForms),
        timesLogged: entry.timesLogged,
      }))
    );

    const guessed = fuzzy && dictionary.find((entry) => entry.id === fuzzy.id);
    if (fuzzy && guessed) {
      matched.push({
        sourceText: part,
        entry: guessed,
        quantity: parsed.quantity ?? 1,
        unit: parsed.unit ?? guessed.baseUnit,
        confidence: fuzzy.confidence,
        stage: 'fuzzy',
      });
      continue;
    }

    unmatched.push(part);
  }

  return { matched, unmatched };
}

/**
 * Turns a match into a parser item, rescaled to the requested amount.
 *
 * Rescaling goes through the same `scaleMacrosByQuantity` the review table
 * uses, so a dictionary hit and an AI result behave identically when the user
 * adjusts the quantity afterwards.
 */
export function toParsedItem(match: LocalMatch): ParsedItem {
  const { entry, quantity, unit } = match;

  const scaled = scaleMacrosByQuantity(
    entry.perUnit,
    quantity,
    unit,
    1,               // perUnit describes exactly one baseUnit
    entry.baseUnit,
    entry.name
  );

  return {
    name: entry.name,
    quantity: `${quantity} ${unit}`,
    calories: scaled.calories,
    protein: scaled.protein,
    carbs: scaled.carbs,
    fat: scaled.fats,
    sugar: scaled.sugar,
    fiber: scaled.fiber,

    // Carried through so confirming re-learns from the same per-unit figures
    // rather than re-deriving them from this particular portion.
    baseFoodName: entry.name,
    baseUnit: entry.baseUnit,
    baseQty: 1,
    caloriesPerUnit: entry.perUnit.calories,
    proteinPerUnit: entry.perUnit.protein,
    carbsPerUnit: entry.perUnit.carbs,
    fatPerUnit: entry.perUnit.fats,
    sugarPerUnit: entry.perUnit.sugar,
    fiberPerUnit: entry.perUnit.fiber,
    aliases: entry.aliases,

    // Provenance — drives the badge, and teaches the dictionary this spelling
    // once the user confirms.
    source: 'dictionary',
    matchConfidence: match.confidence,
    matchStage: match.stage,
    sourceText: match.sourceText,
  };
}

/** Sums a set of items into the totals block a parser response carries. */
export function totalsFor(items: ParsedItem[]) {
  const totals = items.reduce(
    (acc, item) => ({
      calories: acc.calories + (item.calories || 0),
      protein: acc.protein + (item.protein || 0),
      carbs: acc.carbs + (item.carbs || 0),
      fat: acc.fat + (item.fat || 0),
      sugar: acc.sugar + (item.sugar || 0),
      fiber: acc.fiber + (item.fiber || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0 }
  );

  return {
    calories: Math.round(totals.calories),
    protein: round1(totals.protein),
    carbs: round1(totals.carbs),
    fat: round1(totals.fat),
    sugar: round1(totals.sugar),
    fiber: round1(totals.fiber),
  };
}

/** A response assembled entirely from the local dictionary. */
/** True when any item was a guess rather than a definite match. */
export function anyGuessed(matches: LocalMatch[]): boolean {
  return matches.some((match) => match.stage === 'fuzzy');
}

export function buildResponse(items: ParsedItem[], anyGuessed: boolean): GeminiResponse {
  const names = items.map((item) => `${item.quantity} of ${item.name}`).join(' and ');
  return {
    status: 'valid',
    reply: anyGuessed
      ? `I think you meant ${names} — from foods you've logged before. Adjust anything that looks off.`
      : `Recognised ${names} from your own foods.`,
    items,
    totals: totalsFor(items),
  };
}
