import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from './setup';
import { mergeIntoDb, toPayload, isValidPayload, type SyncPayload } from '../src/lib/sync/merge';
import * as tombstoneStore from '../src/lib/sync/tombstones';
import { readDb, invalidate, flushPersist } from '../src/lib/storage/localDb';
import { createEmptyDb, normalizeDb, type FoodLogRecord } from '../src/lib/storage/schema';
import * as logService from '../src/lib/services/logService';
import * as dictionaryService from '../src/lib/services/dictionaryService';
import { getLocalIsoDate } from '../src/utils/date';

const today = getLocalIsoDate();

const log = (id: string, name: string, kcal: number, updatedAt: string): FoodLogRecord => ({
  id, date: today, createdAt: updatedAt, updatedAt, name,
  quantity: 1, unit: 'piece', calories: kcal,
  protein: 1, carbs: 2, fats: 3, sugar: 4, fiber: 5,
});

const emptyPayload = (over: Partial<SyncPayload> = {}): SyncPayload => ({
  logs: [], foodDictionary: [], favorites: [], tombstones: [],
  goals: createEmptyDb().goals, settings: {},
  preferencesUpdatedAt: new Date(0).toISOString(),
  ...over,
});

beforeEach(async () => {
  await flushPersist();
  resetStore();
  invalidate();
});

/**
 * The property that matters most: syncing must never make a meal disappear.
 * A crash is obvious; a silently missing day is not.
 */
describe('nothing is lost', () => {
  it('keeps a record the other device has never seen', () => {
    const db = { ...createEmptyDb(), logs: [log('mine', 'egg', 70, '2026-08-01T08:00:00Z')] };
    const { db: merged } = mergeIntoDb(db, emptyPayload());
    expect(merged.logs.map((l) => l.id)).toEqual(['mine']);
  });

  it('adds a record only the other device has', () => {
    const { db: merged } = mergeIntoDb(
      createEmptyDb(),
      emptyPayload({ logs: [log('theirs', 'rice', 200, '2026-08-01T09:00:00Z')] })
    );
    expect(merged.logs.map((l) => l.id)).toEqual(['theirs']);
  });

  it('unions both sides when they are entirely different', () => {
    const db = { ...createEmptyDb(), logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z')] };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('b', 'rice', 200, '2026-08-01T09:00:00Z')] })
    );
    expect(merged.logs.map((l) => l.id).sort()).toEqual(['a', 'b']);
  });

  it('an empty remote file never wipes a full local diary', () => {
    // The nightmare case: signing in on a device whose file is empty.
    const db = {
      ...createEmptyDb(),
      logs: Array.from({ length: 50 }, (_, i) => log(`l${i}`, 'food', 100, '2026-08-01T08:00:00Z')),
    };
    const { db: merged } = mergeIntoDb(db, emptyPayload());
    expect(merged.logs).toHaveLength(50);
  });

  it('is idempotent — syncing twice changes nothing', () => {
    const db = { ...createEmptyDb(), logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z')] };
    const remote = emptyPayload({ logs: [log('b', 'rice', 200, '2026-08-01T09:00:00Z')] });

    const once = mergeIntoDb(db, remote).db;
    const twice = mergeIntoDb(once, remote).db;
    expect(twice.logs).toEqual(once.logs);
  });

  it('is order-independent — either device can sync first', () => {
    const a = log('a', 'egg', 70, '2026-08-01T08:00:00Z');
    const b = log('b', 'rice', 200, '2026-08-01T09:00:00Z');

    const fromA = mergeIntoDb({ ...createEmptyDb(), logs: [a] }, emptyPayload({ logs: [b] })).db;
    const fromB = mergeIntoDb({ ...createEmptyDb(), logs: [b] }, emptyPayload({ logs: [a] })).db;

    expect(fromA.logs.map((l) => l.id).sort()).toEqual(fromB.logs.map((l) => l.id).sort());
  });
});

describe('conflicting edits', () => {
  it('the later edit wins', () => {
    const db = { ...createEmptyDb(), logs: [log('a', 'old name', 70, '2026-08-01T08:00:00Z')] };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('a', 'new name', 99, '2026-08-01T12:00:00Z')] })
    );
    expect(merged.logs[0].name).toBe('new name');
    expect(merged.logs[0].calories).toBe(99);
  });

  it('an older remote copy does not overwrite a newer local edit', () => {
    const db = { ...createEmptyDb(), logs: [log('a', 'local edit', 99, '2026-08-01T12:00:00Z')] };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('a', 'stale', 70, '2026-08-01T08:00:00Z')] })
    );
    expect(merged.logs[0].name).toBe('local edit');
  });

  it('never duplicates a record that exists on both sides', () => {
    const db = { ...createEmptyDb(), logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z')] };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z')] })
    );
    expect(merged.logs).toHaveLength(1);
  });
});

