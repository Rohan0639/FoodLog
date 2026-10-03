import type { Database } from '../../db/client';

/** One food as the parser understands it, with macros for the stated quantity. */
export interface ParsedFood {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  source: 'dictionary' | 'ai';
}

/** Turns free text into foods. In production this is Gemini; tests pass a stub. */
export type AiParser = (text: string) => Promise<Omit<ParsedFood, 'source'>[]>;

const UNIT_WORDS = /\b(grams?|g|ml|liters?|l|pieces?|pcs?|slices?|cups?|tbsp|tsp|servings?|bowls?|glasses?)\b/g;

/** Splits "2 eggs and toast" into fragments. Never splits on "with". */
export function splitFragments(text: string): string[] {
  return text
    .split(/\band\b|,|\+/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Pulls the leading quantity and the food name out of one fragment. */
export function parseFragment(fragment: string): { quantity: number; name: string } {
  const match = fragment.toLowerCase().match(/^(?:i\s+(?:had|ate)\s+)?(\d+(?:\.\d+)?)?\s*(.*)$/);
  const quantity = match?.[1] ? parseFloat(match[1]) : 1;
  const name = (match?.[2] ?? fragment)
    .replace(UNIT_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { quantity, name };
}

/**
 * The lookup key for a food name: lower case, singular, word order ignored.
 * "2 Eggs" and "egg" both give "egg"; "brown rice" and "rice brown" agree.
 */
export function foodKey(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (word.length > 3 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word))
    .sort()
    .join(' ');
}

/**
 * Parses a meal using the user's own saved foods first.
 *
 * Known foods are answered from PostgreSQL with no AI call. Unknown fragments are
 * sent to the AI parser once, and the results are saved for next time.
 */
export async function parseMeal(
  db: Database,
  userId: string,
  text: string,
  ai: AiParser
): Promise<ParsedFood[]> {
  const fragments = splitFragments(text).map((fragment) => ({ fragment, ...parseFragment(fragment) }));
  const keys = fragments.map((f) => foodKey(f.name)).filter(Boolean);

  const known = await db.foodDictionaryEntry.findMany({
    where: { userId, key: { in: keys } },
  });
  const byKey = new Map(known.map((entry) => [entry.key, entry]));

  const results: ParsedFood[] = [];
  const misses: string[] = [];

  for (const f of fragments) {
    const entry = byKey.get(foodKey(f.name));
    if (!entry) {
      misses.push(f.fragment);
      continue;
    }
    results.push({
      name: entry.name,
      quantity: f.quantity,
      unit: entry.baseUnit,
      calories: round(entry.caloriesPerUnit * f.quantity, 0),
      protein: round(entry.proteinPerUnit * f.quantity),
      carbs: round(entry.carbsPerUnit * f.quantity),
      fat: round(entry.fatPerUnit * f.quantity),
      sugar: round(entry.sugarPerUnit * f.quantity),
      fiber: round(entry.fiberPerUnit * f.quantity),
      source: 'dictionary',
    });
  }

  if (misses.length > 0) {
    const aiItems = await ai(misses.join(' and '));
    // The AI may rename foods ("eggs" -> "large eggs"), so when the counts match,
    // save each food under the name the user typed. That is what the next lookup uses.
    const aligned = aiItems.length === misses.length;
    for (const [index, item] of aiItems.entries()) {
      results.push({ ...item, source: 'ai' });
      await learnFood(db, userId, item, aligned ? parseFragment(misses[index]).name : undefined);
    }
  }

  // Record that the saved foods were used, so the most recent ones stay easy to find.
  if (known.length > 0) {
    await db.foodDictionaryEntry.updateMany({
      where: { userId, key: { in: known.map((entry) => entry.key) } },
      data: { timesLogged: { increment: 1 }, lastUsedAt: new Date() },
    });
  }

  return results;
}

/** Saves one AI result as a per-unit entry, so any later quantity can be rescaled. */
export async function learnFood(
  db: Database,
  userId: string,
  item: Omit<ParsedFood, 'source'>,
  typedName?: string
): Promise<void> {
  if (item.quantity <= 0) return;
  const key = foodKey(typedName ?? item.name);
  if (!key) return;

  const perUnit = {
    caloriesPerUnit: item.calories / item.quantity,
    proteinPerUnit: item.protein / item.quantity,
    carbsPerUnit: item.carbs / item.quantity,
    fatPerUnit: item.fat / item.quantity,
    sugarPerUnit: item.sugar / item.quantity,
    fiberPerUnit: item.fiber / item.quantity,
  };

  await db.foodDictionaryEntry.upsert({
    where: { userId_key: { userId, key } },
    create: { userId, key, name: item.name.toLowerCase(), baseUnit: item.unit, source: 'AI', ...perUnit },
    update: { timesLogged: { increment: 1 }, lastUsedAt: new Date() },
  });
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
