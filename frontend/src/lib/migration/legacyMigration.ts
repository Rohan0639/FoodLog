/**
 * One-time import of pre-existing cloud data into local storage.
 *
 * THIS IS THE ONLY FILE IN THE PROJECT THAT KNOWS SUPABASE EVER EXISTED.
 * It is deliberately self-contained and self-disabling: once it reports
 * `completed`, nothing here runs again and the file can be deleted outright in
 * a later release.
 *
 * How it recovers data without asking anyone to sign in
 * ----------------------------------------------------
 * The previous build left a session in `localStorage` under `sb-<ref>-auth-token`.
 * This module reads that token and talks to the REST endpoint with plain
 * `fetch` — refreshing the token first if it has expired. That is why the
 * `@supabase/supabase-js` package could be removed entirely while existing
 * users still get their history back, with no login step.
 *
 * Safety properties
 * -----------------
 * - **Idempotent**: guarded by a persisted status and an in-flight promise, so
 *   React's double-invoked effects cannot run it twice.
 * - **Non-destructive**: records are merged by id and existing rows always win.
 *   It can only ever add data.
 * - **Verified**: the status flips to `completed` only after re-reading storage
 *   and confirming every imported id is present.
 * - **Legacy keys are never deleted.** They remain as an untouched backup.
 * - **Retried, not abandoned**: if the network fails, the status stays
 *   `failed` and the next launch tries again, up to `MAX_ATTEMPTS`.
 */

import { readDb, updateDb } from '../storage/localDb';
import type { FoodLogRecord, MigrationState, StoredMessage } from '../storage/schema';
import { hasAllIds, mergeLogs } from '../services/logService';
import { parseLocalDateString } from '../../utils/date';

/** Give up after this many failed launches so a dead endpoint cannot nag forever. */
const MAX_ATTEMPTS = 5;
const PAGE_SIZE = 1000;
const MAX_PAGES = 50;
const REQUEST_TIMEOUT_MS = 15000;

const LEGACY_SESSION_RE = /^sb-(.+)-auth-token$/;
const LEGACY_LOGS_RE = /^food_logs_local_/;
const LEGACY_CHAT_RE = /^chat_messages_(.+)_(\d{4}-\d{2}-\d{2})$/;

export interface MigrationResult {
  ran: boolean;
  status: MigrationState['status'];
  source: MigrationState['source'];
  importedLogs: number;
  importedChatDays: number;
  error?: string;
}

let inFlight: Promise<MigrationResult> | null = null;

// ---------------------------------------------------------------------------
// Legacy key discovery
// ---------------------------------------------------------------------------

function listKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) keys.push(key);
    }
  } catch {
    /* storage unavailable — treated as "nothing to migrate" */
  }
  return keys;
}

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

interface LegacySession {
  projectRef: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

/**
 * Extracts the stored session. Handles all three shapes supabase-js has used:
 * a bare session object, one nested under `currentSession`, and the newer
 * `base64-` prefixed payload.
 */
function readLegacySession(keys: string[]): LegacySession | null {
  for (const key of keys) {
    const match = key.match(LEGACY_SESSION_RE);
    if (!match) continue;

    const raw = readKey(key);
    if (!raw) continue;

    try {
      let payload = raw;
      if (payload.startsWith('base64-')) {
        payload = atob(payload.slice('base64-'.length));
      }
      const parsed = JSON.parse(payload);
      const session = parsed?.currentSession ?? parsed;
      if (typeof session?.access_token === 'string' && session.access_token) {
        return {
          projectRef: match[1],
          accessToken: session.access_token,
          refreshToken: typeof session.refresh_token === 'string' ? session.refresh_token : undefined,
          expiresAt: typeof session.expires_at === 'number' ? session.expires_at : undefined,
        };
      }
    } catch {
      /* unreadable session — fall through to the next candidate key */
    }
  }
  return null;
}

/** Project URL from the build's env, falling back to the ref in the key name. */
function resolveProjectUrl(projectRef: string): string {
  const fromEnv = import.meta.env.VITE_SUPABASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim().replace(/\/$/, '');
  return `https://${projectRef}.supabase.co`;
}

/** Anon key from env; the access token is a valid fallback for the apikey header. */
function resolveApiKey(accessToken: string): string {
  const fromEnv =
    import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  return accessToken;
}

// ---------------------------------------------------------------------------
// Remote fetch
// ---------------------------------------------------------------------------

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Exchanges a refresh token for a fresh access token.
 * Access tokens live about an hour, so almost every returning user arrives with
 * an expired one — without this step the import would fail for most of them.
 */
async function refreshAccessToken(
  baseUrl: string,
  apiKey: string,
  refreshToken: string
): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.access_token === 'string' ? data.access_token : null;
  } catch {
    return null;
  }
}

