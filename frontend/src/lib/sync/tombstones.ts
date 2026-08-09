/**
 * Recording deletions so they can travel between devices.
 *
 * Deleting a record locally removes it from this device — but to every other
 * device that still holds it, that absence is indistinguishable from "never
 * seen it". On the next sync they would push it straight back, and the user
 * would watch a deleted meal reappear. A deletion has to be a fact, not the
 * absence of one.
 */

import { updateDb } from '../storage/localDb';
import {
  TOMBSTONE_RETENTION_DAYS,
  type FoodLogDb,
  type SyncedCollection,
  type Tombstone,
} from '../storage/schema';
import { getCurrentIsoString } from '../../utils/date';

/** Marks ids as deleted, replacing any earlier tombstone for the same record. */
export function record(collection: SyncedCollection, ids: string[]): void {
  if (ids.length === 0) return;

  const deletedAt = getCurrentIsoString();
  updateDb((db) => {
    const marked = new Set(ids);
    const kept = db.tombstones.filter(
      (t) => !(t.collection === collection && marked.has(t.id))
    );
    return {
      ...db,
      tombstones: prune([
        ...kept,
        ...ids.map((id) => ({ id, collection, deletedAt })),
      ]),
    };
  });
}

/** Adds tombstones from another device, keeping the later of any duplicates. */
export function merge(db: FoodLogDb, incoming: Tombstone[]): Tombstone[] {
  const byKey = new Map<string, Tombstone>();

  for (const tombstone of [...db.tombstones, ...incoming]) {
    const key = `${tombstone.collection}:${tombstone.id}`;
    const existing = byKey.get(key);
    if (!existing || existing.deletedAt < tombstone.deletedAt) {
      byKey.set(key, tombstone);
    }
  }

  return prune(Array.from(byKey.values()));
}

/** Fast lookup of "was this deleted, and when". */
export function index(tombstones: Tombstone[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const t of tombstones) {
    const key = `${t.collection}:${t.id}`;
    const existing = map.get(key);
    if (!existing || existing < t.deletedAt) map.set(key, t.deletedAt);
  }
  return map;
}

/**
 * Drops tombstones old enough that every device has certainly seen them.
 *
 * Without this the list grows forever. The window is generous because the cost
 * of forgetting too early is a resurrected record.
 */
export function prune(tombstones: Tombstone[], now: number = Date.now()): Tombstone[] {
  const cutoff = now - TOMBSTONE_RETENTION_DAYS * 86_400_000;
  return tombstones.filter((t) => {
    const at = new Date(t.deletedAt).getTime();
    return !Number.isFinite(at) || at >= cutoff;
  });
}
