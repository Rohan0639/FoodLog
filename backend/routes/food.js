import express from 'express';
import crypto from 'crypto';
import { analyzeFood } from '../services/geminiService.js';
import { saveFoodLog, getFoodLogs, updateFoodLog, deleteFoodLog, saveFoodEntry, getFoodEntries, updateFoodEntry, deleteFoodEntry, clearAllFoodEntries } from '../services/dbService.js';

function parseQuantityAndUnit(quantityStr) {
  if (typeof quantityStr === 'number') {
    return { quantity: quantityStr, unit: 'piece' };
  }
  const str = String(quantityStr || '').trim();
  const match = str.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match) {
    return {
      quantity: parseFloat(match[1]),
      unit: match[2] ? match[2].trim() : 'piece'
    };
  }
  return {
    quantity: parseFloat(str) || 1,
    unit: str || 'piece'
  };
}

const router = express.Router();


// 1. Input Normalization Helper
function normalizeFoodInput(text) {
  if (!text) return "";
  return text
    .replace(/\bgms\b/gi, 'grams')
    .replace(/\bgm\b/gi, 'grams')
    .replace(/\bg\b/gi, 'grams')
    .replace(/\bml\b/gi, 'ml')
    .replace(/\bl\b/gi, 'liters');
}

// 4. Universal Response Validation
function extractWeightInGramsOrMl(quantityStr) {
  if (!quantityStr || typeof quantityStr !== 'string') return null;
  const clean = quantityStr.toLowerCase().trim();
  
  // Match grams (g, gm, gms, grams)
  const matchGrams = clean.match(/^(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams?)$/);
  if (matchGrams) return { value: parseFloat(matchGrams[1]), type: 'weight' };
  
  // Match ml (ml, milliliter, milliliters)
  const matchMl = clean.match(/^(\d+(?:\.\d+)?)\s*(?:ml|milliliters?)$/);
  if (matchMl) return { value: parseFloat(matchMl[1]), type: 'volume' };

  // Match liters (l, liter, liters)
  const matchL = clean.match(/^(\d+(?:\.\d+)?)\s*(?:l|liters?)$/);
  if (matchL) return { value: parseFloat(matchL[1]) * 1000, type: 'volume' }; // convert to ml
  
  return null;
}

function validateGeminiResponse(foodText, data) {
  if (!data || typeof data !== 'object') {
    throw new Error("Invalid structure: response data is not an object");
  }
  if (!data.items || !Array.isArray(data.items)) {
    throw new Error("Invalid structure: missing items array");
  }
  if (!data.totals || typeof data.totals !== 'object') {
    throw new Error("Invalid structure: missing totals object");
  }

  const totals = data.totals;
  
  // C. Logical Limits (totals)
  if (totals.calories < 0 || totals.protein < 0 || totals.carbs < 0 || totals.fat < 0) {
    throw new Error("Logical limit failure: negative macro values in totals");
  }
  if (totals.calories > 5000) {
    throw new Error(`Logical limit failure: total calories (${totals.calories}) exceed 5000 kcal`);
  }

  // B. Macro Consistency (totals)
  if (totals.calories > 20) {
    const expectedTotalCals = (totals.protein * 4) + (totals.carbs * 4) + (totals.fat * 9);
    const diff = Math.abs(expectedTotalCals - totals.calories);
    const percentageDiff = diff / totals.calories;
    if (percentageDiff >= 0.20) {
      throw new Error(`Macro consistency failure on totals: expected ${expectedTotalCals} kcal but reported ${totals.calories} kcal (diff: ${Math.round(percentageDiff * 100)}% >= 20%)`);
    }
  }

  // Validate each item
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    if (typeof item.calories !== 'number' || typeof item.protein !== 'number' ||
        typeof item.carbs !== 'number' || typeof item.fat !== 'number') {
      throw new Error(`Validation failure on item "${item.name}": macro values must be numbers`);
    }

    // C. Logical Limits (item)
    if (item.calories < 0 || item.protein < 0 || item.carbs < 0 || item.fat < 0) {
      throw new Error(`Logical limit failure on item "${item.name}": negative macro values`);
    }

    // B. Macro Consistency (item)
    if (item.calories > 20) {
      const expectedItemCals = (item.protein * 4) + (item.carbs * 4) + (item.fat * 9);
      const diff = Math.abs(expectedItemCals - item.calories);
      const percentageDiff = diff / item.calories;
      if (percentageDiff >= 0.20) {
        throw new Error(`Macro consistency failure on item "${item.name}": expected ${expectedItemCals} kcal but reported ${item.calories} kcal (diff: ${Math.round(percentageDiff * 100)}% >= 20%)`);
      }
    }

    // Density and Weight checks
    const weightInfo = extractWeightInGramsOrMl(item.quantity);
    if (weightInfo) {
      const weightValue = weightInfo.value;
      if (weightValue > 0) {
        // A. Calorie Density Check
        const caloriesPerUnit = item.calories / weightValue;
        if (caloriesPerUnit > 9) {
          throw new Error(`Calorie density failure on item "${item.name}": ${item.calories} kcal for ${weightValue} ${weightInfo.type === 'weight' ? 'g' : 'ml'} has density ${caloriesPerUnit.toFixed(2)} kcal/unit (exceeds 9 kcal/unit limit)`);
        }

        // D. Weight Consistency
        if (weightInfo.type === 'weight') {
          const sumMacros = item.protein + item.carbs + item.fat;
          if (sumMacros > weightValue * 1.05) { // 5% rounding allowance
            throw new Error(`Weight consistency failure on item "${item.name}": sum of macros (${sumMacros}g) exceeds total weight (${weightValue}g)`);
          }
        }
      }
    }
  }
}

