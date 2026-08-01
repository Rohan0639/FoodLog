/**
 * Local-date helpers.
 *
 * Every date bucket in this app is a LOCAL calendar day (`YYYY-MM-DD`), never a
 * UTC one — a meal logged at 11pm belongs to that evening, not to tomorrow.
 * These functions were previously duplicated in Dashboard and NutritionDashboard;
 * they now live here so both agree by construction.
 */

/** Local calendar day as `YYYY-MM-DD`. */
export function getLocalIsoDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Today as `YYYY-MM-DD`. */
export function getTodayDate(): string {
  return getLocalIsoDate();
}

/** Current wall-clock time as an ISO string. */
export function getCurrentIsoString(): string {
  return new Date().toISOString();
}

/**
 * Coerces a timestamp of unknown shape into a local `YYYY-MM-DD` bucket.
 * Accepts an ISO timestamp, an already-bucketed date, or junk (falls back to today).
 */
export function parseLocalDateString(timestamp: string): string {
  if (!timestamp || typeof timestamp !== 'string') {
    return getLocalIsoDate();
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(timestamp)) {
    return timestamp;
  }
  try {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return getLocalIsoDate(d);
    }
  } catch {
    /* fall through */
  }
  return timestamp.split('T')[0] || getLocalIsoDate();
}

/** Parses a `YYYY-MM-DD` bucket into a Date at local midnight. */
export function fromIsoDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/** Shifts a `YYYY-MM-DD` bucket by whole days. */
export function addDays(dateStr: string, days: number): string {
  const d = fromIsoDate(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalIsoDate(d);
}

/** The last `count` days ending today, oldest first. */
export function recentDates(count: number): string[] {
  const dates: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(getLocalIsoDate(d));
  }
  return dates;
}

/** Half-open `[start, end)` bounds covering a `YYYY-MM` month. */
export function monthBounds(month: string): { start: string; end: string } {
  const year = parseInt(month.split('-')[0], 10);
  const monthNum = parseInt(month.split('-')[1], 10);
  const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
  const nextYear = monthNum === 12 ? year + 1 : year;
  return {
    start: `${month}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  };
}

/** Milliseconds from now until the next local midnight. */
export function msUntilMidnight(from: Date = new Date()): number {
  const midnight = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
    0, 0, 0, 0
  );
  return midnight.getTime() - from.getTime();
}