/**
 * Pulls every row the session is allowed to read.
 * Row Level Security scopes this to the signed-in user, exactly as the old app
 * relied on, so no user id filter is needed or possible here.
 */
async function fetchAllRows(
  baseUrl: string,
  apiKey: string,
  accessToken: string
): Promise<unknown[]> {
  const rows: unknown[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const url =
      `${baseUrl}/rest/v1/food_logs` +
      `?select=*&order=created_at.asc&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        apikey: apiKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase responded ${response.status} ${response.statusText}`);
    }

    const batch = await response.json();
    if (!Array.isArray(batch)) {
      throw new Error('Supabase returned an unexpected payload shape.');
    }

    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
};

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** Maps a remote row (snake_case) or a cached entry (camelCase) to a record. */
function toRecord(input: unknown): FoodLogRecord | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;

  const id = str(row.id);
  if (!id) return null;

  const createdAt = str(row.created_at) || str(row.createdAt) || new Date().toISOString();

  const rawDate = str(row.date);
  const date =
    rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : parseLocalDateString(createdAt);

  return {
    id,
    date,
    createdAt,
    name: str(row.name) ?? 'Unknown',
    quantity: num(row.quantity),
    unit: str(row.unit) ?? 'serving',
    calories: num(row.calories),
    protein: num(row.protein),
    carbs: num(row.carbs),
    fats: num(row.fats ?? row.fat),
    sugar: num(row.sugar),
    fiber: num(row.fiber),
  };
}

// ---------------------------------------------------------------------------
// Import steps
// ---------------------------------------------------------------------------

/** Imports the previous build's offline log cache. */
function importLocalCache(keys: string[]): FoodLogRecord[] {
  const records: FoodLogRecord[] = [];
  for (const key of keys.filter((k) => LEGACY_LOGS_RE.test(k))) {
    const raw = readKey(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      for (const row of parsed) {
        const record = toRecord(row);
        if (record) records.push(record);
      }
    } catch {
      /* skip an unreadable cache entry */
    }
  }
  return records;
}

/** Imports old per-day chat transcripts. Days already present are left alone. */
function importChatTranscripts(keys: string[]): number {
  const incoming: Record<string, StoredMessage[]> = {};

  for (const key of keys) {
    const match = key.match(LEGACY_CHAT_RE);
    if (!match) continue;

    const raw = readKey(key);
    if (!raw) continue;

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        incoming[match[2]] = parsed as StoredMessage[];
      }
    } catch {
      /* skip an unreadable transcript */
    }
  }

  const dates = Object.keys(incoming);
  if (dates.length === 0) return 0;

  let imported = 0;
  updateDb((db) => {
    const chat = { ...db.chat };
    for (const date of dates) {
      if (chat[date] && chat[date].length > 0) continue; // never overwrite
      chat[date] = incoming[date];
      imported++;
    }
    return { ...db, chat };
  });

  return imported;
}

