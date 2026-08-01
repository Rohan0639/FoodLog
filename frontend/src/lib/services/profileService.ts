/**
 * The local profile.
 *
 * Replaces Supabase's `auth.getUser()`. There are no credentials and no session:
 * the profile is created on first launch and never leaves the device, which is
 * why signing in is no longer required to use the app.
 */

import { readDb, updateDb } from '../storage/localDb';
import type { Profile } from '../storage/schema';

/** The current profile. Created automatically on first read. */
export function getProfile(): Profile {
  return readDb().profile;
}

/** Renames the profile. */
export function setProfileName(name: string): Profile {
  const trimmed = name.trim();
  return updateDb((db) => ({
    ...db,
    profile: { ...db.profile, name: trimmed || db.profile.name },
  })).profile;
}
