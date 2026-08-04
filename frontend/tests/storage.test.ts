import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from './setup';
import { readDb, invalidate } from '../src/lib/storage/localDb';
import { DB_KEY, normalizeDb, createEmptyDb } from '../src/lib/storage/schema';
import * as logService from '../src/lib/services/logService';
import * as statsService from '../src/lib/services/statsService';
import * as backupService from '../src/lib/services/backupService';
import { getLocalIsoDate, addDays, monthTransition } from '../src/utils/date';
import { scaleMacrosByQuantity } from '../src/utils/unitConverter';
import type { FoodEntry } from '../src/types';

const today = getLocalIsoDate();

const log = (id: string, name: string, kcal: number, iso: string): FoodEntry => ({
  id, name, quantity: 1, unit: 'piece', calories: kcal,
  protein: 1, carbs: 2, fats: 3, sugar: 4, fiber: 5, createdAt: iso,
});

beforeEach(() => {
  resetStore();
  invalidate();
});

describe('schema resilience', () => {
  it('back-fills keys added after a store was written', () => {
    // Additive fields must not require a migration.
    const old = { schemaVersion: 1, logs: [], meta: {} };
    const normalised = normalizeDb(old);
    expect(Array.isArray(normalised.foodDictionary)).toBe(true);
    expect(normalised.goals.calories).toBe(createEmptyDb().goals.calories);
  });

  it('drops records too broken to query or render', () => {
    const normalised = normalizeDb({
      logs: [
        { id: 'ok', name: 'egg', date: today },
        { id: 'no-date', name: 'egg' },
        { name: 'no-id', date: today },
        'nonsense',
      ],
    });
    expect(normalised.logs).toHaveLength(1);
  });

  it('drops dictionary entries that could not be rescaled', () => {
    const normalised = normalizeDb({
      foodDictionary: [
        { id: 'a', name: 'egg', aliases: ['egg'], baseUnit: 'piece', perUnit: { calories: 70 } },
        { id: 'b', name: 'broken', aliases: ['x'], baseUnit: 'piece' }, // no perUnit
      ],
    });
    expect(normalised.foodDictionary).toHaveLength(1);
  });

  it('recovers from an unreadable payload instead of throwing', () => {
    localStorage.setItem(DB_KEY, '{ not json');
    invalidate();
    expect(() => readDb()).not.toThrow();
    expect(readDb().logs).toEqual([]);
  });

  it('quarantines the unreadable payload rather than discarding it', () => {
    localStorage.setItem(DB_KEY, '{ not json');
    invalidate();
    readDb();

    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)!);
    expect(keys.some((k) => k.startsWith('foodlog_db_v1__corrupt__'))).toBe(true);
  });
});

describe('log queries', () => {
  beforeEach(() => {
    logService.addLogs([
      log('a', 'egg', 70, `${today}T08:00:00.000Z`),
      log('b', 'rice', 200, `${today}T13:00:00.000Z`),
      log('c', 'old', 300, `${addDays(today, -3)}T13:00:00.000Z`),
    ]);
  });

  it('returns a day newest-first by default', () => {
    expect(logService.getLogsByDate(today).map((l) => l.id)).toEqual(['b', 'a']);
  });

  it('returns oldest-first on request', () => {
    expect(logService.getLogsByDate(today, 'asc').map((l) => l.id)).toEqual(['a', 'b']);
  });

  it('buckets entries by local day, not UTC', () => {
    expect(logService.getLogsByDate(addDays(today, -3))).toHaveLength(1);
  });

  it('preserves the day when an entry is edited', () => {
    logService.updateLog({ ...log('a', 'boiled egg', 78, `${today}T08:00:00.000Z`) });
    const updated = logService.getLogsByDate(today).find((l) => l.id === 'a')!;
    expect(updated.name).toBe('boiled egg');
    expect(updated.date).toBe(today);
  });

  it('clears only the requested day', () => {
    logService.clearDate(today);
    expect(logService.getLogsByDate(today)).toHaveLength(0);
    expect(logService.countLogs()).toBe(1);
  });

  it('merges by id without creating duplicates', () => {
    const added = logService.mergeLogs([
      { ...log('a', 'DIFFERENT', 999, `${today}T08:00:00.000Z`), date: today },
    ] as never);
    expect(added).toBe(0);
    expect(logService.getLogsByDate(today).find((l) => l.id === 'a')!.name).toBe('egg');
  });
});

describe('statistics', () => {
  it('counts consecutive days ending today', () => {
    logService.addLogs([
      log('t', 'x', 100, `${today}T10:00:00.000Z`),
      log('y', 'x', 100, `${addDays(today, -1)}T10:00:00.000Z`),
      log('z', 'x', 100, `${addDays(today, -2)}T10:00:00.000Z`),
    ]);
    expect(statsService.getHistoryStats().streak).toBe(3);
  });

  it('does not break the streak just because today is not logged yet', () => {
    logService.addLogs([log('y', 'x', 100, `${addDays(today, -1)}T10:00:00.000Z`)]);
    expect(statsService.getHistoryStats().streak).toBe(1);
  });

  it('resets once a full day is missed', () => {
    logService.addLogs([log('o', 'x', 100, `${addDays(today, -3)}T10:00:00.000Z`)]);
    expect(statsService.getHistoryStats().streak).toBe(0);
  });

  it('charts seven days ending today', () => {
    const { graphData } = statsService.getHistoryStats();
    expect(graphData).toHaveLength(7);
    expect(graphData[6].date).toBe(today);
  });
});

