/**
 * Reconciling two copies of the same diary.
 *
 * Called when a device pulls the shared file and has to combine it with what it
 * already holds. The rules are deliberately conservative, because the failure
 * mode here is not a crash — it is a meal quietly vanishing from someone's
 * history, which they may not notice for weeks.
 *
 *   1. A record on only one side is KEPT. Never treat absence as deletion.
 *   2. A record on both sides: the one with the later `updatedAt` wins.
 *   3. A record is removed only when a tombstone says so, and only if that
 *      deletion is newer than the record itself. Editing a meal after deleting
 *      it elsewhere brings it back — the edit is the later intent.
 *
 * Everything here is pure: same inputs, same output, no storage access. That is
 * what makes "nothing was lost" a property that can actually be tested.
 */

import type {
  DictionaryEntry, Favorite, FoodLogDb, FoodLogRecord, SyncedCollection, Tombstone,
} from '../storage/schema';
import * as tombstones from './tombstones';

/** The parts of the diary that travel between devices. */
export interface SyncPayload {
  logs: FoodLogRecord[];
  foodDictionary: DictionaryEntry[];
  favorites: Favorite[];
  tombstones: Tombstone[];
  goals: FoodLogDb['goals'];
  settings: Partial<FoodLogDb['settings']>;
  /** When the sending device last changed its goals/settings. */
  preferencesUpdatedAt: string;
}

export interface MergeStats {
  logsAdded: number;
  logsUpdated: number;
  logsDeleted: number;
  dictionaryAdded: number;
  dictionaryUpdated: number;
}

const timeOf = (value: string | undefined): number => {
  const ms = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(ms) ? ms : 0;
};

interface Syncable {
  id: string;
  updatedAt?: string;
  createdAt?: string;
}

/**
 * Combines two lists of the same kind of record.
 *
 * Union by id, later `updatedAt` wins, tombstones applied last. A record whose
 * tombstone predates its own last edit survives — the edit happened after the
 * delete, so the delete is stale.
 */
function mergeCollection<T extends Syncable>(
  collection: SyncedCollection,
  mine: T[],
  theirs: T[],
  deletions: Map<string, string>
): { merged: T[]; added: number; updated: number; deleted: number } {
  const byId = new Map<string, T>();
  let added = 0;
  let updated = 0;

  for (const record of mine) byId.set(record.id, record);

  for (const incoming of theirs) {
    const existing = byId.get(incoming.id);

    if (!existing) {
      byId.set(incoming.id, incoming);
      added++;
      continue;
    }

    if (timeOf(incoming.updatedAt) > timeOf(existing.updatedAt)) {
      byId.set(incoming.id, incoming);
      updated++;
    }
  }

  let deleted = 0;
  for (const [id, record] of byId) {
    const deletedAt = deletions.get(`${collection}:${id}`);
    if (!deletedAt) continue;

    // A later edit outranks an earlier deletion.
    if (timeOf(deletedAt) >= timeOf(record.updatedAt)) {
      byId.delete(id);
      deleted++;
    }
  }

  return { merged: Array.from(byId.values()), added, updated, deleted };
}

/**
 * Produces the database this device should hold after seeing the remote copy.
 *
 * Chat transcripts and the parse cache are deliberately excluded from syncing:
 * they are per-device scrollback and a per-device speed-up, they can be large
 * (attachments are inlined), and losing them costs nothing.
 */
export function mergeIntoDb(
  db: FoodLogDb,
  remote: SyncPayload
): { db: FoodLogDb; stats: MergeStats } {
  const allTombstones = tombstones.merge(db, remote.tombstones ?? []);
  const deletions = tombstones.index(allTombstones);

  const logs = mergeCollection('log', db.logs, remote.logs ?? [], deletions);
  const dictionary = mergeCollection(
    'dictionary',
    db.foodDictionary,
    remote.foodDictionary ?? [],
    deletions
  );
  const favorites = mergeCollection('favorite', db.favorites, remote.favorites ?? [], deletions);

  /*
   * Goals and settings are single objects rather than collections, so there is
   * nothing to merge field by field — the device that changed them most
   * recently wins outright.
   */
  const remoteIsNewer = timeOf(remote.preferencesUpdatedAt) > timeOf(db.meta.updatedAt);

  return {
    db: {
      ...db,
      logs: logs.merged,
      foodDictionary: dictionary.merged,
      favorites: favorites.merged,
      tombstones: allTombstones,
      goals: remoteIsNewer && remote.goals ? { ...db.goals, ...remote.goals } : db.goals,
      settings: remoteIsNewer && remote.settings
        ? { ...db.settings, ...remote.settings }
        : db.settings,
    },
    stats: {
      logsAdded: logs.added,
      logsUpdated: logs.updated,
      logsDeleted: logs.deleted,
      dictionaryAdded: dictionary.added,
      dictionaryUpdated: dictionary.updated,
    },
  };
}

/** What this device sends up. */
export function toPayload(db: FoodLogDb): SyncPayload {
  return {
    logs: db.logs,
    foodDictionary: db.foodDictionary,
    favorites: db.favorites,
    tombstones: db.tombstones,
    goals: db.goals,
    settings: {
      chatRetentionDays: db.settings.chatRetentionDays,
      confettiEnabled: db.settings.confettiEnabled,
      historyGraphDays: db.settings.historyGraphDays,
    },
    preferencesUpdatedAt: db.meta.updatedAt,
  };
}

/** Rejects a payload that is not a diary, before it can touch real data. */
export function isValidPayload(value: unknown): value is SyncPayload {
  if (typeof value !== 'object' || value === null) return false;
  const payload = value as Partial<SyncPayload>;
  return Array.isArray(payload.logs) && Array.isArray(payload.foodDictionary);
}
