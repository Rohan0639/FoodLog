/**
 * Deterministic text normalisation for food matching.
 *
 * This is the layer that makes "2 eggs", "two Eggs", "I had an EGG" and
 * "eggs." all collapse to the same key — no model, no guessing, no chance of a
 * wrong match. Everything here is reversible reasoning a human could check.
 *
 * Fuzzy matching (typos) is deliberately NOT here. It is a separate, riskier
 * layer that runs only after everything in this file has failed.
 */

/** Words that carry no food meaning and only get in the way of matching. */
const FILLER_WORDS = new Set([
  'i', 'ive', 'i-ve', 'had', 'have', 'has', 'ate', 'eat', 'eaten', 'eating',
  'just', 'today', 'logged', 'log', 'my', 'me', 'some', 'a', 'an', 'the',
  'of', 'with', 'and', 'for', 'breakfast', 'lunch', 'dinner', 'snack',
  'please', 'add', 'plus', 'about', 'around', 'approx', 'approximately',
]);

/**
 * Written numbers stated outright — these win over anything implied.
 * "a" and "an" are deliberately absent; see WEAK_NUMBER_WORDS.
 */
const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  single: 1, couple: 2, pair: 2, few: 3, several: 3,
  half: 0.5, dozen: 12,
};

/**
 * Articles that only mean "one" when nothing better was said.
 *
 * They must not consume the quantity slot eagerly, or "a couple of eggs" reads
 * as one egg — the article is answered by the word after it, not by itself.
 */
const WEAK_NUMBER_WORDS: Record<string, number> = { a: 1, an: 1 };

/** Unit spellings collapsed to one canonical token. */
const UNIT_ALIASES: Record<string, string> = {
  g: 'grams', gm: 'grams', gms: 'grams', gram: 'grams', grams: 'grams',
  kg: 'kilograms', kgs: 'kilograms', kilogram: 'kilograms', kilograms: 'kilograms',
  ml: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  l: 'liters', ltr: 'liters', liter: 'liters', liters: 'liters', litre: 'liters', litres: 'liters',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lbs', lbs: 'lbs', pound: 'lbs', pounds: 'lbs',
  pc: 'piece', pcs: 'piece', piece: 'piece', pieces: 'piece',
  slice: 'slice', slices: 'slice',
  cup: 'cup', cups: 'cup',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  serving: 'serving', servings: 'serving', serve: 'serving',
  bowl: 'bowl', bowls: 'bowl',
  glass: 'glass', glasses: 'glass',
};

const UNIT_TOKENS = new Set(Object.keys(UNIT_ALIASES));

/** Lowercase, strip punctuation, collapse whitespace. */
export function basicClean(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.\-/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Endings where a trailing "s" is part of the word, not a plural marker.
 * Without this, hummus/couscous/asparagus/citrus all lose their last letter.
 */
const NOT_A_PLURAL = /(?:ss|us|is)$/;

/**
 * Crude singulariser — enough for food nouns, and deliberately conservative.
 * Words that are too short to judge, or whose ending only looks plural, are
 * left alone: a wrong stem is worse than no stem, because it can collide with
 * a different food's key.
 */
export function singularise(word: string): string {
  if (word.length < 4 || NOT_A_PLURAL.test(word)) return word;
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('oes') || word.endsWith('shes') || word.endsWith('ches')) return word.slice(0, -2);
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

export interface ParsedPhrase {
  /** Quantity if the phrase stated one. */
  quantity: number | null;
  /** Canonical unit if the phrase stated one. */
  unit: string | null;
  /** The food itself, normalised — this is the dictionary lookup key. */
  foodKey: string;
  /** The food words before singularisation, for display. */
  foodText: string;
}

/**
 * Splits a phrase into quantity, unit and food.
 *
 * "2 eggs"        -> { quantity: 2,   unit: null,    foodKey: "egg" }
 * "two Eggs"      -> { quantity: 2,   unit: null,    foodKey: "egg" }
 * "I had an egg"  -> { quantity: 1,   unit: null,    foodKey: "egg" }
 * "300g chicken"  -> { quantity: 300, unit: "grams", foodKey: "chicken" }
 * "chicken"       -> { quantity: null,unit: null,    foodKey: "chicken" }
 */
export function parsePhrase(input: string): ParsedPhrase {
  const cleaned = basicClean(input);
  if (!cleaned) {
    return { quantity: null, unit: null, foodKey: '', foodText: '' };
  }

  // "300g" / "1.5kg" — a number glued to a unit needs splitting first.
  const tokens = cleaned
    .split(' ')
    .flatMap((token) => {
      const glued = token.match(/^(\d+(?:\.\d+)?)([a-z]+)$/);
      if (glued && UNIT_TOKENS.has(glued[2])) return [glued[1], glued[2]];
      return [token];
    })
    .filter(Boolean);

  let quantity: number | null = null;
  let weakQuantity: number | null = null;
  let unit: string | null = null;
  const foodTokens: string[] = [];

  for (const token of tokens) {
    // Numeric quantity — only the first one counts as the amount.
    const asNumber = parseFloat(token);
    if (!Number.isNaN(asNumber) && /^\d/.test(token)) {
      if (quantity === null) quantity = asNumber;
      continue;
    }

    // Written quantity, e.g. "two", "couple", "half".
    if (token in NUMBER_WORDS) {
      if (quantity === null) quantity = NUMBER_WORDS[token];
      continue;
    }

    // "a"/"an" — held back in case a real quantity follows.
    if (token in WEAK_NUMBER_WORDS) {
      if (weakQuantity === null) weakQuantity = WEAK_NUMBER_WORDS[token];
      continue;
    }

    if (UNIT_TOKENS.has(token)) {
      if (unit === null) unit = UNIT_ALIASES[token];
      continue;
    }

    if (FILLER_WORDS.has(token)) continue;

    // Punctuation kept for decimals ("1.5") is meaningless on a food word.
    const word = token.replace(/^[.\-/]+|[.\-/]+$/g, '');
    if (word) foodTokens.push(word);
  }

  // Nothing explicit was said, so fall back to the article's implied "one".
  if (quantity === null && weakQuantity !== null) quantity = weakQuantity;

  const foodText = foodTokens.join(' ');
  const foodKey = foodTokens.map(singularise).sort().join(' ');

  return { quantity, unit, foodKey, foodText };
}

/**
 * The lookup key for a food name.
 *
 * Token-sorted, so "brown rice" and "rice brown" agree — word order in a food
 * name carries no meaning worth preserving for matching purposes.
 */
export function foodKey(name: string): string {
  return parsePhrase(name).foodKey || basicClean(name);
}

/**
 * Spellings of a canonical alias to compare a typo against.
 *
 * Aliases are stored singularised, but people type plurals — and a typo of a
 * plural resembles the plural, not the singular. "gss" scores 0.72 against
 * "eggs" and 0.00 against "egg", so without this the fuzzy layer would miss
 * the very cases it exists for.
 *
 * Used only for approximate comparison; never stored.
 */
export function surfaceForms(alias: string): string[] {
  if (alias.length < 3) return [alias];

  const words = alias.split(' ');
  const last = words[words.length - 1];
  if (last.endsWith('s')) return [alias];

  const pluralLast = /(?:ch|sh|x|z)$/.test(last) ? `${last}es` : `${last}s`;
  const plural = [...words.slice(0, -1), pluralLast].join(' ');

  return [alias, plural];
}

/** Splits a sentence into independent food parts. Never splits on "with". */
export function splitParts(text: string): string[] {
  return (text || '')
    .split(/\band\b|,|\+|&/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}
