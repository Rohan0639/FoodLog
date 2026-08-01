/**
 * App settings.
 *
 * Each value replaces a magic number that used to be hard-coded in a component,
 * so they are all read by the running app even though no settings screen exists
 * yet.
 */

import { readDb, updateDb } from '../storage/localDb';
import type { Settings } from '../storage/schema';

/** All settings, with defaults back-filled. */
export function getSettings(): Settings {
  return readDb().settings;
}

/** Updates one or more settings. */
export function updateSettings(patch: Partial<Settings>): Settings {
  return updateDb((db) => ({ ...db, settings: { ...db.settings, ...patch } })).settings;
}
