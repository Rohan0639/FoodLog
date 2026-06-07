/**
 * Integration test script for the FoodLog get-nutrition Spoonacular API endpoint.
 * Run this to verify parsing and macro calculation behavior.
 */

const NUTRITION_URL = 'http://localhost:5000/get-nutrition';

const TEST_PAYLOADS = [
  {
    name: "Standard parse check (2 bananas & 3 eggs)",
    body: {
      foods: [
        { name: "banana", quantity: 2, unit: "piece" },
        { name: "egg", quantity: 3, unit: "piece" }
      ]
    }
  },
  {
    name: "Count and weights mix (100g rice & 150g chicken breast)",
    body: {
      foods: [
        { name: "white rice", quantity: 100, unit: "g" },
        { name: "chicken breast", quantity: 150, unit: "grams" }
      ]
    }
  },
  {
    name: "Unknown items graceful skip check",
    body: {
      foods: [
        { name: "banana", quantity: 1, unit: "piece" },
        { name: "xyz_superfood_unreal_item", quantity: 1, unit: "serving" }
      ]
    }
  },
  {
    name: "Validation error: Missing quantity check (should fail with 400)",
    body: {
      foods: [
        { name: "banana", unit: "piece" } // Missing quantity!
      ]
    }
  }
];

async function runTests() {
  console.log('🚀 Starting get-nutrition API integration tests...\n');
  
  for (let i = 0; i < TEST_PAYLOADS.length; i++) {
    const { name, body } = TEST_PAYLOADS[i];
    console.log(`[Test ${i + 1}] Running: ${name}`);
    console.log(`Payload:`, JSON.stringify(body, null, 2));
    
    try {
      const response = await fetch(NUTRITION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const status = response.status;
      const data = await response.json();
      
      if (status >= 200 && status < 300) {
        console.log(`✅ Success (Status ${status}):`);
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(`❌ Expected/API Failure (Status ${status}):`);
        console.log(JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error(`🔴 Network or request error:`, err.message);
    }
    console.log('--------------------------------------------------\n');
  }
}

runTests();
