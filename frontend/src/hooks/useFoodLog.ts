import { useCallback, useMemo } from 'react';
import type { FoodEntry } from '../types';
import { logService } from '../lib/services';
import { useDbRevision } from './useDbRevision';

/**
 * The entries logged on a given day, plus the writes that change them.
 *
 * The list is *derived* from the store rather than mirrored into component
 * state: a write bumps the store revision, which recomputes this. The screen
 * therefore always shows exactly what is persisted, and there is no optimistic
 * copy that can drift out of sync.
 *
 * That is what made the old offline queue necessary — a network write could
 * fail after the UI had already moved on, so the two had to be reconciled
 * later. A local write cannot half-succeed, so the reconciliation machinery is
 * simply gone.
 */
export function useFoodLog(date: string) {
  const revision = useDbRevision();

  // `revision` is a cache key, not a value the callback reads: it changes on
  // every write to the store, which is precisely when this must be recomputed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logs = useMemo<FoodEntry[]>(() => logService.getLogsByDate(date), [date, revision]);

  const addEntries = useCallback((entries: FoodEntry[]) => logService.addLogs(entries), []);
  const updateEntry = useCallback((entry: FoodEntry) => { logService.updateLog(entry); }, []);
  const deleteEntry = useCallback((id: string) => { logService.deleteLog(id); }, []);
  const clearDay = useCallback(() => { logService.clearDate(date); }, [date]);

  return { logs, addEntries, updateEntry, deleteEntry, clearDay };
}
