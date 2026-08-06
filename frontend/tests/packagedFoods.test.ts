import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from './setup';
import * as dictionaryService from '../src/lib/services/dictionaryService';
import * as localParser from '../src/lib/parsing/localParser';
import { invalidate } from '../src/lib/storage/localDb';
import { normalizeDb } from '../src/lib/storage/schema';
import { getLocalIsoDate } from '../src/utils/date';
import type { FoodEntry } from '../src/types';

const today = getLocalIsoDate();

/** The worked example from the spec: Britannia Whole Wheat Bread. */
const bread = () =>
  dictionaryService.savePackagedFood({
    brand: 'Britannia',
    productName: 'Whole Wheat Bread',
    baseQuantity: 2,      // panel states values per 2 slices
    baseUnit: 'slice',
    calories: 132,
    protein: 5,
    carbs: 24,
    fat: 2,
    fiber: 4,
    sugar: 3,
  });

beforeEach(() => {
  resetStore();
  invalidate();
});

describe('saving a scanned label', () => {
  it('divides the panel down to a single unit', () => {
    // The panel says 132 kcal per 2 slices; one slice is 66.
    const entry = bread()!;
    expect(entry.perUnit.calories).toBe(66);
    expect(entry.perUnit.protein).toBe(2.5);
    expect(entry.perUnit.carbs).toBe(12);
    expect(entry.baseUnit).toBe('slice');
  });

  it('records the packaging details', () => {
    const entry = bread()!;
    expect(entry.kind).toBe('scanned');
    expect(entry.brand).toBe('Britannia');
    expect(entry.productName).toBe('Whole Wheat Bread');
    expect(entry.source).toBe('label');
  });

  it('leaves barcode and image ready but unset', () => {
    const entry = bread()!;
    expect(entry.barcode).toBeNull();
    expect(entry.imageUrl).toBeNull();
  });

  it('rescanning updates the figures instead of duplicating', () => {
    bread();
    dictionaryService.savePackagedFood({
      brand: 'Britannia', productName: 'Whole Wheat Bread',
      baseQuantity: 2, baseUnit: 'slice',
      calories: 140, protein: 5, carbs: 24, fat: 2, fiber: 4, sugar: 3,
    });
    expect(dictionaryService.count()).toBe(1);
    expect(dictionaryService.getPackaged()[0].perUnit.calories).toBe(70);
  });

  it('refuses a nameless product', () => {
    expect(dictionaryService.savePackagedFood({
      brand: null, productName: '  ', baseQuantity: 1, baseUnit: 'serving',
      calories: 100, protein: 1, carbs: 1, fat: 1, fiber: 1, sugar: 1,
    })).toBeNull();
  });
});

describe('logging a scanned food by name', () => {
  beforeEach(() => { bread(); });

  it.each([
    'Britannia Whole Wheat Bread',
    'whole wheat bread',
    'Britannia bread',
    'bread',
    'WHOLE WHEAT BREAD',
  ])('finds it from %j', (phrase) => {
    const result = localParser.matchPhrase(phrase);
    expect(result.unmatched).toEqual([]);
    expect(result.matched[0].entry.productName).toBe('Whole Wheat Bread');
  });

  it('scales to the quantity asked for — the spec example', () => {
    // Stored 2 slices = 132 kcal, so 4 slices must be 264.
    const match = localParser.matchPhrase('4 slices Britannia Whole Wheat Bread').matched[0];
    const item = localParser.toParsedItem(match);
    expect(item.calories).toBe(264);
    expect(item.protein).toBe(10);
    expect(item.carbs).toBe(48);
  });

  it('handles a single slice', () => {
    const match = localParser.matchPhrase('1 slice whole wheat bread').matched[0];
    expect(localParser.toParsedItem(match).calories).toBe(66);
  });

  it('never reaches the AI for a saved product', () => {
    expect(localParser.matchPhrase('4 slices Britannia Whole Wheat Bread').unmatched).toEqual([]);
  });

  it('marks the match as a definite one, not a guess', () => {
    const match = localParser.matchPhrase('britannia bread').matched[0];
    expect(match.stage).not.toBe('fuzzy');
  });
});

describe('refusing ambiguous partial names', () => {
  it('will not choose between two breads', () => {
    bread();
    dictionaryService.savePackagedFood({
      brand: 'Harvest', productName: 'White Bread',
      baseQuantity: 2, baseUnit: 'slice',
      calories: 160, protein: 4, carbs: 30, fat: 2, fiber: 1, sugar: 4,
    });

    // "bread" alone fits both — logging either would be a coin flip.
    expect(localParser.matchPhrase('2 slices bread').matched).toHaveLength(0);

    // Naming the brand resolves it.
    expect(
      localParser.matchPhrase('2 slices britannia bread').matched[0]?.entry.brand
    ).toBe('Britannia');
  });

  it('still matches a word that appears in only one product', () => {
    bread();
    dictionaryService.savePackagedFood({
      brand: 'Harvest', productName: 'White Bread',
      baseQuantity: 2, baseUnit: 'slice',
      calories: 160, protein: 4, carbs: 30, fat: 2, fiber: 1, sugar: 4,
    });
    expect(localParser.matchPhrase('wheat bread').matched[0]?.entry.brand).toBe('Britannia');
  });
});

