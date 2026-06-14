import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '⚠️ Supabase configuration is missing! Check your frontend/.env file and ensure VITE_SUPABASE_URL and either VITE_SUPABASE_KEY or VITE_SUPABASE_ANON_KEY are defined.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
