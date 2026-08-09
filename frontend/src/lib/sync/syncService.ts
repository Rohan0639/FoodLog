/**
 * Keeping one diary consistent across a person's devices.
 *
 * The order of operations is the whole design: **pull, merge, then push**.
 * Uploading first would overwrite whatever another device had written since
 * this one last looked, which is exactly how a day of logging disappears.
 * Merging first means the file only ever grows more complete.
 *
 * Sync is always additive and never blocking. The app writes locally and
 * carries on; this runs afterwards, and a failure leaves the local diary
 * untouched.
 */

import { readDb, updateDb } from '../storage/localDb';
import type { SyncState } from '../storage/schema';
import { getCurrentIsoString } from '../../utils/date';
import { isValidPayload, mergeIntoDb, toPayload, type MergeStats } from './merge';
import * as auth from './googleAuth';
import * as drive from './driveClient';

export interface SyncResult {
  ok: boolean;
  /** Null when there was nothing to do, e.g. not signed in. */
  stats: MergeStats | null;
  error?: string;
}

/** Prevents overlapping runs from writing over each other. */
let inFlight: Promise<SyncResult> | null = null;

export function isConfigured(): boolean {
  return auth.isConfigured();
}

export function getState(): SyncState {
  return readDb().meta.sync;
}

export function isSignedIn(): boolean {
  return Boolean(readDb().meta.sync.account) && auth.hasToken();
}

function setState(patch: Partial<SyncState>): void {
  updateDb((db) => ({
    ...db,
    meta: { ...db.meta, sync: { ...db.meta.sync, ...patch } },
  }));
}

/**
 * Connects an account and performs the first sync.
 *
 * The first sync is the dangerous one: this device may hold weeks of history
 * while the account's file holds a different weeks. Because it merges rather
 * than choosing a winner, both survive.
 */
export async function signIn(): Promise<SyncResult> {
  if (!auth.isConfigured()) {
    return { ok: false, stats: null, error: 'Drive sync is not configured for this build.' };
  }

  try {
    const token = await auth.getAccessToken(true);
    if (!token) return { ok: false, stats: null, error: 'Sign-in was cancelled.' };

    const email = await drive.accountEmail(token);
    setState({ account: email ?? 'Google account', lastError: null });

    return await sync();
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Could not sign in.';
    setState({ lastError: error });
    return { ok: false, stats: null, error };
  }
}

/**
 * Disconnects the account.
 *
 * Local data is deliberately left completely alone. Signing out is not a
 * request to delete a diary, and the copy in Drive stays too — signing back in
 * restores the link.
 */
export async function signOut(): Promise<void> {
  await auth.signOut();
  setState({ account: null, fileId: null, lastSyncedAt: null, lastError: null });
}

/**
 * Pulls, merges and pushes. Safe to call often; overlapping calls share a run.
 */
export function sync(): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function run(): Promise<SyncResult> {
  const state = readDb().meta.sync;

  // Not connected: nothing to do, and not an error.
  if (!auth.isConfigured() || !state.account) {
    return { ok: true, stats: null };
  }

  try {
    // Silent — a background sync must never make a popup appear.
    const token = await auth.getAccessToken(false);
    if (!token) {
      const error = 'Google sign-in expired. Sign in again to keep syncing.';
      setState({ lastError: error });
      return { ok: false, stats: null, error };
    }

    // 1. Find (or claim) the file.
    let file = state.fileId
      ? { id: state.fileId }
      : await drive.findFile(token);

    // 2. PULL first — never push over work this device has not seen.
    let stats: MergeStats | null = null;

    if (file) {
      const remote = await drive.download(token, file.id);

      if (remote !== null && isValidPayload(remote)) {
        const merged = mergeIntoDb(readDb(), remote);
        stats = merged.stats;
        updateDb(() => merged.db);
      } else if (remote !== null) {
        // Readable, but not ours. Refuse rather than merge nonsense in.
        const error = 'The file in Drive is not a FoodLog backup.';
        setState({ lastError: error });
        return { ok: false, stats: null, error };
      }
    }

    // 3. PUSH the merged result, which is a superset of both sides.
    const payload = toPayload(readDb());

    file = file
      ? await drive.update(token, file.id, payload)
      : await drive.create(token, payload);

    setState({
      fileId: file.id,
      lastSyncedAt: getCurrentIsoString(),
      lastError: null,
    });

    return { ok: true, stats };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Sync failed.';
    console.warn('[sync] failed:', error);
    setState({ lastError: error });
    return { ok: false, stats: null, error };
  }
}

/**
 * Restores the session on startup without troubling the user.
 *
 * If they previously connected an account, Google will hand back a token with
 * no prompt at all. If it will not, the app simply stays local until they sign
 * in again.
 */
export async function resume(): Promise<void> {
  const state = readDb().meta.sync;
  if (!auth.isConfigured() || !state.account) return;

  const token = await auth.getAccessToken(false).catch(() => null);
  if (token) await sync();
}
