// Using native fetch

const BACKEND_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧪 Starting validation tests for new edit/delete/logs APIs...\n');

  let testLogId = null;

  // 1. Test POST /parse-food
  console.log('--- 1. POST /parse-food ---');
  try {
    const postRes = await fetch(`${BACKEND_URL}/parse-food`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '2 bananas and 3 eggs' })
    });
    
    const postData = await postRes.json();
    console.log(`Status: ${postRes.status}`);
    console.log('Data:', JSON.stringify(postData, null, 2));

    if (postRes.status === 200 && postData.success && postData.data?._id) {
      testLogId = postData.data._id;
      console.log(`✅ POST test passed. Created log ID: ${testLogId}`);
    } else {
      console.error('❌ POST test failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in POST request:', err.message);
    process.exit(1);
  }

  // 2. Test GET /logs
  console.log('\n--- 2. GET /logs ---');
  try {
    const getRes = await fetch(`${BACKEND_URL}/logs`);
    const getData = await getRes.json();
    console.log(`Status: ${getRes.status}`);
    console.log('Logs count:', getData.data?.length);
    
    const foundLog = getData.data?.find(log => log._id === testLogId);
    if (getRes.status === 200 && foundLog) {
      console.log('✅ GET test passed. Created log found in database logs list.');
    } else {
      console.error('❌ GET test failed. Created log not found in logs list.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in GET request:', err.message);
    process.exit(1);
  }

  // 3. Test PUT /log/:id (Valid edit)
  console.log('\n--- 3. PUT /log/:id (Valid Edit) ---');
  try {
    const putRes = await fetch(`${BACKEND_URL}/log/${testLogId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodText: '1 banana and 1 egg' })
    });
    
    const putData = await putRes.json();
    console.log(`Status: ${putRes.status}`);
    console.log('Updated Data:', JSON.stringify(putData, null, 2));

    if (putRes.status === 200 && putData.success && putData.data?.foodText === '1 banana and 1 egg') {
      console.log('✅ PUT valid edit test passed.');
    } else {
      console.error('❌ PUT valid edit test failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in PUT request:', err.message);
    process.exit(1);
  }

  // 4. Test PUT /log/:id (Invalid edit validation check)
  console.log('\n--- 4. PUT /log/:id (Invalid Edit Validation Check) ---');
  try {
    // 500g butter has density > 9 kcal/gram or negative macros or similar check that fails validation
    const putRes = await fetch(`${BACKEND_URL}/log/${testLogId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodText: '-10 bananas' })
    });
    
    const putData = await putRes.json();
    console.log(`Status: ${putRes.status}`);
    console.log('Response:', JSON.stringify(putData, null, 2));

    if (putRes.status === 502 || (putRes.status === 400 && !putData.success)) {
      console.log('✅ PUT invalid edit validation test passed. Denied successfully.');
    } else {
      console.error('❌ PUT invalid edit validation test failed. Allowed invalid update!');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in PUT request:', err.message);
    process.exit(1);
  }

  // 5. Test DELETE /log/:id
  console.log('\n--- 5. DELETE /log/:id ---');
  try {
    const delRes = await fetch(`${BACKEND_URL}/log/${testLogId}`, {
      method: 'DELETE'
    });
    
    const delData = await delRes.json();
    console.log(`Status: ${delRes.status}`);
    console.log('Response:', JSON.stringify(delData, null, 2));

    if (delRes.status === 200 && delData.success) {
      console.log('✅ DELETE test passed.');
    } else {
      console.error('❌ DELETE test failed.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in DELETE request:', err.message);
    process.exit(1);
  }

  // 6. Test GET /logs after delete
  console.log('\n--- 6. GET /logs (after delete) ---');
  try {
    const getRes = await fetch(`${BACKEND_URL}/logs`);
    const getData = await getRes.json();
    
    const foundLog = getData.data?.find(log => log._id === testLogId);
    if (!foundLog) {
      console.log('✅ Verification successful. Log was completely removed.');
    } else {
      console.error('❌ Verification failed. Log still exists after delete.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in post-delete GET request:', err.message);
    process.exit(1);
  }

  console.log('\n🌟 All backend API integration tests passed successfully!');
}

runTests();