describe('trust ranking', () => {
  it('a label outranks an AI estimate', () => {
    bread();
    // The AI later guesses at the same food; the panel must win.
    dictionaryService.learn({
      id: 'x', name: 'britannia whole wheat bread', quantity: 1, unit: 'slice',
      calories: 999, protein: 1, carbs: 1, fats: 1, sugar: 1, fiber: 1,
      createdAt: `${today}T08:00:00.000Z`,
    } as FoodEntry, 'gemini');

    expect(dictionaryService.getPackaged()[0].perUnit.calories).toBe(66);
  });

  it('but a hand edit outranks the label', () => {
    const entry = bread()!;
    dictionaryService.update(entry.id, {
      productName: 'Whole Wheat Bread', baseQuantity: 1, baseUnit: 'slice',
      calories: 70, protein: 3, carbs: 13, fat: 1, fiber: 2, sugar: 2,
    });
    const updated = dictionaryService.getAll()[0];
    expect(updated.perUnit.calories).toBe(70);
    expect(updated.source).toBe('user');
  });

  it('an edited food is still findable by its new name', () => {
    const entry = bread()!;
    dictionaryService.update(entry.id, { brand: 'Britannia', productName: 'Brown Bread' });
    expect(localParser.matchPhrase('brown bread').matched).toHaveLength(1);
  });
});

describe('My Foods search', () => {
  beforeEach(() => {
    bread();
    dictionaryService.savePackagedFood({
      brand: 'Amul', productName: 'Toned Milk', baseQuantity: 100, baseUnit: 'ml',
      calories: 58, protein: 3.1, carbs: 4.7, fat: 3.0, fiber: 0, sugar: 4.7,
    });
  });

  it('matches on brand', () => {
    expect(dictionaryService.search('amul')).toHaveLength(1);
  });

  it('matches on product', () => {
    expect(dictionaryService.search('bread')[0].brand).toBe('Britannia');
  });

  it('is case-insensitive and partial', () => {
    expect(dictionaryService.search('WHEAT')).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    expect(dictionaryService.search('')).toHaveLength(2);
  });

  it('lists only scanned foods on request', () => {
    dictionaryService.learn({
      id: 'e', name: 'egg', quantity: 1, unit: 'piece', calories: 70,
      protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0,
      createdAt: `${today}T08:00:00.000Z`,
    } as FoodEntry, 'gemini');

    expect(dictionaryService.count()).toBe(3);
    expect(dictionaryService.getPackaged()).toHaveLength(2);
  });
});

describe('schema compatibility', () => {
  it('back-fills the new fields on a store written before this feature', () => {
    const normalised = normalizeDb({
      foodDictionary: [{
        id: 'a', name: 'egg', aliases: ['egg'], baseUnit: 'piece',
        perUnit: { calories: 70, protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0 },
        timesLogged: 3, lastLoggedAt: today, createdAt: today, source: 'gemini',
      }],
    });

    // Still valid, just without the packaged-only fields.
    expect(normalised.foodDictionary).toHaveLength(1);
    expect(normalised.foodDictionary[0].kind).toBeUndefined();
  });
});

describe('label attached to a normal log', () => {
  /** What the combined parser returns for "3 slices of bread" + a label photo. */
  const labelParsedItem = (): FoodEntry => ({
    id: 'x',
    name: 'Britannia Whole Wheat Bread',
    quantity: 3,
    unit: 'slice',
    calories: 198, protein: 7.5, carbs: 36, fats: 3, sugar: 4.5, fiber: 6,
    createdAt: `${today}T08:00:00.000Z`,
    baseFoodName: 'britannia whole wheat bread',
    brand: 'Britannia',
    baseUnit: 'slice',
    caloriesPerUnit: 66, proteinPerUnit: 2.5, carbsPerUnit: 12,
    fatPerUnit: 1, sugarPerUnit: 1.5, fiberPerUnit: 2,
    source: 'label',
  });

  it('stores the label figures as a packaged food', () => {
    dictionaryService.learn(labelParsedItem(), 'label');
    const entry = dictionaryService.getPackaged()[0];

    expect(entry).toBeDefined();
    expect(entry.source).toBe('label');
    expect(entry.kind).toBe('scanned');
    expect(entry.brand).toBe('Britannia');
    // Per-unit comes from the label, not from dividing the portion.
    expect(entry.perUnit.calories).toBe(66);
  });

  it('makes the food reusable with no further AI call', () => {
    dictionaryService.learn(labelParsedItem(), 'label');

    const result = localParser.matchPhrase('2 slices britannia whole wheat bread');
    expect(result.unmatched).toEqual([]);
    expect(localParser.toParsedItem(result.matched[0]).calories).toBe(132);
  });

  it('a later estimate cannot overwrite the label figures', () => {
    dictionaryService.learn(labelParsedItem(), 'label');

    dictionaryService.learn({
      ...labelParsedItem(),
      calories: 999, caloriesPerUnit: 333, source: undefined,
    } as FoodEntry, 'gemini');

    expect(dictionaryService.getPackaged()[0].perUnit.calories).toBe(66);
  });

  it('but the estimate still counts toward frequency', () => {
    dictionaryService.learn(labelParsedItem(), 'label');
    dictionaryService.learn(labelParsedItem(), 'gemini');
    expect(dictionaryService.getAll()[0].timesLogged).toBe(2);
  });

  it('an ordinary log without a label stays an estimate', () => {
    dictionaryService.learn({
      id: 'e', name: 'egg', quantity: 1, unit: 'piece', calories: 70,
      protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0,
      createdAt: `${today}T08:00:00.000Z`,
    } as FoodEntry, 'gemini');

    const entry = dictionaryService.getAll()[0];
    expect(entry.source).toBe('gemini');
    expect(entry.kind).toBeUndefined();
    expect(dictionaryService.getPackaged()).toHaveLength(0);
  });
});