// Middleware to validate request body for /parse-food
const validateParseRequest = (req, res, next) => {
  const { text } = req.body;
  
  if (text === undefined || text === null) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "The request body must contain a 'text' field."
    });
  }
  
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "The 'text' field must be a non-empty string."
    });
  }
  
  next();
};

/**
 * GET /food
 * Returns all saved food entries
 */
router.get('/food', (req, res) => {
  try {
    const entries = getFoodEntries();
    return res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('[GET /food Error]:', error);
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to retrieve food entries.",
      detail: error.message
    });
  }
});

/**
 * GET /logs
 * Returns all saved food entries (mapped for backward-compatibility)
 */
router.get('/logs', (req, res) => {
  try {
    const entries = getFoodEntries();
    return res.json({
      success: true,
      data: entries
    });
  } catch (error) {
    console.error('[GET /logs Error]:', error);
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to retrieve food entries.",
      detail: error.message
    });
  }
});

/**
 * POST /parse-food
 * Request body: { "text": "200 gms rice" }
 */
router.post('/parse-food', validateParseRequest, async (req, res) => {
  const rawInput = req.body.text;
  
  // 1. Input Normalization
  const normalizedInput = normalizeFoodInput(rawInput);
  console.log(`[Input Log] Raw: "${rawInput}" | Normalized: "${normalizedInput}"`);
  
  let attempts = 0;
  const maxAttempts = 2;
  let lastError = null;

  // 5. Retry System
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Gemini Request] Calling API. Attempt ${attempts}/${maxAttempts} for text: "${normalizedInput}"`);
    
    try {
      // Send normalized input to Gemini API
      const result = await analyzeFood(normalizedInput);
      
      // Perform universal safety checks
      validateGeminiResponse(normalizedInput, result);
      // Construct draft food entries without saving to the database
      const items = result.items || [];
      const draftEntries = [];
      
      for (const item of items) {
        const { quantity, unit } = parseQuantityAndUnit(item.quantity);
        draftEntries.push({
          id: crypto.randomUUID(),
          name: item.name || 'Unknown',
          quantity,
          unit,
          baseQuantity: quantity,
          baseUnit: unit,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fats: item.fat || 0
        });
      }

      // Also save fallback logs for safety
      try {
        saveFoodLog(normalizedInput, result);
      } catch (err) {
        console.warn('[Warning] Failed to write raw fallback food log:', err.message);
      }
      
      return res.json({
        success: true,
        reply: result.reply || `Logged your food!`,
        data: draftEntries
      });
    } catch (error) {
      console.warn(`[Validation/API Failure] Attempt ${attempts} failed: ${error.message}`);
      lastError = error;
    }
  }

  // Both attempts failed
  console.error(`[Error Log] All parse attempts failed for: "${normalizedInput}". Details: ${lastError.message}`);
  
  return res.status(502).json({
    success: false,
    error: lastError?.name || "Parser / Validation Error",
    message: "Unable to parse food log using the AI model at this moment.",
    detail: lastError?.message
  });
});

/**
 * PUT /food/:id
 * Request body: { name, quantity, unit, calories, protein, carbs, fats }
 */
router.put('/food/:id', (req, res) => {
  const { id } = req.params;
  const { name, quantity, unit, calories, protein, carbs, fats } = req.body;

  if (!name || quantity === undefined || !unit || calories === undefined || protein === undefined || carbs === undefined || fats === undefined) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "All fields are required to update a food entry: name, quantity, unit, calories, protein, carbs, fats."
    });
  }

  if (parseFloat(quantity) <= 0) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "Quantity must be greater than zero."
    });
  }

  try {
    const updated = updateFoodEntry(id, {
      name,
      quantity: parseFloat(quantity),
      unit,
      calories: parseFloat(calories),
      protein: parseFloat(protein),
      carbs: parseFloat(carbs),
      fats: parseFloat(fats)
    });
    return res.json({
      success: true,
      data: updated
    });
  } catch (error) {
    console.error(`[PUT /food/${id} Error]:`, error);
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: error.message
      });
    }
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to update food entry.",
      detail: error.message
    });
  }
});

/**
 * PUT /log/:id
 * Maps to /food/:id if request body has full info, otherwise falls back to NLP re-parse
 */
router.put('/log/:id', async (req, res) => {
  const { id } = req.params;
  const { name, quantity, unit, calories, protein, carbs, fats, foodText } = req.body;

  // Direct edit of fields
  if (name && quantity !== undefined && unit) {
    try {
      const updated = updateFoodEntry(id, {
        name,
        quantity: parseFloat(quantity),
        unit,
        calories: parseFloat(calories || 0),
        protein: parseFloat(protein || 0),
        carbs: parseFloat(carbs || 0),
        fats: parseFloat(fats || 0)
      });
      return res.json({
        success: true,
        data: updated
      });
    } catch (err) {
      console.warn(`[PUT /log/:id direct update failed]:`, err.message);
    }
  }

  // Fallback to old re-parsing logic
  if (foodText === undefined || foodText === null) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "The request body must contain a 'foodText' field or full food entry details."
    });
  }

  const normalizedInput = normalizeFoodInput(foodText);
  let attempts = 0;
  const maxAttempts = 2;
  let lastError = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const result = await analyzeFood(normalizedInput);
      validateGeminiResponse(normalizedInput, result);
      
      // Delete old food entry, create new ones
      deleteFoodEntry(id);
      
      const items = result.items || [];
      const savedEntries = [];
      for (const item of items) {
        const { quantity: parsedQty, unit: parsedUnit } = parseQuantityAndUnit(item.quantity);
        const entry = saveFoodEntry({
          name: item.name || 'Unknown',
          quantity: parsedQty,
          unit: parsedUnit,
          calories: item.calories || 0,
          protein: item.protein || 0,
          carbs: item.carbs || 0,
          fats: item.fat || 0
        });
        if (entry) {
          savedEntries.push(entry);
        }
      }

      return res.json({
        success: true,
        data: savedEntries[0] || null
      });
    } catch (error) {
      lastError = error;
    }
  }

  return res.status(502).json({
    success: false,
    error: lastError?.name || "Parser / Validation Error",
    message: "Unable to parse food log using the AI model.",
    detail: lastError?.message
  });
});

/**
 * DELETE /food/:id
 */
router.delete('/food/:id', (req, res) => {
  const { id } = req.params;
  try {
    const success = deleteFoodEntry(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Food entry with ID ${id} not found.`
      });
    }
    return res.json({
      success: true
    });
  } catch (error) {
    console.error(`[DELETE /food/${id} Error]:`, error);
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to delete food entry.",
      detail: error.message
    });
  }
});

