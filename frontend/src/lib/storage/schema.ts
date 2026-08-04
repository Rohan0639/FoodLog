/**
 * The shape of the local-first database.
 *
 * EVERYTHING the app persists lives under a single localStorage key so that the
 * whole store can be read, written, exported or backed up atomically. Nothing in
 * this project may write to localStorage outside of `localDb.ts`.
 *
 * Adding a field later:
 *   1. add it to the interface below,
 *   2. give it a default in `createEmptyDb()`,
 *   3. bump `SCHEMA_VERSION` and add an entry to `SCHEMA_MIGRATIONS`.
 * `normalizeDb()` back-fills missing keys on every read, so purely additive
 * changes are safe even without a migration step.
 */

import type { DailyGoal, GeminiResponse, Message } from '../../types';

/** The one and only localStorage key used by the application. */
export const DB_KEY = 'foodlog_db_v1';

/** Bumped whenever the persisted shape changes in a non-additive way. */
export const SCHEMA_VERSION = 1;

/** Product version, persisted so a future release can reason about upgrades. */
export const APP_VERSION = '2.0.0-local';

/** Where a corrupt payload is parked instead of being thrown away. */
export const CORRUPT_BACKUP_PREFIX = 'foodlog_db_v1__corrupt__';

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/**
 * A single logged food item.
 *
 * Superset of the UI's `FoodEntry`: adds `date` (the local YYYY-MM-DD bucket
 * every history query works from) so day/month lookups never have to parse
 * timestamps, matching the old `food_logs.date` column exactly.
 */
export interface FoodLogRecord {
  id: string;
  date: string;
  createdAt: string;
  updatedAt?: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  fiber: number;
}

/** The single local user. No credentials — identity never leaves the device. */
export interface Profile {
  id: string;
  name: string;
  createdAt: string;
}

/** Persisted preferences. */
export interface Settings {
  /** Days of chat transcript to keep before pruning. */
  chatRetentionDays: number;
  /** Whether confirming a log fires the confetti burst. */
  confettiEnabled: boolean;
  /** Number of days plotted on the history calorie chart. */
  historyGraphDays: number;
  /** When the user last exported. Null means they never have. */
  lastBackupAt: string | null;
  /** Suppresses the backup reminder until this date. */
  backupSnoozedUntil: string | null;
}

/** A saved food the user can re-log without re-parsing. Store + service only. */
export interface Favorite {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  fiber: number;
  createdAt: string;
}

/** A previously parsed phrase, so repeat entries resolve instantly & offline. */
export interface ParseCacheEntry {
  response: GeminiResponse;
  cachedAt: string;
}

/** Macros for exactly one `baseUnit` of a food. */
export interface PerUnitMacros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  fiber: number;
}

/**
 * A food this device has learned.
 *
 * Built from what the user actually logs, so it is personal by construction —
 * it never leaves the device and never mixes with anyone else's eating habits.
 * Storing macros *per unit* is what lets a match be rescaled to any quantity
 * later via `scaleMacrosByQuantity`.
 */
export interface DictionaryEntry {
  id: string;
  /** Canonical display name, e.g. "egg". */
  name: string;
  /**
   * Every normalised string that should resolve here. Grows over time: a
   * mistyped entry the user corrects is added, so the same typo hits exactly
   * from then on.
   */
  aliases: string[];
  baseUnit: string;
  perUnit: PerUnitMacros;
  /** Frequency prior — makes fuzzy matching safe for foods you eat often. */
  timesLogged: number;
  lastLoggedAt: string;
  createdAt: string;
  /**
   * 'user' outranks 'gemini': once someone has corrected the macros by hand,
   * a later parse must not silently overwrite them.
   */
  source: 'gemini' | 'user';
}

/** Chat messages as persisted (Date is serialised to an ISO string). */
export type StoredMessage = Omit<Message, 'timestamp'> & { timestamp: string };

// ---------------------------------------------------------------------------
// One-time legacy import bookkeeping
// ---------------------------------------------------------------------------

export type MigrationStatus = 'pending' | 'completed' | 'failed';