function persistState(patch: Partial<MigrationState>): MigrationState {
  return updateDb((db) => ({
    ...db,
    meta: { ...db.meta, migration: { ...db.meta.migration, ...patch } },
  })).meta.migration;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Runs the import if it is still needed. Safe to call on every launch.
 * Never throws: a failure here must not stop the app from opening.
 */
export function runLegacyMigration(): Promise<MigrationResult> {
  if (!inFlight) {
    inFlight = execute().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function execute(): Promise<MigrationResult> {
  const state = readDb().meta.migration;

  if (state.status === 'completed') {
    return {
      ran: false,
      status: 'completed',
      source: state.source,
      importedLogs: state.importedLogs,
      importedChatDays: state.importedChatDays,
    };
  }

  if (state.attempts >= MAX_ATTEMPTS) {
    return {
      ran: false,
      status: 'failed',
      source: state.source,
      importedLogs: state.importedLogs,
      importedChatDays: state.importedChatDays,
      error: `Gave up after ${MAX_ATTEMPTS} attempts. Legacy data is still on this device.`,
    };
  }

  const keys = listKeys();
  const legacyKeys = keys.filter(
    (key) => LEGACY_SESSION_RE.test(key) || LEGACY_LOGS_RE.test(key) || LEGACY_CHAT_RE.test(key)
  );

  // Nothing from the old build on this device: a new user, or one who already
  // migrated on a different browser. Close the door and never look again.
  if (legacyKeys.length === 0) {
    persistState({ status: 'completed', source: 'none', completedAt: new Date().toISOString() });
    return { ran: false, status: 'completed', source: 'none', importedLogs: 0, importedChatDays: 0 };
  }

  persistState({ attempts: state.attempts + 1, legacyKeys });

  let importedLogs = 0;
  let usedLocalCache = false;
  let usedRemote = false;
  let error: string | undefined;

  // 1. Local cache first — no network, so whatever the device already holds is
  //    secured before anything that can fail is attempted.
  const cached = importLocalCache(keys);
  if (cached.length > 0) {
    const added = mergeLogs(cached);
    if (added > 0) usedLocalCache = true;
    importedLogs += added;
  }

  // 2. Chat transcripts — also local, also cannot fail.
  const importedChatDays = importChatTranscripts(keys);

  // 3. The full cloud history, if a session is still on the device.
  const session = readLegacySession(keys);
  if (session) {
    const baseUrl = resolveProjectUrl(session.projectRef);
    const apiKey = resolveApiKey(session.accessToken);

    try {
      let accessToken = session.accessToken;

      const expiresSoon =
        typeof session.expiresAt === 'number' && session.expiresAt * 1000 <= Date.now() + 60_000;
      if (expiresSoon && session.refreshToken) {
        accessToken = (await refreshAccessToken(baseUrl, apiKey, session.refreshToken)) ?? accessToken;
      }

      let rows: unknown[];
      try {
        rows = await fetchAllRows(baseUrl, apiKey, accessToken);
      } catch (err) {
        // A 401 on a token we did not refresh: refresh once, then retry.
        const unauthorized = err instanceof Error && err.message.includes('401');
        if (unauthorized && session.refreshToken && !expiresSoon) {
          const refreshed = await refreshAccessToken(baseUrl, apiKey, session.refreshToken);
          if (!refreshed) throw err;
          rows = await fetchAllRows(baseUrl, apiKey, refreshed);
        } else {
          throw err;
        }
      }

      const records = rows.map(toRecord).filter((r): r is FoodLogRecord => r !== null);
      const added = mergeLogs(records);
      importedLogs += added;
      usedRemote = true;

      // Verify against storage before declaring success.
      if (!hasAllIds(records.map((r) => r.id))) {
        throw new Error('Verification failed: some imported entries were not persisted.');
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.warn('[migration] Could not import cloud history; will retry next launch.', err);
    }
  }

  // Success means: there was no session to read, or the cloud pull completed and
  // verified. A session that failed to load stays `failed` so the next launch
  // tries again — the user's data is never written off after one bad request.
  const succeeded = !session || usedRemote;

  const source: MigrationState['source'] =
    usedRemote && usedLocalCache
      ? 'supabase+local-cache'
      : usedRemote
        ? 'supabase'
        : usedLocalCache
          ? 'local-cache'
          : 'none';

  const finalState = persistState({
    status: succeeded ? 'completed' : 'failed',
    source,
    importedLogs: readDb().meta.migration.importedLogs + importedLogs,
    importedChatDays: readDb().meta.migration.importedChatDays + importedChatDays,
    completedAt: succeeded ? new Date().toISOString() : undefined,
    lastError: error,
  });

  if (succeeded && (importedLogs > 0 || importedChatDays > 0)) {
    console.info(
      `[migration] Imported ${importedLogs} food log entr${importedLogs === 1 ? 'y' : 'ies'} ` +
        `and ${importedChatDays} chat day(s) into local storage. ` +
        'Original data was left untouched as a backup.'
    );
  }

  return {
    ran: true,
    status: finalState.status,
    source: finalState.source,
    importedLogs,
    importedChatDays,
    error,
  };
}

/** Current import state, for diagnostics. */
export function getMigrationState(): MigrationState {
  return readDb().meta.migration;
}
