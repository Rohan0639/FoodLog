/**
 * Daily macro targets.
 *
 * Previously a hard-coded constant in Dashboard, so a user could never change
 * them. They are now persisted per device and read through this service, which
 * is all that a future "edit goals" screen would need.
 */

import { readDb, updateDb } from '../storage/localDb';
import { DEFAULT_DAILY_GOAL } from '../storage/schema';
import type { DailyGoal } from '../../types';

/** The active daily goal. */
export function getDailyGoal(): DailyGoal {
  return readDb().goals;
}

/** Updates some or all targets. */
export function setDailyGoal(patch: Partial<DailyGoal>): DailyGoal {
  return updateDb((db) => ({ ...db, goals: { ...db.goals, ...patch } })).goals;
}

/** Restores the shipped defaults. */
export function resetDailyGoal(): DailyGoal {
  return updateDb((db) => ({ ...db, goals: { ...DEFAULT_DAILY_GOAL } })).goals;
}
