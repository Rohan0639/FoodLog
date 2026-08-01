import { useSyncExternalStore } from 'react';
import { getRevision, subscribe } from '../lib/storage/localDb';

/**
 * A counter that changes whenever anything is written to the local database.
 *
 * Views that derive their own data (history, calendar, statistics) depend on
 * this instead of on a prop, so they refresh after any write — including one
 * made in another browser tab — without the Dashboard having to tell them.
 */
export function useDbRevision(): number {
  return useSyncExternalStore(subscribe, getRevision, getRevision);
}
