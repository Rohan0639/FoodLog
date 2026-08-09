import { describe, it, expect } from 'vitest';
import {
  editDistance, jaroWinkler, similarity, findBestMatch, MIN_CONFIDENCE,
} from '../src/lib/nlp/fuzzy';

/**
 * The only part of the app that guesses.
 *
 * Half these tests assert that it REFUSES. A false match writes wrong macros
 * into the diary silently; a refusal costs one API call. The asymmetry is the
 * whole design, so it needs guarding in both directions.
 */
describe('editDistance', () => {
  it('is zero for identical strings', () => {
    expect(editDistance('eggs', 'eggs')).toBe(0);
  });

  it('counts an adjacent transposition as one edit', () => {
    // "engg" for "eggs" is one slip of the fingers, not two.
    expect(editDistance('egsg', 'eggs')).toBe(1);
  });

  it('handles empty input', () => {
    expect(editDistance('', 'eggs')).toBe(4);
    expect(editDistance('eggs', '')).toBe(4);
  });

  it('counts substitutions, insertions and deletions', () => {
    expect(editDistance('chiken', 'chicken')).toBe(1);
    expect(editDistance('bananna', 'banana')).toBe(1);
  });
});

describe('jaroWinkler', () => {
  it('rewards a shared prefix', () => {
    expect(jaroWinkler('chicken', 'chikcen')).toBeGreaterThan(0.9);
  });

  it('scores 1 for an exact match and 0 for no overlap', () => {
    expect(jaroWinkler('rice', 'rice')).toBe(1);
    expect(jaroWinkler('abc', 'xyz')).toBe(0);
  });
});

describe('similarity', () => {
  it('rates real typos highly', () => {
    expect(similarity('bananna', 'banana')).toBeGreaterThan(0.85);
    expect(similarity('chiken', 'chicken')).toBeGreaterThan(0.85);
  });

  it('rates unrelated foods low', () => {
    expect(similarity('eggs', 'pizza')).toBeLessThan(0.5);
  });

  it('shows why plural forms are needed for matching', () => {
    // The documented reason surfaceForms() exists.
    expect(similarity('gss', 'egg')).toBeLessThan(0.2);
    expect(similarity('gss', 'eggs')).toBeGreaterThan(0.7);
  });
});

describe('findBestMatch — accepts', () => {
  it('matches an obvious typo of a frequently logged food', () => {
    const result = findBestMatch('bananna', [
      { id: 'banana', aliases: ['banana', 'bananas'], timesLogged: 10 },
    ]);
    expect(result?.id).toBe('banana');
    expect(result!.confidence).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });

  it('picks the clear winner when one candidate is much closer', () => {
    const result = findBestMatch('ricee', [
      { id: 'rice', aliases: ['rice'], timesLogged: 10 },
      { id: 'rise', aliases: ['rise'], timesLogged: 10 },
    ]);
    expect(result?.id).toBe('rice');
  });

  it('lets a short query through when history strongly supports it', () => {
    expect(findBestMatch('gss', [
      { id: 'egg', aliases: ['egg', 'eggs'], timesLogged: 20 },
    ])).not.toBeNull();
  });
});

describe('findBestMatch — refuses', () => {
  it('refuses an unrelated word', () => {
    expect(findBestMatch('pizza', [
      { id: 'egg', aliases: ['egg', 'eggs'], timesLogged: 50 },
    ])).toBeNull();
  });

  it('refuses a genuine tie rather than guessing', () => {
    // "rife" is exactly as close to both — no answer is the right answer.
    expect(findBestMatch('rife', [
      { id: 'rice', aliases: ['rice'], timesLogged: 10 },
      { id: 'rise', aliases: ['rise'], timesLogged: 10 },
    ])).toBeNull();
  });

  it('refuses a short query when the food is barely known', () => {
    // Three characters with two errors carries no signal on its own.
    expect(findBestMatch('gss', [
      { id: 'egg', aliases: ['egg', 'eggs'], timesLogged: 2 },
    ])).toBeNull();
  });

  it('refuses when there is nothing to match against', () => {
    expect(findBestMatch('eggs', [])).toBeNull();
    expect(findBestMatch('', [{ id: 'a', aliases: ['egg'], timesLogged: 9 }])).toBeNull();
  });

  it('cannot be carried by frequency alone', () => {
    // A poor similarity must stay rejected no matter how often it was logged.
    expect(findBestMatch('xyzzy', [
      { id: 'egg', aliases: ['egg', 'eggs'], timesLogged: 10000 },
    ])).toBeNull();
  });
});

describe('shape guard — a typo is not a different phrase', () => {
  it('refuses a query that is merely a prefix of a longer name', () => {
    // Jaro-Winkler scores "chicken" vs "chicken soup" at 0.917 on prefix alone.
    // Without the guard this logged the wrong food.
    expect(findBestMatch('chicken', [
      { id: 'soup', aliases: ['chicken soup'], timesLogged: 20 },
    ])).toBeNull();
  });

  it('refuses a word borrowed from a multi-word alias', () => {
    expect(findBestMatch('chicken', [
      { id: 'egg', aliases: ['egg', 'chicken egg'], timesLogged: 20 },
    ])).toBeNull();
  });

  it('still accepts genuine single-word typos', () => {
    for (const [typo, word] of [['bananna', 'banana'], ['chiken', 'chicken'], ['chikcen', 'chicken']]) {
      expect(findBestMatch(typo, [{ id: word, aliases: [word], timesLogged: 10 }]), typo).not.toBeNull();
    }
  });

  it('still accepts a typo inside a multi-word name', () => {
    expect(findBestMatch('britannia bred', [
      { id: 'b', aliases: ['britannia bread'], timesLogged: 10 },
    ])).not.toBeNull();
  });
});

describe('vocabulary guard — a real food is never rewritten', () => {
  /**
   * Each of these is a pair of DIFFERENT real foods that sit within typo
   * distance of each other. Every one silently logged the wrong food before
   * the vocabulary guard.
   */
  it.each([
    ['beef', 'beer'], ['pear', 'peas'], ['corn', 'cord'], ['ham', 'jam'],
    ['tea', 'pea'], ['cake', 'kale'], ['soda', 'soup'], ['lime', 'lima'],
    ['chicken', 'chicken soup'], ['egg', 'eggplant'], ['apple', 'pineapple'],
    ['milk', 'milkshake'], ['rice', 'ripe'],
  ])('typing %j never resolves to a stored %j', (query, stored) => {
    expect(findBestMatch(query, [
      { id: stored, aliases: [stored], timesLogged: 50 },
    ])).toBeNull();
  });

  it('still corrects words that are not foods at all', () => {
    for (const [typo, food] of [
      ['bananna', 'banana'], ['chiken', 'chicken'], ['chikcen', 'chicken'],
      ['brocoli', 'broccoli'], ['yoghrt', 'yoghurt'],
    ]) {
      expect(findBestMatch(typo, [{ id: food, aliases: [food], timesLogged: 10 }]), typo)
        .not.toBeNull();
    }
  });

  it('still corrects a typo inside a multi-word name', () => {
    expect(findBestMatch('britannia bred', [
      { id: 'b', aliases: ['britannia bread'], timesLogged: 10 },
    ])).not.toBeNull();
  });
});
