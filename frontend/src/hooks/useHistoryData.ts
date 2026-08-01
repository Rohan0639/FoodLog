import { useMemo } from 'react';
import type { FoodEntry } from '../types';
import { logService, statsService } from '../lib/services';
import type { HistoryStats } from '../lib/services/statsService';
import { useDbRevision } from './useDbRevision';

export interface DayLog {
  date: string;
  items: FoodEntry[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalSugar: number;
  totalFiber: number;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

function summarise(date: string, items: FoodEntry[]): DayLog {
  const sum = (pick: (item: FoodEntry) => number) =>
    items.reduce((acc, item) => acc + (pick(item) || 0), 0);

  return {
    date,
    items,
    totalCalories: sum((i) => i.calories),
    totalProtein: round1(sum((i) => i.protein)),
    totalCarbs: round1(sum((i) => i.carbs)),
    totalFats: round1(sum((i) => i.fats)),
    totalSugar: round1(sum((i) => i.sugar)),
    totalFiber: round1(sum((i) => i.fiber)),
  };
}

/**
 * Everything the history tab renders: which days have entries, the selected
 * day's log, and the streak/chart statistics.
 *
 * This replaces five Supabase queries that re-ran on every change to the
 * current day's logs. They are now memoised derivations of the local store,
 * recomputed only when the store actually changes.
 */
export function useHistoryData(selectedDate: string, currentMonth: string): {
  loggedDays: string[];
  selectedDateLog: DayLog;
  stats: HistoryStats;
} {
  const revision = useDbRevision();

  // In each case `revision` is a cache key rather than a value the callback
  // reads: it changes on every write to the store, which is exactly when these
  // derivations become stale.
  /* eslint-disable react-hooks/exhaustive-deps */
  const loggedDays = useMemo(
    () => logService.getLoggedDatesInMonth(currentMonth),
    [currentMonth, revision]
  );

  const selectedDateLog = useMemo(
    () => summarise(selectedDate, logService.getLogsByDate(selectedDate, 'asc')),
    [selectedDate, revision]
  );

  const stats = useMemo(() => statsService.getHistoryStats(), [revision]);
  /* eslint-enable react-hooks/exhaustive-deps */

  return { loggedDays, selectedDateLog, stats };
}
