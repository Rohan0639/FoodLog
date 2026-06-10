const BACKEND_URL = 'http://localhost:5000';

async function runTests() {
  console.log('🧪 Starting validation tests for new edit/delete/logs APIs...\n');

  let testLogId = null;
  let parsedFoods = [];

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
    
    if (postRes.status === 200 && postData.success && Array.isArray(postData.data)) {
      parsedFoods = postData.data;
      console.log(`✅ POST parse-food test passed. Parsed ${parsedFoods.length} items.`);
    } else {
      console.error('❌ POST parse-food test failed:', postData);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in POST parse-food request:', err.message);
    process.exit(1);
  }

  // 1b. Test POST /food/batch (to save logs into the database)
  console.log('\n--- 1b. POST /food/batch ---');
  try {
    const batchRes = await fetch(`${BACKEND_URL}/food/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foods: parsedFoods })
    });
    
    const batchData = await batchRes.json();
    console.log(`Status: ${batchRes.status}`);
    
    if (batchRes.status === 200 && batchData.success && Array.isArray(batchData.data) && batchData.data.length > 0) {
      testLogId = batchData.data[0].id;
      console.log(`✅ POST food/batch test passed. Created entry ID: ${testLogId}`);
    } else {
      console.error('❌ POST food/batch test failed:', batchData);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in POST food/batch request:', err.message);
    process.exit(1);
  }

  // 2. Test GET /logs
  console.log('\n--- 2. GET /logs ---');
  try {
    const getRes = await fetch(`${BACKEND_URL}/logs`);
    const getData = await getRes.json();
    console.log(`Status: ${getRes.status}`);
    console.log('Logs count:', getData.data?.length);
    
    const foundLog = getData.data?.find(log => log.id === testLogId);
    if (getRes.status === 200 && foundLog) {
      console.log('✅ GET test passed. Created log found in database logs list.');
    } else {
      console.error('❌ GET test failed. Created log not found in logs list:', getData);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in GET request:', err.message);
    process.exit(1);
  }

  // 3. Test PUT /log/:id (Valid edit using NLP re-parse)
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

    if (putRes.status === 200 && putData.success && putData.data?.name) {
      // The old ID is deleted and a new one is created by the re-parse, so let's update testLogId to the new one
      testLogId = putData.data.id;
      console.log(`✅ PUT valid edit test passed. New testLogId: ${testLogId}`);
    } else {
      console.error('❌ PUT valid edit test failed:', putData);
      process.exit(1);
    }
  } catch (err) {
    console.error('Error in PUT request:', err.message);
    process.exit(1);
  }

  // 4. Test PUT /log/:id (Invalid edit validation check)
  console.log('\n--- 4. PUT /log/:id (Invalid Edit Validation Check) ---');
  try {
    const putRes = await fetch(`${BACKEND_URL}/log/${testLogId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foodText: 'I ate 100 large cheese pizzas' })
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
      console.error('❌ DELETE test failed:', delData);
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
    
    const foundLog = getData.data?.find(log => log.id === testLogId);
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
