import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from './setup';
import * as dictionaryService from '../src/lib/services/dictionaryService';
import * as localParser from '../src/lib/parsing/localParser';
import { invalidate, flushPersist } from '../src/lib/storage/localDb';
import { getLocalIsoDate } from '../src/utils/date';
import type { FoodEntry } from '../src/types';

const today = getLocalIsoDate();

const entry = (over: Partial<FoodEntry> = {}): FoodEntry => ({
  id: 'x', name: 'egg', quantity: 1, unit: 'piece',
  calories: 70, protein: 6, carbs: 0.6, fats: 5, sugar: 0.2, fiber: 0,
  createdAt: `${today}T08:00:00.000Z`,
  ...over,
});

/** Logs the same food `times` times, as repeated use would. */
const teach = (name: string, times: number, perUnitCals = 70, unit = 'piece') => {
  for (let i = 0; i < times; i++) {
    dictionaryService.learn(entry({ id: `${name}-${i}`, name, unit, calories: perUnitCals }), 'gemini');
  }
};

beforeEach(async () => {
  await flushPersist();
  resetStore();
  invalidate();
});

describe('learning', () => {
  it('prefers the parser per-unit figures over the logged portion', () => {
    dictionaryService.learn(entry({
      quantity: 2, calories: 140, protein: 12,
      baseUnit: 'piece', caloriesPerUnit: 70, proteinPerUnit: 6,
    }), 'gemini');

    const learned = dictionaryService.findByAlias('egg')!;
    expect(learned.perUnit.calories).toBe(70);
    expect(learned.baseUnit).toBe('piece');
  });

  it('derives per-unit when the parser gave none', () => {
    // Rule-parsed and hand-edited foods carry no per-unit fields; learning must
    // still work or those foods would never be remembered.
    dictionaryService.learn(entry({
      name: 'kfc rice bowl', quantity: 2, unit: 'serving',
      calories: 1240, protein: 56,
    }), 'gemini');

    const learned = dictionaryService.findByAlias('kfc rice bowl')!;
    expect(learned.perUnit.calories).toBe(620);
    expect(learned.perUnit.protein).toBe(28);
    expect(learned.baseUnit).toBe('serving');
  });

  it('refuses to learn from a zero quantity rather than dividing by zero', () => {
    expect(dictionaryService.learn(entry({ quantity: 0 }), 'gemini')).toBeNull();
    expect(dictionaryService.count()).toBe(0);
  });

  it('counts repeats without duplicating the entry', () => {
    teach('egg', 5);
    expect(dictionaryService.count()).toBe(1);
    expect(dictionaryService.findByAlias('egg')!.timesLogged).toBe(5);
  });

  it('indexes every alias the parser supplied', () => {
    dictionaryService.learn(entry({
      name: 'egg', baseFoodName: 'egg', aliases: ['boiled egg', 'fried egg'],
    }), 'gemini');

    for (const spelling of ['egg', 'eggs', 'boiled eggs', 'fried egg']) {
      expect(dictionaryService.findByAlias(spelling), spelling).not.toBeNull();
    }
  });

  it('learns the exact text the user typed, closing the typo loop', () => {
    // This is what turns a one-off correction into a permanent exact match.
    dictionaryService.learn(entry({ sourceText: '2 gss' }), 'gemini');
    expect(dictionaryService.findByAlias('gss')).not.toBeNull();
    expect(dictionaryService.findByAlias('5 gss')).not.toBeNull();
  });
});

describe('source precedence', () => {
  it('never lets a later parse overwrite a hand-corrected value', () => {
    dictionaryService.learn(entry({ name: 'soup', calories: 700 }), 'user');
    dictionaryService.learn(entry({ name: 'soup', calories: 999 }), 'gemini');

    const learned = dictionaryService.findByAlias('soup')!;
    expect(learned.perUnit.calories).toBe(700);
    expect(learned.source).toBe('user');
  });

  it('still counts the repeat even when the value is preserved', () => {
    dictionaryService.learn(entry({ name: 'soup', calories: 700 }), 'user');
    dictionaryService.learn(entry({ name: 'soup', calories: 999 }), 'gemini');
    expect(dictionaryService.findByAlias('soup')!.timesLogged).toBe(2);
  });

  it('allows another manual edit to change it', () => {
    dictionaryService.learn(entry({ name: 'soup', calories: 700 }), 'user');
    dictionaryService.learn(entry({ name: 'soup', calories: 500 }), 'user');
    expect(dictionaryService.findByAlias('soup')!.perUnit.calories).toBe(500);
  });
});

