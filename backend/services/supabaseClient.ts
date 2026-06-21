import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    '⚠️ Server-side Supabase configuration is missing! Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_KEY are defined in the environment.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseKey || '');
