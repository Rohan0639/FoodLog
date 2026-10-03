import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrisma, type Database } from '../src/db/client';
import {
  foodKey, parseFragment, parseMeal, splitFragments, type AiParser,
} from '../src/modules/parsing/foodParsing';

const url = process.env.DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

type CountingAi = AiParser & { calls: string[] };

/** A stand-in for Gemini that returns fixed macros and records every call. */
function eggAi(): CountingAi {
  const calls: string[] = [];
  const parser = (async (text: string) => {
    calls.push(text);
    return [{ name: 'egg', quantity: 2, unit: 'piece', calories: 140, protein: 12, carbs: 1, fat: 10, sugar: 0, fiber: 0 }];
  }) as CountingAi;
  parser.calls = calls;
  return parser;
}

function toastAi(): CountingAi {
  const calls: string[] = [];
  const parser = (async (text: string) => {
    calls.push(text);
    return [{ name: 'toast', quantity: 1, unit: 'slice', calories: 80, protein: 3, carbs: 15, fat: 1, sugar: 2, fiber: 2 }];
  }) as CountingAi;
  parser.calls = calls;
  return parser;
}

describe('parsing helpers (no database)', () => {
  it('splits on and, comma and plus, but never on with', () => {
    expect(splitFragments('2 eggs and toast, rice + milk')).toEqual(['2 eggs', 'toast', 'rice', 'milk']);
    expect(splitFragments('burger with cheese')).toEqual(['burger with cheese']);
  });

  it('reads the quantity and the food name', () => {
    expect(parseFragment('I had 2 eggs')).toEqual({ quantity: 2, name: 'eggs' });
    expect(parseFragment('200 g rice')).toEqual({ quantity: 200, name: 'rice' });
    expect(parseFragment('toast')).toEqual({ quantity: 1, name: 'toast' });
  });

  it('gives the same key for singular, plural and reordered names', () => {
    expect(foodKey('Eggs')).toBe(foodKey('egg'));
    expect(foodKey('brown rice')).toBe(foodKey('rice brown'));
    expect(foodKey('glass')).toBe('glass');
  });
});

describeIfDb('meal parsing with the user food table', () => {
  let db: Database;
  const userIds: string[] = [];
  const timeout = 60_000;

  async function newUser(): Promise<string> {
    const user = await db.user.create({
      data: { email: `parse-${randomUUID()}@example.test`, name: 'Parse', passwordHash: 'h' },
    });
    userIds.push(user.id);
    return user.id;
  }

  beforeAll(() => {
    db = createPrisma(url as string);
  });

  afterAll(async () => {
    if (userIds.length) await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  }, timeout);

  it('calls the AI for an unknown food, then saves it', async () => {
    const userId = await newUser();
    const ai = eggAi();

    const first = await parseMeal(db, userId, '2 eggs', ai);

    expect(ai.calls).toHaveLength(1);
    expect(first[0]).toMatchObject({ name: 'egg', source: 'ai', calories: 140 });
    const saved = await db.foodDictionaryEntry.findUniqueOrThrow({
      where: { userId_key: { userId, key: foodKey('egg') } },
    });
    expect(saved.caloriesPerUnit).toBeCloseTo(70);
  }, timeout);

  it('answers a repeat food from the table with no AI call, scaled to the quantity', async () => {
    const userId = await newUser();
    await parseMeal(db, userId, '2 eggs', eggAi());

    const ai = eggAi();
    const again = await parseMeal(db, userId, '3 eggs', ai);

    expect(ai.calls).toHaveLength(0);
    expect(again[0]).toMatchObject({ name: 'egg', source: 'dictionary', quantity: 3, calories: 210 });
  }, timeout);

  it('sends only the unknown part of a meal to the AI', async () => {
    const userId = await newUser();
    await parseMeal(db, userId, '2 eggs', eggAi());

    const ai = toastAi();
    const mixed = await parseMeal(db, userId, '2 eggs and toast', ai);

    expect(ai.calls).toEqual(['toast']);
    expect(mixed.map((f) => f.source)).toEqual(['dictionary', 'ai']);
  }, timeout);

  it('never shares saved foods between users', async () => {
    const owner = await newUser();
    const other = await newUser();
    await parseMeal(db, owner, '2 eggs', eggAi());

    const ai = eggAi();
    const result = await parseMeal(db, other, '2 eggs', ai);

    expect(ai.calls).toHaveLength(1);
    expect(result[0].source).toBe('ai');
  }, timeout);
});
