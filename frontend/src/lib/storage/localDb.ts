/**
 * The only module in the project permitted to touch `localStorage` for the diary.
 *
 * Everything above this file (services, hooks, components) works with plain
 * objects and never sees a storage key, a JSON string, or ciphertext.
 *
 * Once a vault exists, the diary is written to storage encrypted with the vault
 * key, and writes are refused while the vault is locked. The in-memory copy is
 * the authoritative view, so reads stay synchronous. Persistence to storage is
 * queued, and its failures are reported through `getPersistError()`.
 */

import {
  CORRUPT_BACKUP_PREFIX,
  DB_KEY,
  createEmptyDb,
  normalizeDb,
  type FoodLogDb,
} from './schema';
import { hasVault, isEnvelope, isUnlocked, openJson, sealJson } from '../security/vault';

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

/** The authoritative in-memory copy. `null` means it must be reloaded. */
let current: FoodLogDb | null = null;
let revision = 0;
const listeners = new Set<Listener>();
/** Writes are persisted one at a time, in order, because sealing is asynchronous. */
let persistChain: Promise<void> = Promise.resolve();
let persistError: string | null = null;

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

/**
 * True when the stored diary is encrypted and this session does not hold its key.
 * Checks the stored data as well as the vault header, so an encrypted diary is
 * never overwritten with an empty one.
 */
export function isLocked(): boolean {
  if (isUnlocked()) return false;
  if (hasVault()) return true;
  const raw = readRaw();
  if (!raw) return false;
  try {
    return isEnvelope(JSON.parse(raw));
  } catch {
    return false;
  }
}

/** Resolves once every queued save has reached storage. */
export function flushPersist(): Promise<void> {
  return persistChain;
}

/** The most recent persistence failure, or null once a later save succeeds. */
export function getPersistError(): string | null {
  return persistError;
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

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(DB_KEY);
  } catch (err) {
    console.error('[localDb] localStorage is not readable', err);
    return null;
  }
}

/**
 * Parks an unparseable payload under a timestamped key rather than discarding
 * it, then starts fresh. A corrupt store must never be silently deleted.
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

/**
 * Loads the diary from storage into memory. Call once after the vault is unlocked.
 *
 * A plaintext store from before encryption existed is adopted and re-saved
 * encrypted, so the upgrade happens on the user's first unlock.
 */
export async function loadStoredDb(): Promise<FoodLogDb> {
  const raw = readRaw();

  if (!raw) {
    current = createEmptyDb();
    notify();
    return current;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    quarantineCorruptPayload(raw);
    console.error('[localDb] JSON parse failed', err);
    current = createEmptyDb();
    notify();
    return current;
  }

  if (isEnvelope(parsed)) {
    current = normalizeDb(await openJson(parsed));
    notify();
    return current;
  }

  current = normalizeDb(parsed);
  persist(current);
  notify();
  return current;
}

/** Re-reads an encrypted store in the background, after a change from another tab. */
function refreshInBackground(): void {
  void loadStoredDb().catch((err) => {
    console.error('[localDb] could not refresh from storage', err);
  });
}

/** Reads the whole database. Cheap after the first call. */
export function readDb(): FoodLogDb {
  if (current) return current;

  // Locked: show nothing, and do not cache, so a later unlock is picked up.
  if (isLocked()) return createEmptyDb();

  const raw = readRaw();
  if (!raw) {
    current = createEmptyDb();
    return current;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    quarantineCorruptPayload(raw);
    console.error('[localDb] JSON parse failed', err);
    current = createEmptyDb();
    return current;
  }

  // Encrypted, and the key is held: decrypt asynchronously and return empty for now.
  if (isEnvelope(parsed)) {
    refreshInBackground();
    return createEmptyDb();
  }

  current = normalizeDb(parsed);
  return current;
}

/** Queues a save. Sealed with the vault key whenever one exists. */
function persist(db: FoodLogDb): void {
  persistChain = persistChain.then(async () => {
    const before = persistError;
    try {
      const payload = isUnlocked() ? await sealJson(db) : db;
      window.localStorage.setItem(DB_KEY, JSON.stringify(payload));
      persistError = null;
    } catch (err) {
      const isQuota =
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED');
      persistError = isQuota
        ? 'This browser is out of local storage space. Export your data, then delete some old logs.'
        : 'Your latest changes could not be saved on this device.';
      console.error('[localDb] persist failed', err);
    }
    // Only announce a change of state, so healthy saves do not re-render the app.
    if (before !== persistError) notify();
  });
}

/**
 * Replaces the in-memory database and queues it for saving.
 *
 * Refuses to run while the vault is locked, so a locked store can never be
 * overwritten with an empty one.
 */
export function writeDb(next: FoodLogDb): FoodLogDb {
  if (isLocked()) {
    throw new StorageUnavailableError('Unlock your diary before changing it.');
  }

  const stamped: FoodLogDb = {
    ...next,
    meta: { ...next.meta, updatedAt: new Date().toISOString() },
  };

  current = stamped;
  persist(stamped);
  notify();
  return stamped;
}

/**
 * Read-modify-write in one step. The single mutation primitive: every service
 * writes through this, so there is exactly one place where persistence,
 * cache invalidation and change notification happen.
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

/** Drops the in-memory copy so the next read reloads it. */
export function invalidate(): void {
  current = null;
  notify();
}

/**
 * Serialised copy of the database, for export.
 *
 * Note: exports are plain JSON, so an exported file is not encrypted.
 */
export function exportDb(): string {
  return JSON.stringify(readDb(), null, 2);
}

/** Replaces the database from a previously exported payload. */
export function importDb(serialized: string): FoodLogDb {
  return writeDb(normalizeDb(JSON.parse(serialized)));
}

// Keep every open tab consistent: another tab writing the store invalidates
// this one's copy so the next read picks up their changes.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === DB_KEY || event.key === null) {
      current = null;
      notify();
    }
  });
}
