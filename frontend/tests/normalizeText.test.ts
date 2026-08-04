import { describe, it, expect } from 'vitest';
import {
  parsePhrase, foodKey, splitParts, surfaceForms, singularise, basicClean,
} from '../src/lib/nlp/normalizeText';

/**
 * These functions decide which foods match. A regression here does not crash —
 * it silently writes the wrong macros into someone's diary, which is why this
 * is the most valuable file in the suite.
 */
describe('parsePhrase', () => {
  it.each([
    // input                  qty    unit          foodKey
    ['2 eggs',                2,     null,         'egg'],
    ['two eggs',              2,     null,         'egg'],
    ['TWO EGGS',              2,     null,         'egg'],
    ['I had an egg',          1,     null,         'egg'],
    ['eggs',                  null,  null,         'egg'],
    ['egg.',                  null,  null,         'egg'],
    ['3 egg',                 3,     null,         'egg'],
    ['300g chicken',          300,   'grams',      'chicken'],
    ['300 grams chicken',     300,   'grams',      'chicken'],
    ['300 gms chicken',       300,   'grams',      'chicken'],
    ['1.5 kg rice',           1.5,   'kilograms',  'rice'],
    ['250ml milk',            250,   'ml',         'milk'],
    ['2 pcs bread',           2,     'piece',      'bread'],
    ['a couple of eggs',      2,     null,         'egg'],
    ['half a cup of milk',    0.5,   'cup',        'milk'],
    ['a dozen eggs',          12,    null,         'egg'],
    ['I ate some rice',       null,  null,         'rice'],
  ])('parses %j', (input, quantity, unit, key) => {
    const result = parsePhrase(input as string);
    expect(result.quantity).toBe(quantity);
    expect(result.unit).toBe(unit);
    expect(result.foodKey).toBe(key);
  });

  it('treats "a"/"an" as one only when nothing better was said', () => {
    // Regression: "a" used to claim the quantity slot before "couple" was seen.
    expect(parsePhrase('a couple of eggs').quantity).toBe(2);
    expect(parsePhrase('an egg').quantity).toBe(1);
  });

  it('is word-order insensitive, so a food name matches either way round', () => {
    expect(parsePhrase('brown rice').foodKey).toBe(parsePhrase('rice brown').foodKey);
  });

  it('survives empty and junk input', () => {
    expect(parsePhrase('').foodKey).toBe('');
    expect(parsePhrase('   ').foodKey).toBe('');
    expect(parsePhrase('!!!').foodKey).toBe('');
  });
});

describe('singularise', () => {
  it.each([
    ['eggs', 'egg'],
    ['bananas', 'banana'],
    ['berries', 'berry'],
    ['tomatoes', 'tomato'],
  ])('%s -> %s', (input, expected) => {
    expect(singularise(input)).toBe(expected);
  });

  it('leaves words that only look plural alone', () => {
    // Stripping these does more harm than good.
    expect(singularise('glass')).toBe('glass');
    expect(singularise('hummus')).toBe('hummus');
    expect(singularise('rice')).toBe('rice');
    expect(singularise('gss')).toBe('gss'); // too short to judge
  });
});

describe('surfaceForms', () => {
  it('offers the plural, because a mistyped plural resembles the plural', () => {
    // "gss" scores 0.72 against "eggs" but 0.00 against "egg". Without this the
    // fuzzy layer misses the exact cases it exists for.
    expect(surfaceForms('egg')).toContain('eggs');
  });

  it('pluralises only the last word of a compound name', () => {
    expect(surfaceForms('brown rice')).toContain('brown rices');
  });

  it('uses -es where -s would be unpronounceable', () => {
    expect(surfaceForms('sandwich')).toContain('sandwiches');
  });

  it('does not double up an existing plural', () => {
    expect(surfaceForms('chips')).toEqual(['chips']);
  });
});

describe('splitParts', () => {
  it('splits on and, comma, plus and ampersand', () => {
    expect(splitParts('2 eggs and toast, milk + tea & jam')).toEqual([
      '2 eggs', 'toast', 'milk', 'tea', 'jam',
    ]);
  });

  it('never splits on "with" — that is one dish', () => {
    expect(splitParts('burger with cheese')).toEqual(['burger with cheese']);
  });

  it('drops empty fragments', () => {
    expect(splitParts('eggs,,  , and')).toEqual(['eggs']);
  });
});

describe('foodKey', () => {
  it('collapses every spelling of the same food to one key', () => {
    const keys = ['2 eggs', 'two eggs', 'EGGS', 'egg', 'an egg', 'eggs.'].map(foodKey);
    expect(new Set(keys).size).toBe(1);
  });
});

describe('basicClean', () => {
  it('strips punctuation and collapses whitespace', () => {
    expect(basicClean('  Hello,   WORLD!  ')).toBe('hello world');
  });

  it('keeps decimal points intact', () => {
    expect(basicClean('1.5 kg')).toContain('1.5');
  });
});
