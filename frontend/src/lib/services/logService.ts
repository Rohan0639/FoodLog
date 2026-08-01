/**
 * Food-log CRUD. Replaces every `supabase.from('food_logs')` call.
 *
 * Reads are synchronous — there is no network — but each function is written so
 * a caller can `await` it without changing behaviour, which keeps the call sites
 * in the components identical in shape to the queries they replaced.
 */

import { readDb, updateDb } from '../storage/localDb';
import { newId, type FoodLogRecord } from '../storage/schema';
import type { FoodEntry } from '../../types';
import { getCurrentIsoString, monthBounds, parseLocalDateString } from '../../utils/date';

type SortOrder = 'asc' | 'desc';

function byCreatedAt(order: SortOrder) {
  return (a: FoodLogRecord, b: FoodLogRecord) => {
    const left = a.createdAt || '';
    const right = b.createdAt || '';
    if (left === right) return 0;
    return order === 'asc' ? (left < right ? -1 : 1) : (left < right ? 1 : -1);
  };
}

/**
 * Normalises a UI entry into a storable record.
 * `date` is always derived from `createdAt` so the day bucket and the timestamp
 * can never disagree.
 */
export function toRecord(entry: FoodEntry): FoodLogRecord {
  const createdAt = entry.createdAt || getCurrentIsoString();
  return {
    id: entry.id || newId(),
    date: parseLocalDateString(createdAt),
    createdAt,
    name: entry.name || 'Unknown',
    quantity: entry.quantity,
    unit: entry.unit,
    calories: entry.calories || 0,
    protein: entry.protein || 0,
    carbs: entry.carbs || 0,
    fats: entry.fats || 0,
    sugar: entry.sugar || 0,
    fiber: entry.fiber || 0,
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** All entries for one local day. Defaults to newest-first, as the old query did. */
export function getLogsByDate(date: string, order: SortOrder = 'desc'): FoodLogRecord[] {
  return readDb()
    .logs.filter((log) => log.date === date)
    .sort(byCreatedAt(order));
}

/** All entries in the half-open range `[start, end)`. */
export function getLogsInRange(start: string, end: string): FoodLogRecord[] {
  return readDb()
    .logs.filter((log) => log.date >= start && log.date < end)
    .sort(byCreatedAt('asc'));
}

/** Distinct days that have at least one entry, newest first. */
export function getLoggedDates(): string[] {
  const seen = new Set<string>();
  for (const log of readDb().logs) {
    if (log.date) seen.add(log.date);
  }
  return Array.from(seen).sort().reverse();
}

/** Distinct logged days within a `YYYY-MM` month — drives the calendar dots. */
export function getLoggedDatesInMonth(month: string): string[] {
  const { start, end } = monthBounds(month);
  const seen = new Set<string>();
  for (const log of readDb().logs) {
    if (log.date && log.date >= start && log.date < end) seen.add(log.date);
  }
  return Array.from(seen);
}

/** Total calories per day for the given days. Days with no entries are omitted. */
export function getCaloriesByDate(dates: string[]): Record<string, number> {
  const wanted = new Set(dates);
  const totals: Record<string, number> = {};
  for (const log of readDb().logs) {
    if (log.date && wanted.has(log.date)) {
      totals[log.date] = (totals[log.date] || 0) + (log.calories || 0);
    }
  }
  return totals;
}

/** Total number of stored entries. Used to verify the legacy import. */
export function countLogs(): number {
  return readDb().logs.length;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/** Appends entries and returns them as stored. */
export function addLogs(entries: FoodEntry[]): FoodLogRecord[] {
  const records = entries.map(toRecord);
  if (records.length === 0) return [];
  updateDb((db) => ({ ...db, logs: [...db.logs, ...records] }));
  return records;
}

/**
 * Applies an edit to one entry.
 * `date` and `createdAt` are deliberately preserved: editing a portion size
 * must not silently move the entry to a different day.
 */
export function updateLog(entry: FoodEntry): FoodLogRecord | null {
  let updated: FoodLogRecord | null = null;
  updateDb((db) => ({
    ...db,
    logs: db.logs.map((log) => {
      if (log.id !== entry.id) return log;
      updated = {
        ...log,
        name: entry.name,
        quantity: entry.quantity,
        unit: entry.unit,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        sugar: entry.sugar || 0,
        fiber: entry.fiber || 0,
        updatedAt: getCurrentIsoString(),
      };
      return updated;
    }),
  }));
  return updated;
}

/** Removes one entry by id. */
export function deleteLog(id: string): void {
  updateDb((db) => ({ ...db, logs: db.logs.filter((log) => log.id !== id) }));
}

/** Removes every entry for one day. */
export function clearDate(date: string): void {
  updateDb((db) => ({ ...db, logs: db.logs.filter((log) => log.date !== date) }));
}

/**
 * Adds records that are not already stored, keyed by id.
 *
 * Existing records always win, which is what makes the legacy import safe to
 * re-run: it can only ever add rows the device does not already have.
 */
export function mergeLogs(records: FoodLogRecord[]): number {
  if (records.length === 0) return 0;
  let added = 0;
  updateDb((db) => {
    const known = new Set(db.logs.map((log) => log.id));
    const incoming = records.filter((record) => {
      if (!record.id || known.has(record.id)) return false;
      known.add(record.id);
      added++;
      return true;
    });
    return incoming.length ? { ...db, logs: [...db.logs, ...incoming] } : db;
  });
  return added;
}

/** True when every one of these ids is present in storage. */
export function hasAllIds(ids: string[]): boolean {
  const stored = new Set(readDb().logs.map((log) => log.id));
  return ids.every((id) => stored.has(id));
}
