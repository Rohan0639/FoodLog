import { useEffect, useRef } from 'react';
import * as syncService from '../lib/sync/syncService';
import { subscribe } from '../lib/storage/localDb';

/** Quiet period after the last change before pushing. */
const SETTLE_MS = 8000;

/**
 * Keeps the diary in step with the user's other devices, without ever getting
 * in their way.
 *
 * Syncs on three triggers: once at startup, a few seconds after changes stop,
 * and when the network comes back. The delay matters — logging a meal writes
 * to storage several times in a row (entry, dictionary, chat), and syncing on
 * each would mean four uploads for one action.
 *
 * Every failure here is silent by design. Sync is a convenience running behind
 * a diary that already works; an error banner for something the user did not
 * ask for and cannot fix would only be noise. Failures surface in Settings,
 * where they are actionable.
 */
export function useAutoSync(): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set while sync itself is writing, so its own writes do not re-trigger it. */
  const syncing = useRef(false);

  useEffect(() => {
    if (!syncService.isConfigured()) return;

    let cancelled = false;

    const runSync = async () => {
      if (cancelled || syncing.current) return;
      syncing.current = true;
      try {
        await syncService.sync();
      } finally {
        syncing.current = false;
      }
    };

    // 1. Startup — silently restores an existing connection.
    syncService.resume().catch(() => {});

    // 2. After local changes settle.
    const unsubscribe = subscribe(() => {
      if (syncing.current) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(runSync, SETTLE_MS);
    });

    // 3. When the network returns, since anything queued is now sendable.
    const onOnline = () => { runSync(); };
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener('online', onOnline);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
}