/**
 * DELETE /log/:id
 * Maps to DELETE /food/:id
 */
router.delete('/log/:id', (req, res) => {
  const { id } = req.params;
  try {
    const success = deleteFoodEntry(id) || deleteFoodLog(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Food entry or log with ID ${id} not found.`
      });
    }
    return res.json({
      success: true
    });
  } catch (error) {
    console.error(`[DELETE /log/${id} Error]:`, error);
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to delete food entry.",
      detail: error.message
    });
  }
});

/**
 * POST /food/batch
 * Request body: { foods: [ { name, quantity, unit, calories, protein, carbs, fats }, ... ] }
 */
router.post('/food/batch', (req, res) => {
  const { foods } = req.body;
  if (!Array.isArray(foods)) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "The request body must contain a 'foods' array."
    });
  }

  try {
    const savedEntries = [];
    for (const food of foods) {
      const entry = saveFoodEntry({
        id: food.id,
        name: food.name,
        quantity: parseFloat(food.quantity),
        unit: food.unit,
        calories: parseFloat(food.calories),
        protein: parseFloat(food.protein),
        carbs: parseFloat(food.carbs),
        fats: parseFloat(food.fats),
        createdAt: food.createdAt || new Date().toISOString()
      });
      if (entry) {
        savedEntries.push(entry);
      }
    }

    return res.json({
      success: true,
      data: savedEntries
    });
  } catch (error) {
    console.error('[POST /food/batch Error]:', error);
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to save food entries.",
      detail: error.message
    });
  }
});

export default router;

