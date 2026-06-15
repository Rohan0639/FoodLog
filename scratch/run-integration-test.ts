import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Parse frontend/.env to load Supabase settings BEFORE anything else runs
const envPath = path.resolve(__dirname, '../frontend/.env');
console.log(`Reading environment from: ${envPath}`);
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    const val = trimmed.substring(firstEq + 1).trim();
    process.env[key] = val;
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase configuration missing in environment.');
  process.exit(1);
}

// Map variables for the API handler
process.env.SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_KEY = supabaseKey;

console.log(`Supabase URL: ${supabaseUrl}`);

async function runTest() {
  // Dynamically import the handler after process.env is populated
  const { default: handler } = await import('../api/food-logs/add');

  const supabase = createClient(supabaseUrl!, supabaseKey!);

  const testEmail = `test-${Date.now()}@foodlog.local`;
  const testPassword = 'TestPassword123!';
  let sessionToken = '';

  console.log(`Creating test user: ${testEmail}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('❌ Sign up failed:', signUpError.message);
    process.exit(1);
  }

  sessionToken = signUpData.session?.access_token || '';
  if (!sessionToken) {
    console.log('User signed up, signing in to get session...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      process.exit(1);
    }
    sessionToken = signInData.session?.access_token || '';
  }

  console.log('✅ Obtained session JWT token.');

  // Mock Request
  const mockReq: any = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken}`
    },
    body: {
      logs: [
        {
          id: crypto.randomUUID(),
          name: 'Integration Test Banana',
          quantity: 2,
          unit: 'piece',
          calories: 210,
          protein: 2.6,
          carbs: 54,
          fats: 0.6,
          createdAt: new Date().toISOString()
        }
      ]
    }
  };

  // Mock Response
  let responseStatus = 200;
  let responseData: any = null;

  const mockRes: any = {
    status(code: number) {
      responseStatus = code;
      return this;
    },
    json(data: any) {
      responseData = data;
      return this;
    }
  };

  console.log('Running API Handler...');
  await handler(mockReq, mockRes);

  console.log(`\n--- Test Results ---`);
  console.log(`HTTP Status: ${responseStatus}`);
  console.log(`Response Data:`, JSON.stringify(responseData, null, 2));

  if (responseStatus === 200 && responseData && responseData.error === null && Array.isArray(responseData.data)) {
    console.log('🎉 Success! Backend API logic works correctly.');
    
    // Clean up inserted record
    const insertedId = responseData.data[0]?.id;
    if (insertedId) {
      console.log(`Cleaning up inserted log ID: ${insertedId}...`);
      const { error: deleteError } = await supabase
        .from('food_logs')
        .delete()
        .eq('id', insertedId);
      if (deleteError) {
        console.error('⚠️ Cleanup failed:', deleteError.message);
      } else {
        console.log('🗑️ Cleaned up test record.');
      }
    }
  } else {
    console.error('❌ Test failed.');
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Unexpected error running integration test:', err);
  process.exit(1);
});
