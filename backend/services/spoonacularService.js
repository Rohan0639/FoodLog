import axios from 'axios';
import config from '../config.js';

const SPOONACULAR_API_URL = 'https://api.spoonacular.com/recipes/parseIngredients';

/**
 * Finds the amount value of a specific nutrient by name (case-insensitive check)
 * @param {Array} nutrients - Spoonacular nutrients list
 * @param {string} nutrientName - Target nutrient name (e.g. 'Calories')
 * @returns {number} Nutrient amount or 0 if not found
 */
function getNutrientAmount(nutrients, nutrientName) {
  if (!nutrients || !Array.isArray(nutrients)) return 0;
  const target = nutrients.find(n => n.name.toLowerCase() === nutrientName.toLowerCase());
  return target ? parseFloat(target.amount) : 0;
}

/**
 * Normalizes Spoonacular units for clean presentation.
 * @param {string} unit - Raw unit string
 * @returns {string} Normalized unit
 */
function normalizeUnit(unit) {
  const u = (unit || '').toLowerCase().trim();
  if (!u || u === 'piece' || u === 'pieces' || u === 'count' || u === 'serving' || u === 'servings') {
    return 'count';
  }
  return u;
}

/**
 * Fetches nutrition details from Spoonacular for an array of foods.
 * @param {Array<object>} foods - [{ name, quantity, unit }]
 * @returns {Promise<object>} Clean structured nutrition payload with totals
 */
export async function getNutritionDetails(foods) {
  if (!foods || !Array.isArray(foods) || foods.length === 0) {
    throw new Error('Foods list must be a non-empty array');
  }

  // Convert each food to Spoonacular input line format: "2 piece banana" -> "2 banana"
  const ingredientQueries = foods.map(item => {
    const qty = item.quantity || 1;
    // Normalize count/piece units to blank space so Spoonacular resolves them better
    const lowerUnit = (item.unit || '').toLowerCase().trim();
    const unitPart = (lowerUnit === 'piece' || lowerUnit === 'pieces' || lowerUnit === 'count') ? '' : lowerUnit;
    
    return `${qty} ${unitPart} ${item.name}`.replace(/\s+/g, ' ').trim();
  });

  // Construct URL encoded body params
  const params = new URLSearchParams();
  params.append('ingredientList', ingredientQueries.join('\n'));
  params.append('servings', '1');
  params.append('includeNutrition', 'true');

  try {
    const response = await axios.post(
      `${SPOONACULAR_API_URL}?apiKey=${config.SPOONACULAR_API_KEY}`,
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000 // 10s timeout
      }
    );

    const data = response.data;
    if (!Array.isArray(data)) {
      throw new Error('Unexpected Spoonacular response format: expected an array.');
    }

    const items = [];
    const total = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };

    // Iterate through input foods to keep order and handle missing matches from Spoonacular
    foods.forEach((inputFood, index) => {
      const parsedItem = data[index];
      
      if (parsedItem && parsedItem.name) {
        // Successfully resolved by Spoonacular
        const nutrients = parsedItem.nutrition?.nutrients || [];
        
        const calories = Math.round(getNutrientAmount(nutrients, 'Calories'));
        const protein = Math.round(getNutrientAmount(nutrients, 'Protein') * 10) / 10;
        const carbs = Math.round(getNutrientAmount(nutrients, 'Carbohydrates') * 10) / 10;
        const fat = Math.round(getNutrientAmount(nutrients, 'Fat') * 10) / 10;

        items.push({
          name: parsedItem.name,
          quantity: parsedItem.amount || inputFood.quantity,
          unit: normalizeUnit(parsedItem.unit || inputFood.unit),
          calories,
          protein,
          carbs,
          fat
        });

        // Add to aggregate totals
        total.calories += calories;
        total.protein += protein;
        total.carbs += carbs;
        total.fat += fat;
      } else {
        // Unknown or unresolved food - mark as unknown with zero values to prevent crash
        items.push({
          name: inputFood.name,
          quantity: inputFood.quantity,
          unit: normalizeUnit(inputFood.unit),
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          unknown: true
        });
      }
    });

    // Round total macros to 1 decimal place to prevent floating-point representation bugs
    total.protein = Math.round(total.protein * 10) / 10;
    total.carbs = Math.round(total.carbs * 10) / 10;
    total.fat = Math.round(total.fat * 10) / 10;

    return {
      items,
      total
    };

  } catch (error) {
    console.error('Error in spoonacularService:', error.message);
    if (error.response) {
      console.error('Spoonacular API error details:', error.response.status, JSON.stringify(error.response.data));
    }
    throw new Error(`Spoonacular integration failed: ${error.message}`);
  }
}
