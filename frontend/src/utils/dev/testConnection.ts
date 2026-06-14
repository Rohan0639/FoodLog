import { supabase } from '../../config/supabase';

/**
 * Verification test function to check Supabase database connectivity.
 * Fetches the first 5 records from 'food_logs' table.
 */
export async function testSupabaseConnection() {
  console.log('📡 Testing connection to Supabase...');
  
  try {
    const { data, error } = await supabase
      .from('food_logs')
      .select('*')
      .limit(5);

    if (error) {
      console.error('❌ Supabase connection error:', error.message);
      return { success: false, error: error.message };
    }

    console.log('✅ Supabase connected successfully! Data:', data);
    return { success: true, data };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('❌ Unexpected error during Supabase connection check:', errorMsg);
    return { success: false, error: errorMsg };
  }
}
