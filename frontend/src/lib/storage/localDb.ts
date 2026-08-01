/**
 * The only module in the project permitted to touch `localStorage`.
 *
 * Everything above this file (services, hooks, components) works with plain
 * objects and never sees a storage key, a JSON string, or a quota error. That
 * boundary is what makes the storage engine swappable later — moving to
 * IndexedDB would mean rewriting this file and nothing else.
 *
 * Reads are served from an in-memory snapshot, so the hot paths (history,
 * calendar, stats) never re-parse JSON. The snapshot is invalidated on write
 * and by `storage` events from other tabs.
 */

import {
  CORRUPT_BACKUP_PREFIX,
  DB_KEY,
  createEmptyDb,
  normalizeDb,
  type FoodLogDb,
} from './schema';

export class StorageUnavailableError extends Error {
  readonly reason?: unknown;

  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'StorageUnavailableError';
    this.reason = reason;
  }
}

export class StorageQuotaError extends Error {
  readonly reason?: unknown;

  constructor(message: string, reason?: unknown) {
    super(message);
    this.name = 'StorageQuotaError';
    this.reason = reason;
  }
}

type Listener = () => void;

let snapshot: FoodLogDb | null = null;
let revision = 0;
const listeners = new Set<Listener>();

/** True when localStorage can actually be read AND written (Safari private mode). */
export function isStorageAvailable(): boolean {
  try {
    const probe = '__foodlog_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function notify(): void {
  revision++;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('[localDb] listener failed', err);
    }
  });
}

/**
 * Parks an unparseable payload under a timestamped key rather than discarding
 * it, then starts fresh. A corrupt store must never be silently deleted — the
 * bytes may still be recoverable by hand.
 */
function quarantineCorruptPayload(raw: string): void {
  try {
    window.localStorage.setItem(`${CORRUPT_BACKUP_PREFIX}${Date.now()}`, raw);
    console.error(
      '[localDb] Stored data was unreadable. A copy was preserved under a ' +
        `"${CORRUPT_BACKUP_PREFIX}*" key and a fresh database was created.`
    );
  } catch (err) {
    console.error('[localDb] Could not preserve the corrupt payload', err);
  }
}

/** Reads the whole database. Cheap after the first call. */
export function readDb(): FoodLogDb {
  if (snapshot) return snapshot;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(DB_KEY);
  } catch (err) {
    console.error('[localDb] localStorage is not readable', err);
    snapshot = createEmptyDb();
    return snapshot;
  }

  if (!raw) {
    snapshot = createEmptyDb();
    return snapshot;
  }

  try {
    snapshot = normalizeDb(JSON.parse(raw));
  } catch (err) {
    quarantineCorruptPayload(raw);
    console.error('[localDb] JSON parse failed', err);
    snapshot = createEmptyDb();
  }
  return snapshot;
}

/** Persists a complete database object and notifies subscribers. */
export function writeDb(next: FoodLogDb): FoodLogDb {
  const stamped: FoodLogDb = {
    ...next,
    meta: { ...next.meta, updatedAt: new Date().toISOString() },
  };

  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(stamped));
  } catch (err) {
    const isQuota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    if (isQuota) {
      throw new StorageQuotaError(
        'This browser is out of local storage space. Delete some old logs or export your data.',
        err
      );
    }
    throw new StorageUnavailableError(
      'This browser is blocking local storage, so your changes could not be saved.',
      err
    );
  }

  snapshot = stamped;
  notify();
  return stamped;
}

/**
 * Read-modify-write in one step. The single mutation primitive: every service
 * writes through this, so there is exactly one place where persistence,
 * snapshot invalidation and change notification happen.
 */
export function updateDb(mutate: (db: FoodLogDb) => FoodLogDb): FoodLogDb {
  return writeDb(mutate(readDb()));
}

/** Subscribe to any change. Returns an unsubscribe function. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Monotonic counter, bumped on every write. Drives `useDbRevision`. */
export function getRevision(): number {
  return revision;
}

/** Drops the cached snapshot so the next read hits localStorage again. */
export function invalidate(): void {
  snapshot = null;
  notify();
}

/** Serialised copy of the database, for a future export/backup feature. */
export function exportDb(): string {
  return JSON.stringify(readDb(), null, 2);
}

/** Replaces the database from a previously exported payload. */
export function importDb(serialized: string): FoodLogDb {
  return writeDb(normalizeDb(JSON.parse(serialized)));
}

// Keep every open tab consistent: another tab writing the store invalidates
// this one's snapshot so the next read picks up their changes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY || event.key === null) {
      snapshot = null;
      notify();
    }
  });
}
