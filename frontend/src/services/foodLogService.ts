import { supabase } from '../lib/supabase';

/**
 * Service function to add food logs via the backend API.
 * Route: POST /api/food-logs/add
 */
export async function addFoodLogs(logs: any[]) {
  try {
    // 1. Get the current active user session
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    // 2. Make the POST request to our Vercel Serverless Function
    const response = await fetch('/api/food-logs/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ logs })
    });

    // 3. Handle non-OK status codes
    if (!response.ok) {
      let errMsg = 'Failed to insert food log';
      try {
        const errorData = await response.json();
        errMsg = errorData?.error || errorData?.message || errMsg;
      } catch (e) {
        // Fall back to reading raw text if JSON parsing fails
        try {
          const rawText = await response.text();
          if (rawText) errMsg = rawText;
        } catch (textErr) {}
      }
      return { data: null, error: { message: errMsg } };
    }

    // 4. Return response exactly like Supabase client does: { data, error }
    const result = await response.json();
    return {
      data: result.data || [],
      error: result.error ? { message: result.error } : null
    };
  } catch (err: any) {
    console.error('Error in addFoodLogs service:', err);
    return {
      data: null,
      error: { message: err.message || 'Network error occurred while inserting food logs.' }
    };
  }
}