export interface MigrationState {
  status: MigrationStatus;
  /** Where the imported records came from. */
  source: 'none' | 'supabase' | 'local-cache' | 'supabase+local-cache';
  attempts: number;
  completedAt?: string;
  importedLogs: number;
  importedChatDays: number;
  lastError?: string;
  /** Legacy keys detected at import time. Never deleted — they are the backup. */
  legacyKeys: string[];
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

export interface FoodLogDb {
  schemaVersion: number;
  appVersion: string;
  profile: Profile;
  logs: FoodLogRecord[];
  goals: DailyGoal;
  settings: Settings;
  favorites: Favorite[];
  /** Chat transcripts keyed by local YYYY-MM-DD. */
  chat: Record<string, StoredMessage[]>;
  /** Parser results keyed by normalised input text. */
  parseCache: Record<string, ParseCacheEntry>;
  /** Foods this device has learned from what the user logs. */
  foodDictionary: DictionaryEntry[];
  meta: {
    createdAt: string;
    updatedAt: string;
    migration: MigrationState;
  };
}

export const DEFAULT_DAILY_GOAL: DailyGoal = {
  calories: 2000,
  protein: 135,
  carbs: 230,
  fat: 70,
  sugar: 50,
  fiber: 30,
};

export const DEFAULT_SETTINGS: Settings = {
  chatRetentionDays: 1,
  confettiEnabled: true,
  historyGraphDays: 7,
  lastBackupAt: null,
  backupSnoozedUntil: null,
};

/** UUID with a fallback for non-secure contexts, where randomUUID is absent. */
export function newId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  if (cryptoRef?.getRandomValues) {
    const bytes = cryptoRef.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createEmptyDb(): FoodLogDb {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    profile: { id: newId(), name: 'You', createdAt: now },
    logs: [],
    goals: { ...DEFAULT_DAILY_GOAL },
    settings: { ...DEFAULT_SETTINGS },
    favorites: [],
    chat: {},
    parseCache: {},
    foodDictionary: [],
    meta: {
      createdAt: now,
      updatedAt: now,
      migration: {
        status: 'pending',
        source: 'none',
        attempts: 0,
        importedLogs: 0,
        importedChatDays: 0,
        legacyKeys: [],
      },
    },
  };
}

/**
 * Upgrades an older persisted payload to the current `SCHEMA_VERSION`.
 *
 * Each entry migrates from the version in its key to that version + 1, and they
 * are applied in order. Purely additive changes need no entry here —
 * `normalizeDb()` back-fills them.
 */
const SCHEMA_MIGRATIONS: Record<number, (db: FoodLogDb) => FoodLogDb> = {
  // 1: (db) => ({ ...db, schemaVersion: 2 }),
};

export function upgradeDb(input: FoodLogDb): FoodLogDb {
  let db = input;
  let guard = 0;
  while (db.schemaVersion < SCHEMA_VERSION && guard++ < 50) {
    const step = SCHEMA_MIGRATIONS[db.schemaVersion];
    if (!step) {
      db = { ...db, schemaVersion: SCHEMA_VERSION };
      break;
    }
    db = step(db);
  }
  return db;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Coerces an arbitrary parsed payload into a complete, valid `FoodLogDb`.
 *
 * Runs on every read so a store written by an older build — or one hand-edited
 * in devtools — can never crash the app with a missing key. Unknown values are
 * replaced by defaults; recognisable user data is always kept.
 */
export function normalizeDb(raw: unknown): FoodLogDb {
  const base = createEmptyDb();
  if (!isObject(raw)) return base;

  const profile: Record<string, unknown> = isObject(raw.profile) ? raw.profile : {};
  const meta: Record<string, unknown> = isObject(raw.meta) ? raw.meta : {};
  const migration: Record<string, unknown> = isObject(meta.migration) ? meta.migration : {};

  return upgradeDb({
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : SCHEMA_VERSION,
    appVersion: typeof raw.appVersion === 'string' ? raw.appVersion : base.appVersion,
    profile: {
      id: typeof profile.id === 'string' ? profile.id : base.profile.id,
      name: typeof profile.name === 'string' ? profile.name : base.profile.name,
      createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : base.profile.createdAt,
    },
    logs: Array.isArray(raw.logs) ? (raw.logs.filter(isValidLog) as FoodLogRecord[]) : [],
    goals: { ...base.goals, ...(isObject(raw.goals) ? raw.goals : {}) },
    settings: { ...base.settings, ...(isObject(raw.settings) ? raw.settings : {}) },
    favorites: Array.isArray(raw.favorites) ? (raw.favorites as Favorite[]) : [],
    chat: isObject(raw.chat) ? (raw.chat as Record<string, StoredMessage[]>) : {},
    parseCache: isObject(raw.parseCache) ? (raw.parseCache as Record<string, ParseCacheEntry>) : {},
    // Additive: a store written before the dictionary existed simply gets an
    // empty list here, which is why this needed no schema migration.
    foodDictionary: Array.isArray(raw.foodDictionary)
      ? (raw.foodDictionary.filter(isValidDictionaryEntry) as DictionaryEntry[])
      : [],
    meta: {
      createdAt: typeof meta.createdAt === 'string' ? meta.createdAt : base.meta.createdAt,
      updatedAt: typeof meta.updatedAt === 'string' ? meta.updatedAt : base.meta.updatedAt,
      migration: {
        ...base.meta.migration,
        ...(migration as Partial<MigrationState>),
        legacyKeys: Array.isArray(migration.legacyKeys) ? (migration.legacyKeys as string[]) : [],
      },
    },
  });
}

/** A record is kept only if the fields every query and render path depends on exist. */
function isValidLog(v: unknown): boolean {
  return (
    isObject(v) &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.date === 'string'
  );
}

/**
 * A dictionary entry is only usable if it can be matched (aliases) and rescaled
 * (perUnit + baseUnit). Anything missing those would silently produce wrong
 * macros, so it is dropped rather than repaired.
 */
function isValidDictionaryEntry(v: unknown): boolean {
  if (!isObject(v)) return false;
  const perUnit = v.perUnit;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    Array.isArray(v.aliases) &&
    typeof v.baseUnit === 'string' &&
    isObject(perUnit) &&
    typeof perUnit.calories === 'number'
  );
}