describe('deletions travel', () => {
  it('a deletion on the other device removes it here', () => {
    const db = { ...createEmptyDb(), logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z')] };
    const { db: merged, stats } = mergeIntoDb(
      db,
      emptyPayload({
        tombstones: [{ id: 'a', collection: 'log', deletedAt: '2026-08-01T10:00:00Z' }],
      })
    );
    expect(merged.logs).toHaveLength(0);
    expect(stats.logsDeleted).toBe(1);
  });

  it('a deleted record is not resurrected by a device that still holds it', () => {
    // The classic sync bug: without tombstones the stale copy pushes it back.
    const db = {
      ...createEmptyDb(),
      tombstones: [{ id: 'a', collection: 'log' as const, deletedAt: '2026-08-01T10:00:00Z' }],
    };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z')] })
    );
    expect(merged.logs).toHaveLength(0);
  });

  it('but an edit made AFTER the deletion brings it back', () => {
    // Deleting on the phone then editing on the laptop means the user changed
    // their mind; the later action is the real intent.
    const db = {
      ...createEmptyDb(),
      tombstones: [{ id: 'a', collection: 'log' as const, deletedAt: '2026-08-01T10:00:00Z' }],
    };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('a', 'edited later', 88, '2026-08-01T18:00:00Z')] })
    );
    expect(merged.logs).toHaveLength(1);
    expect(merged.logs[0].name).toBe('edited later');
  });

  it('a deletion does not touch other records', () => {
    const db = {
      ...createEmptyDb(),
      logs: [log('a', 'egg', 70, '2026-08-01T08:00:00Z'), log('b', 'rice', 200, '2026-08-01T08:00:00Z')],
    };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ tombstones: [{ id: 'a', collection: 'log', deletedAt: '2026-08-01T10:00:00Z' }] })
    );
    expect(merged.logs.map((l) => l.id)).toEqual(['b']);
  });

  it('a dictionary deletion does not delete a log with the same id', () => {
    const db = {
      ...createEmptyDb(),
      logs: [log('shared-id', 'egg', 70, '2026-08-01T08:00:00Z')],
    };
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({
        tombstones: [{ id: 'shared-id', collection: 'dictionary', deletedAt: '2026-08-01T10:00:00Z' }],
      })
    );
    expect(merged.logs).toHaveLength(1);
  });
});

describe('tombstone housekeeping', () => {
  it('keeps the later of two tombstones for the same record', () => {
    const db = {
      ...createEmptyDb(),
      tombstones: [{ id: 'a', collection: 'log' as const, deletedAt: '2026-08-01T08:00:00Z' }],
    };
    const merged = tombstoneStore.merge(db, [
      { id: 'a', collection: 'log', deletedAt: '2026-08-01T18:00:00Z' },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].deletedAt).toBe('2026-08-01T18:00:00Z');
  });

  it('drops tombstones old enough that every device has seen them', () => {
    const old = new Date(Date.now() - 200 * 86_400_000).toISOString();
    const recent = new Date(Date.now() - 1 * 86_400_000).toISOString();
    const kept = tombstoneStore.prune([
      { id: 'old', collection: 'log', deletedAt: old },
      { id: 'recent', collection: 'log', deletedAt: recent },
    ]);
    expect(kept.map((t) => t.id)).toEqual(['recent']);
  });
});