describe('matching ladder', () => {
  beforeEach(() => {
    teach('egg', 1, 70);
    teach('banana', 1, 90);
  });

  it.each(['2 eggs', 'two eggs', 'TWO EGGS', 'I had an egg', 'egg', 'eggs.', '3 egg'])(
    'resolves %j with no network call',
    (phrase) => {
      const result = localParser.matchPhrase(phrase);
      expect(result.unmatched).toEqual([]);
      expect(result.matched).toHaveLength(1);
      expect(result.matched[0].stage).toBe('exact');
    }
  );

  it('resolves a multi-item phrase entirely locally', () => {
    const result = localParser.matchPhrase('2 eggs and a banana');
    expect(result.matched).toHaveLength(2);
    expect(result.unmatched).toEqual([]);
  });

  it('keeps the known half and forwards only the unknown half', () => {
    const result = localParser.matchPhrase('2 eggs and quinoa salad');
    expect(result.matched).toHaveLength(1);
    expect(result.unmatched).toHaveLength(1);
    expect(result.unmatched[0]).toMatch(/quinoa/);
  });

  it('forwards everything when nothing is known', () => {
    resetStore(); invalidate();
    expect(localParser.matchPhrase('2 eggs').matched).toHaveLength(0);
  });
});

describe('quantity scaling', () => {
  beforeEach(() => teach('egg', 1, 70));

  it.each([
    ['2 eggs', 140],
    ['5 eggs', 350],
    ['egg', 70],     // bare name means one
  ])('%s -> %i kcal', (phrase, expected) => {
    const match = localParser.matchPhrase(phrase as string).matched[0];
    expect(localParser.toParsedItem(match).calories).toBe(expected);
  });

  it('emits a quantity string the downstream parser can read back', () => {
    const item = localParser.toParsedItem(localParser.matchPhrase('2 eggs').matched[0]);
    expect(item.quantity).toMatch(/^\d+(\.\d+)?\s+\w+/);
    expect(parseFloat(item.quantity)).toBe(2);
  });

  it('carries per-unit data forward so confirming re-learns cleanly', () => {
    const item = localParser.toParsedItem(localParser.matchPhrase('2 eggs').matched[0]);
    expect(item.caloriesPerUnit).toBe(70);
    expect(item.source).toBe('dictionary');
    expect(item.sourceText).toBe('2 eggs');
  });
});

describe('fuzzy stage, end to end', () => {
  it('refuses a typo of a rarely logged food', () => {
    teach('egg', 1, 70);
    expect(localParser.matchPhrase('2 gss').matched).toHaveLength(0);
  });

  it('accepts it once the food is well established', () => {
    teach('egg', 10, 70);
    const result = localParser.matchPhrase('2 gss');
    expect(result.matched[0]?.entry.name).toBe('egg');
    expect(result.matched[0]?.stage).toBe('fuzzy');
    expect(result.matched[0]?.confidence).toBeLessThan(1);
  });

  it('becomes an exact match after one confirmation', () => {
    teach('egg', 1, 70);
    const before = localParser.matchPhrase('2 gss');
    expect(before.matched).toHaveLength(0);

    // The user confirmed an AI parse of "2 gss" as eggs.
    dictionaryService.learn(entry({ sourceText: '2 gss' }), 'gemini');

    const after = localParser.matchPhrase('2 gss');
    expect(after.matched[0]?.stage).toBe('exact');
    expect(dictionaryService.count()).toBe(1);
  });

  it('refuses a tie between two similar foods', () => {
    teach('rice', 10, 130, 'grams');
    teach('rise', 10, 200, 'grams');
    expect(localParser.matchPhrase('2 rife').matched).toHaveLength(0);
  });
});

describe('response assembly', () => {
  it('sums totals across items', () => {
    teach('egg', 1, 70);
    teach('banana', 1, 90);
    const items = localParser.matchPhrase('2 eggs and a banana').matched.map(localParser.toParsedItem);
    const response = localParser.buildResponse(items, false);

    expect(response.status).toBe('valid');
    expect(response.totals?.calories).toBe(230);
  });

  it('hedges its wording when any item was guessed', () => {
    teach('egg', 1, 70);
    const items = localParser.matchPhrase('2 eggs').matched.map(localParser.toParsedItem);
    expect(localParser.buildResponse(items, true).reply).toMatch(/think you meant/i);
    expect(localParser.buildResponse(items, false).reply).toMatch(/your own foods/i);
  });
});

describe('management', () => {
  it('forgets an entry on request', () => {
    teach('egg', 3);
    const id = dictionaryService.findByAlias('egg')!.id;
    dictionaryService.remove(id);
    expect(dictionaryService.findByAlias('egg')).toBeNull();
  });

  it('lists most recently used first', () => {
    teach('egg', 1);
    teach('banana', 1);
    expect(dictionaryService.getAll()[0].name).toBe('banana');
  });
});
