/**
 * Derived history statistics: logging streak, weekly average, and the calorie
 * chart series.
 *
 * Previously this meant two Supabase round-trips per render — including one
 * that fetched *every row the user had ever logged* just to compute a streak.
 * Locally it is an in-memory scan, so the same numbers cost nothing.
 */

import { getCaloriesByDate, getLoggedDates } from './logService';
import { getSettings } from './settingsService';
import { addDays, getLocalIsoDate, recentDates } from '../../utils/date';

export interface DayMetric {
  date: string;
  calories: number;
}

export interface HistoryStats {
  streak: number;
  weeklyAverage: number;
  graphData: DayMetric[];
}

/**
 * Consecutive days logged, counting back from today.
 *
 * A gap for *today alone* does not break the streak — if yesterday was logged
 * the count starts there, so the streak only resets once a full day is missed.
 * This mirrors the previous behaviour exactly.
 */
export function getStreak(loggedDates: string[] = getLoggedDates()): number {
  if (loggedDates.length === 0) return 0;

  const known = new Set(loggedDates);
  const today = getLocalIsoDate();
  const yesterday = addDays(today, -1);

  let cursor: string | null = null;
  if (known.has(today)) cursor = today;
  else if (known.has(yesterday)) cursor = yesterday;

  let streak = 0;
  while (cursor && known.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Streak, average and chart series for the history tab. */
export function getHistoryStats(): HistoryStats {
  const days = getSettings().historyGraphDays;
  const dates = recentDates(days);
  const caloriesByDate = getCaloriesByDate(dates);

  let total = 0;
  const graphData: DayMetric[] = dates.map((date) => {
    const calories = Math.round(caloriesByDate[date] || 0);
    total += calories;
    return { date, calories };
  });

  return {
    streak: getStreak(),
    weeklyAverage: Math.round(total / days),
    graphData,
  };
}
