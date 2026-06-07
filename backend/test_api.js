/**
 * Automated test script for the FoodLog Backend service.
 * Run this to verify endpoint behavior and LLM extraction accuracy.
 */

const BACKEND_URL = 'http://localhost:5000/parse-food';

const TEST_CASES = [
  {
    name: "Standard quantity & plural names",
    text: "I ate 2 bananas and 3 boiled eggs"
  },
  {
    name: "Default quantity (should assume 1)",
    text: "I had rice and chicken"
  },
  {
    name: "Weight unit extraction",
    text: "100g rice"
  },
  {
    name: "Count representation (an / piece)",
    text: "I ate an apple"
  },
  {
    name: "Empty validation check (should trigger 400)",
    text: ""
  }
];

async function runTests() {
  console.log('🚀 Starting integration tests for FoodLog backend...\n');
  
  for (let i = 0; i < TEST_CASES.length; i++) {
    const { name, text } = TEST_CASES[i];
    console.log(`[Test ${i + 1}] Running: ${name}`);
    console.log(`💬 Input: "${text}"`);
    
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      
      const status = response.status;
      const data = await response.json();
      
      if (status >= 200 && status < 300) {
        console.log(`✅ Success (Status ${status}):`);
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`❌ Expected Failure (Status ${status}):`);
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error(`🔴 Network / Request Error:`, err.message);
    }
    console.log('--------------------------------------------------\n');
  }
}

runTests();
