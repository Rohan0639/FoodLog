import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from './setup';
import * as dictionaryService from '../src/lib/services/dictionaryService';
import * as localParser from '../src/lib/parsing/localParser';
import { invalidate, flushPersist } from '../src/lib/storage/localDb';
import { getLocalIsoDate } from '../src/utils/date';
import type { FoodEntry } from '../src/types';

const today = getLocalIsoDate();

const entry = (over: Partial<FoodEntry>): FoodEntry => ({
  id: 'x', name: 'egg', quantity: 1, unit: 'piece',
  calories: 70, protein: 6, carbs: 0.6, fats: 5, sugar: 0.2, fiber: 0,
  createdAt: `${today}T08:00:00.000Z`,
  ...over,
});

beforeEach(async () => {
  await flushPersist();
  resetStore();
  invalidate();
});

/**
 * Reported: typing "chicken" logged egg.
 *
 * The parser never saw it — the personal library answered first, and matched
 * the wrong food.
 */
describe('typing one food must never log a different one', () => {
  it('does not match chicken to an egg that lists "chicken egg" as an alias', () => {
    // A perfectly reasonable alias for the model to return.
    dictionaryService.learn(
      entry({ name: 'egg', baseFoodName: 'egg', aliases: ['eggs', 'chicken egg', 'hen egg'] }),
      'gemini'
    );

    const result = localParser.matchPhrase('200g chicken');

    expect(
      result.matched.map((m) => m.entry.name),
      'chicken must not resolve to egg'
    ).not.toContain('egg');
    // With nothing else stored, it has to go to the parser.
    expect(result.unmatched).toHaveLength(1);
  });

  it('does not match a modifier word shared with another food', () => {
    dictionaryService.learn(
      entry({ name: 'chicken soup', baseFoodName: 'chicken soup', aliases: ['soup'] }),
      'gemini'
    );

    // "chicken" alone is not chicken soup.
    const result = localParser.matchPhrase('200g chicken');
    expect(result.matched.map((m) => m.entry.name)).not.toContain('chicken soup');
  });

  it('still matches the food the user actually named', () => {
    dictionaryService.learn(
      entry({ name: 'chicken breast', baseFoodName: 'chicken breast', unit: 'grams', quantity: 100, calories: 165 }),
      'gemini'
    );

    const result = localParser.matchPhrase('200g chicken breast');
    expect(result.matched[0]?.entry.name).toBe('chicken breast');
  });

  it('a packaged food is still findable by part of its name', () => {
    dictionaryService.savePackagedFood({
      brand: 'Britannia', productName: 'Whole Wheat Bread',
      baseQuantity: 2, baseUnit: 'slice',
      calories: 132, protein: 5, carbs: 24, fat: 2, fiber: 4, sugar: 3,
    });

    for (const phrase of ['bread', 'wheat bread', 'britannia bread']) {
      expect(localParser.matchPhrase(phrase).matched, phrase).toHaveLength(1);
    }
  });

  it('an exact alias still resolves', () => {
    dictionaryService.learn(
      entry({ name: 'egg', baseFoodName: 'egg', aliases: ['chicken egg'] }),
      'gemini'
    );
    // Naming the alias in full is unambiguous and must still work.
    expect(localParser.matchPhrase('2 chicken eggs').matched[0]?.entry.name).toBe('egg');
  });
});
