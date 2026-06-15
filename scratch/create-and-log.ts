import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// 1. Parse frontend/.env to load Supabase settings
const envPath = path.resolve(__dirname, '../frontend/.env');
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
  console.error('❌ Supabase configuration missing.');
  process.exit(1);
}

process.env.SUPABASE_URL = supabaseUrl;
process.env.VITE_SUPABASE_KEY = supabaseKey;

async function run() {
  const { default: handler } = await import('../api/food-logs/add');
  const supabase = createClient(supabaseUrl!, supabaseKey!);

  const testEmail = `user-${Date.now()}@foodlog-test.com`;
  const testPassword = 'TestPassword123!';
  
  console.log(`Step 1: Creating a brand new test user: ${testEmail}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
  });

  if (signUpError) {
    console.error('❌ Sign up failed:', signUpError.message);
    process.exit(1);
  }

  let sessionToken = signUpData.session?.access_token || '';
  let userId = signUpData.user?.id || '';

  if (!sessionToken) {
    console.log('Signing in to establish active session...');
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInError) {
      console.error('❌ Sign in failed:', signInError.message);
      process.exit(1);
    }
    sessionToken = signInData.session?.access_token || '';
    userId = signInData.user?.id || '';
  }

  console.log(`✅ Auth successful. User ID: ${userId}`);

  const mockFood = {
    id: crypto.randomUUID(),
    name: 'Persistent Test Apple',
    quantity: 1,
    unit: 'piece',
    calories: 95,
    protein: 0.5,
    carbs: 25,
    fats: 0.3,
    createdAt: new Date().toISOString()
  };

  console.log(`Step 2: Sending POST request to backend API to log food: "${mockFood.name}"...`);

  // Mock Request
  const mockReq: any = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${sessionToken}`
    },
    body: {
      logs: [mockFood]
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

  await handler(mockReq, mockRes);

  console.log(`\nStep 3: Verifying Results...`);
  console.log(`HTTP Status: ${responseStatus}`);
  console.log(`Response Data:`, JSON.stringify(responseData, null, 2));

  if (responseStatus === 200 && responseData && responseData.error === null) {
    console.log('\n🎉 Success! Food logged successfully under the new user.');
    console.log(`-----------------------------------------------`);
    console.log(`Test Credentials:`);
    console.log(`Email:    ${testEmail}`);
    console.log(`Password: ${testPassword}`);
    console.log(`-----------------------------------------------`);
    console.log(`Logged food ID: ${responseData.data[0]?.id}`);
    console.log(`Verification: You can now log into the frontend or query Supabase directly using this user ID: ${userId}`);
  } else {
    console.error('❌ Test failed.');
    process.exit(1);
  }
}

run().catch(console.error);
