/**
 * Saved foods the user can re-log without re-parsing.
 *
 * The store and this service exist as requested; no UI surfaces them yet, so
 * nothing in the current screens calls these functions. They are the complete
 * data layer a "favourites" feature would build on.
 */

import { readDb, updateDb } from '../storage/localDb';
import { newId, type Favorite } from '../storage/schema';
import type { FoodEntry } from '../../types';
import { getCurrentIsoString } from '../../utils/date';

/** All saved favourites, newest first. */
export function getFavorites(): Favorite[] {
  return [...readDb().favorites].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** Saves a logged entry as a favourite. Re-saving the same name is a no-op. */
export function addFavorite(entry: FoodEntry): Favorite | null {
  const name = (entry.name || '').trim();
  if (!name) return null;

  const existing = readDb().favorites.find(
    (fav) => fav.name.toLowerCase() === name.toLowerCase()
  );
  if (existing) return existing;

  const favorite: Favorite = {
    id: newId(),
    name,
    quantity: entry.quantity,
    unit: entry.unit,
    calories: entry.calories || 0,
    protein: entry.protein || 0,
    carbs: entry.carbs || 0,
    fats: entry.fats || 0,
    sugar: entry.sugar || 0,
    fiber: entry.fiber || 0,
    createdAt: getCurrentIsoString(),
  };

  updateDb((db) => ({ ...db, favorites: [...db.favorites, favorite] }));
  return favorite;
}

/** Removes a favourite by id. */
export function removeFavorite(id: string): void {
  updateDb((db) => ({ ...db, favorites: db.favorites.filter((fav) => fav.id !== id) }));
}

/** True when a food of this name is already saved. */
export function isFavorite(name: string): boolean {
  const needle = name.trim().toLowerCase();
  return readDb().favorites.some((fav) => fav.name.toLowerCase() === needle);
}
