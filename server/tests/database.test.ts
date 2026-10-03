import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createPrisma, pingDatabase, type Database } from '../src/db/client';

/**
 * These tests run against the database in DATABASE_URL (your Supabase project).
 * Every row they create uses a unique email and is removed afterwards.
 */
const url = process.env.DATABASE_URL;
const describeIfDb = url ? describe : describe.skip;

describeIfDb('database (Supabase / PostgreSQL)', () => {
  let db: Database;
  const emails: string[] = [];
  const timeout = 60_000;

  const newEmail = () => {
    const email = `test-${randomUUID()}@example.test`;
    emails.push(email);
    return email;
  };

  beforeAll(() => {
    db = createPrisma(url as string);
  });

  afterAll(async () => {
    if (emails.length) await db.user.deleteMany({ where: { email: { in: emails } } });
    await db.$disconnect();
  }, timeout);

  it('answers a trivial query', async () => {
    await expect(pingDatabase(db)).resolves.toBeUndefined();
  }, timeout);

  it('stores a user and reads it back', async () => {
    const email = newEmail();
    const created = await db.user.create({
      data: { email, name: 'Test', passwordHash: 'not-a-real-hash' },
    });
    const found = await db.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(found.email).toBe(email);
    expect(found.createdAt).toBeInstanceOf(Date);
  }, timeout);

  it('rejects a duplicate email', async () => {
    const email = newEmail();
    await db.user.create({ data: { email, name: 'A', passwordHash: 'h' } });
    await expect(
      db.user.create({ data: { email, name: 'B', passwordHash: 'h' } })
    ).rejects.toMatchObject({ code: 'P2002' });
  }, timeout);

  it('allows only one diary day per user (unique userId + date)', async () => {
    const user = await db.user.create({
      data: { email: newEmail(), name: 'Day', passwordHash: 'h' },
    });
    const date = new Date('2026-01-15T00:00:00Z');
    await db.foodLog.create({ data: { userId: user.id, date } });
    await expect(
      db.foodLog.create({ data: { userId: user.id, date } })
    ).rejects.toMatchObject({ code: 'P2002' });
  }, timeout);

  it('deletes a user\'s logs, items and goal together (cascade)', async () => {
    const user = await db.user.create({
      data: { email: newEmail(), name: 'Cascade', passwordHash: 'h' },
    });
    const log = await db.foodLog.create({
      data: {
        userId: user.id,
        date: new Date('2026-02-01T00:00:00Z'),
        items: {
          create: [{ name: 'egg', quantity: 2, unit: 'piece', calories: 140, protein: 12, carbs: 1, fat: 10 }],
        },
      },
    });
    await db.dailyGoal.create({ data: { userId: user.id } });

    await db.user.delete({ where: { id: user.id } });

    expect(await db.foodLog.count({ where: { id: log.id } })).toBe(0);
    expect(await db.foodItem.count({ where: { foodLogId: log.id } })).toBe(0);
    expect(await db.dailyGoal.count({ where: { userId: user.id } })).toBe(0);
  }, timeout);

  it('stores a favourite once per user and name', async () => {
    const user = await db.user.create({
      data: { email: newEmail(), name: 'Fav', passwordHash: 'h' },
    });
    const data = { userId: user.id, name: 'banana', quantity: 1, unit: 'piece', calories: 90, protein: 1, carbs: 23, fat: 0 };
    await db.favoriteFood.create({ data });
    await expect(db.favoriteFood.create({ data })).rejects.toMatchObject({ code: 'P2002' });
  }, timeout);
});
