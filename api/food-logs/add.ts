import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Helper to get Supabase client dynamically based on available keys
function getSupabaseClient(token?: string) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  
  // Use service role key if available, otherwise fall back to publishable key
  const isServiceRole = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('Missing SUPABASE_URL / VITE_SUPABASE_URL env variable');
  }

  const options: any = {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  };

  // If using publishable key fallback, forward the user's token so RLS matches the auth context
  if (!isServiceRole && token) {
    options.global = {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  }

  return createClient(supabaseUrl || '', supabaseServiceKey || '', options);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow only POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      data: null,
      error: 'Method Not Allowed'
    });
  }

  try {
    // 1. Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        data: null,
        error: 'Missing or invalid Authorization header'
      });
    }

    const token = authHeader.split(' ')[1];

    // 2. Validate token and get authenticated user
    const clientForAuth = getSupabaseClient(token);
    const { data: { user }, error: authError } = await clientForAuth.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({
        data: null,
        error: authError?.message || 'Unauthorized'
      });
    }

    // 3. Parse and validate logs from body
    const { logs } = req.body;
    if (!logs) {
      return res.status(400).json({
        data: null,
        error: 'Missing logs in request body'
      });
    }

    const logsArray = Array.isArray(logs) ? logs : [logs];
    if (logsArray.length === 0) {
      return res.status(400).json({
        data: null,
        error: 'Logs array cannot be empty'
      });
    }

    // 4. Sanitize entries by overriding user_id with the authenticated user.id
    const sanitizedLogs = logsArray.map((log: any) => {
      return {
        id: log.id || crypto.randomUUID(),
        name: log.name,
        quantity: typeof log.quantity === 'string' ? parseFloat(log.quantity) : log.quantity,
        unit: log.unit || 'piece',
        calories: log.calories || 0,
        protein: log.protein || 0,
        carbs: log.carbs || 0,
        fats: log.fats || log.fat || 0, // database field is fats
        created_at: log.created_at || log.createdAt || new Date().toISOString(),
        date: log.date || new Date(log.created_at || log.createdAt || Date.now()).toISOString().split('T')[0],
        user_id: user.id // Override with authenticated user ID for security
      };
    });

    // 5. Insert records via Supabase Client (bypasses RLS in prod with service key, uses JWT auth session in fallback)
    const clientForWrite = getSupabaseClient(token);
    const { data, error: insertError } = await clientForWrite
      .from('food_logs')
      .insert(sanitizedLogs)
      .select();

    if (insertError) {
      return res.status(500).json({
        data: null,
        error: insertError.message
      });
    }

    // 6. Return response exactly like Supabase
    return res.status(200).json({
      data,
      error: null
    });

  } catch (err: any) {
    console.error('[API Error] /api/food-logs/add:', err);
    return res.status(500).json({
      data: null,
      error: err.message || 'Internal Server Error'
    });
  }
}