describe('existing data survives the upgrade', () => {
  it('back-fills updatedAt on records written before syncing existed', () => {
    const normalised = normalizeDb({
      logs: [{ id: 'a', name: 'egg', date: today, createdAt: '2026-07-01T08:00:00Z' }],
      foodDictionary: [{
        id: 'd', name: 'egg', aliases: ['egg'], baseUnit: 'piece',
        perUnit: { calories: 70, protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0 },
        timesLogged: 3, lastLoggedAt: '2026-07-02T08:00:00Z', createdAt: '2026-07-01T08:00:00Z',
        source: 'gemini',
      }],
    });

    // Back-filled from when they were written, NOT from "now" — otherwise an
    // old local record would outrank a genuinely newer one from another device.
    expect(normalised.logs[0].updatedAt).toBe('2026-07-01T08:00:00Z');
    expect(normalised.foodDictionary[0].updatedAt).toBe('2026-07-02T08:00:00Z');
  });

  it('gives an old store an empty tombstone list rather than failing', () => {
    expect(normalizeDb({ logs: [] }).tombstones).toEqual([]);
  });

  it('a back-filled old record loses to a genuinely newer remote edit', () => {
    const db = normalizeDb({
      logs: [{ id: 'a', name: 'old', date: today, createdAt: '2026-07-01T08:00:00Z', calories: 1,
               quantity: 1, unit: 'piece', protein: 0, carbs: 0, fats: 0, sugar: 0, fiber: 0 }],
    });
    const { db: merged } = mergeIntoDb(
      db,
      emptyPayload({ logs: [log('a', 'newer', 99, '2026-08-01T08:00:00Z')] })
    );
    expect(merged.logs[0].name).toBe('newer');
  });
});

describe('live service integration', () => {
  it('stamps updatedAt when a log is created', () => {
    logService.addLogs([{
      id: 'x', name: 'egg', quantity: 1, unit: 'piece', calories: 70,
      protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0,
      createdAt: `${today}T08:00:00.000Z`,
    }]);
    expect(readDb().logs[0].updatedAt).toBeTruthy();
  });

  it('leaves a tombstone when a log is deleted', () => {
    logService.addLogs([{
      id: 'x', name: 'egg', quantity: 1, unit: 'piece', calories: 70,
      protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0,
      createdAt: `${today}T08:00:00.000Z`,
    }]);
    logService.deleteLog('x');

    expect(readDb().logs).toHaveLength(0);
    expect(readDb().tombstones).toEqual([
      expect.objectContaining({ id: 'x', collection: 'log' }),
    ]);
  });

  it('leaves a tombstone for every entry when a day is cleared', () => {
    logService.addLogs([
      { id: 'a', name: 'egg', quantity: 1, unit: 'piece', calories: 70, protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0, createdAt: `${today}T08:00:00.000Z` },
      { id: 'b', name: 'rice', quantity: 1, unit: 'piece', calories: 200, protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0, createdAt: `${today}T09:00:00.000Z` },
    ]);
    logService.clearDate(today);
    expect(readDb().tombstones.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('leaves a tombstone when a learned food is forgotten', () => {
    dictionaryService.learn({
      id: 'e', name: 'egg', quantity: 1, unit: 'piece', calories: 70,
      protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0,
      createdAt: `${today}T08:00:00.000Z`,
    }, 'gemini');

    const entry = dictionaryService.getAll()[0];
    dictionaryService.remove(entry.id);

    expect(readDb().tombstones).toEqual([
      expect.objectContaining({ id: entry.id, collection: 'dictionary' }),
    ]);
  });
});

describe('payload safety', () => {
  it('round-trips through a payload without loss', () => {
    logService.addLogs([{
      id: 'x', name: 'egg', quantity: 1, unit: 'piece', calories: 70,
      protein: 6, carbs: 1, fats: 5, sugar: 0, fiber: 0,
      createdAt: `${today}T08:00:00.000Z`,
    }]);

    const payload = toPayload(readDb());
    const { db: merged } = mergeIntoDb(createEmptyDb(), payload);
    expect(merged.logs).toHaveLength(1);
    expect(merged.logs[0].calories).toBe(70);
  });

  it('excludes chat and the parse cache from what is sent', () => {
    const payload = toPayload(readDb()) as Record<string, unknown>;
    expect(payload.chat).toBeUndefined();
    expect(payload.parseCache).toBeUndefined();
  });

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an unrelated object', { foo: 1 }],
    ['a payload with no logs array', { foodDictionary: [] }],
  ])('rejects %s as a payload', (_label, value) => {
    expect(isValidPayload(value)).toBe(false);
  });
});