describe('macro scaling', () => {
  const base = { calories: 100, protein: 10, carbs: 20, fats: 5, sugar: 2, fiber: 1 };

  it('scales linearly within a unit', () => {
    expect(scaleMacrosByQuantity(base, 2, 'grams', 1, 'grams', 'x').calories).toBe(200);
  });

  it('honours the rounding contract: integer kcal, 1dp macros', () => {
    const scaled = scaleMacrosByQuantity(base, 1.5, 'grams', 1, 'grams', 'x');
    expect(Number.isInteger(scaled.calories)).toBe(true);
    expect(scaled.protein).toBe(15);
  });

  it('never returns negatives', () => {
    const scaled = scaleMacrosByQuantity(base, 0, 'grams', 1, 'grams', 'x');
    expect(scaled.calories).toBe(0);
  });

  it('returns zeros for an invalid quantity rather than NaN', () => {
    const scaled = scaleMacrosByQuantity(base, NaN, 'grams', 1, 'grams', 'x');
    expect(scaled.calories).toBe(0);
    expect(Number.isNaN(scaled.protein)).toBe(false);
  });
});

describe('backup', () => {
  beforeEach(() => {
    logService.addLogs([log('a', 'egg', 70, `${today}T08:00:00.000Z`)]);
  });

  it('round-trips the store exactly', () => {
    const payload = backupService.serialize();
    resetStore(); invalidate();
    expect(logService.countLogs()).toBe(0);

    backupService.restore(payload);
    expect(logService.countLogs()).toBe(1);
    expect(logService.getLogsByDate(today)[0].calories).toBe(70);
  });

  it('names the file by date', () => {
    expect(backupService.suggestedFilename()).toBe(`foodlog-backup-${today}.json`);
  });

  it.each([
    ['malformed json', 'hello {'],
    ['an unrelated object', '{"foo":1}'],
    ['an array', '[1,2,3]'],
    ['empty', ''],
  ])('rejects %s', (_label, payload) => {
    expect(() => backupService.inspect(payload)).toThrow();
  });

  it('leaves the store untouched when a file is rejected', () => {
    try { backupService.restore('{"foo":1}'); } catch { /* expected */ }
    expect(logService.countLogs()).toBe(1);
  });
});

describe('calendar month transition', () => {
  it('stays put when the selected date is already visible', () => {
    expect(monthTransition('2026-08-15', 2026, 7)).toBeNull();
  });

  it('advances forward across a month boundary', () => {
    const jump = monthTransition('2026-09-01', 2026, 7)!;
    expect(jump.month).toBe(8);
    expect(jump.direction).toBe(1);
  });

  it('goes backward across a year boundary', () => {
    const jump = monthTransition('2025-12-31', 2026, 0)!;
    expect(jump.year).toBe(2025);
    expect(jump.month).toBe(11);
    expect(jump.direction).toBe(-1);
  });

  it('goes forward across a year boundary', () => {
    expect(monthTransition('2027-01-02', 2026, 11)!.direction).toBe(1);
  });

  it('ignores an unparseable date rather than jumping somewhere wrong', () => {
    expect(monthTransition('not-a-date', 2026, 7)).toBeNull();
  });
});

describe('backup risk assessment', () => {
  const many = () => logService.addLogs(
    Array.from({ length: 20 }, (_, i) => log(`r${i}`, 'x', 10, `${today}T08:00:00.000Z`))
  );

  it('stays quiet until there is enough to lose', () => {
    logService.addLogs([log('a', 'egg', 70, `${today}T08:00:00.000Z`)]);
    expect(backupService.assessRisk().atRisk).toBe(false);
  });

  it('warns once enough entries exist and none were ever backed up', () => {
    many();
    const risk = backupService.assessRisk();
    expect(risk.atRisk).toBe(true);
    expect(risk.daysSinceBackup).toBeNull();
  });

  it('goes quiet after a backup', () => {
    many();
    backupService.markBackedUp();
    expect(backupService.assessRisk().atRisk).toBe(false);
    expect(backupService.assessRisk().daysSinceBackup).toBe(0);
  });

  it('respects a snooze', () => {
    many();
    expect(backupService.assessRisk().atRisk).toBe(true);
    backupService.snoozeReminder(7);
    expect(backupService.assessRisk().atRisk).toBe(false);
  });

  it('returns after the snooze expires', () => {
    many();
    backupService.snoozeReminder(-1); // already elapsed
    expect(backupService.assessRisk().atRisk).toBe(true);
  });
});
