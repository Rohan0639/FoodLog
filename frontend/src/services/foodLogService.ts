import { supabase } from '../lib/supabase';
import type { FoodEntry } from '../types';

/**
 * Service Layer for handling Supabase database interactions for Food Logs.
 */

export interface DbFoodLogInsert {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  created_at: string;
  date: string;
  user_id: string;
}

export const foodLogService = {
  /**
   * Fetches food logs for a specific user and date.
   * Relying on RLS, but filtering by date and ordering by created_at descending.
   */
  async fetchTodayLogs(date: string) {
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Inserts multiple food log entries.
   */
  async insertFoodLogs(entries: DbFoodLogInsert[]) {
    const { data, error } = await supabase
      .from('food_logs')
      .insert(entries)
      .select();

    if (error) throw error;
    return data || [];
  },

  /**
   * Updates a food log entry with new details.
   */
  async updateFoodLog(id: string, entry: Partial<FoodEntry>) {
    const updatePayload: Record<string, any> = {};
    if (entry.name !== undefined) updatePayload.name = entry.name;
    if (entry.quantity !== undefined) updatePayload.quantity = entry.quantity;
    if (entry.unit !== undefined) updatePayload.unit = entry.unit;
    if (entry.calories !== undefined) updatePayload.calories = entry.calories;
    if (entry.protein !== undefined) updatePayload.protein = entry.protein;
    if (entry.carbs !== undefined) updatePayload.carbs = entry.carbs;
    if (entry.fats !== undefined) updatePayload.fats = entry.fats;

    const { data, error } = await supabase
      .from('food_logs')
      .update(updatePayload)
      .eq('id', id)
      .select();

    if (error) throw error;
    return data || [];
  },

  /**
   * Deletes a specific food log entry.
   */
  async deleteFoodLog(id: string) {
    const { error } = await supabase
      .from('food_logs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Deletes all food log entries for a given date.
   */
  async deleteTodayLogs(date: string) {
    const { error } = await supabase
      .from('food_logs')
      .delete()
      .eq('date', date);

    if (error) throw error;
  }
};
