import express from 'express';
import { analyzeFood } from '../services/geminiService.js';
import { saveFoodLog, getFoodLogs, updateFoodLog, deleteFoodLog } from '../services/dbService.js';

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
 * GET /logs
 * Returns all saved food logs
 */
router.get('/logs', (req, res) => {
  try {
    const logs = getFoodLogs();
    return res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[GET /logs Error]:', error);
    return res.status(500).json({
      success: false,
      error: "Database Error",
      message: "Unable to retrieve food logs.",
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
      
      // Store response directly in DB
      const savedLog = saveFoodLog(normalizedInput, result);
      
      return res.json({
        success: true,
        data: savedLog
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
 * PUT /log/:id
 * Request body: { "foodText": "150 grams rice" }
 */
router.put('/log/:id', async (req, res) => {
  const { id } = req.params;
  const { foodText } = req.body;

  if (foodText === undefined || foodText === null) {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "The request body must contain a 'foodText' field."
    });
  }

  if (typeof foodText !== 'string' || foodText.trim() === '') {
    return res.status(400).json({
      success: false,
      error: "Bad Request",
      message: "The 'foodText' field must be a non-empty string."
    });
  }

  const normalizedInput = normalizeFoodInput(foodText);
  console.log(`[Edit Log] ID: ${id} | Raw: "${foodText}" | Normalized: "${normalizedInput}"`);

  let attempts = 0;
  const maxAttempts = 2;
  let lastError = null;

  // Retry System
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Gemini Request] Calling API on edit. Attempt ${attempts}/${maxAttempts} for text: "${normalizedInput}"`);
    
    try {
      // Send normalized input to Gemini API
      const result = await analyzeFood(normalizedInput);
      
      // Perform universal safety checks
      validateGeminiResponse(normalizedInput, result);
      
      // Update SQLite database with new parsed data
      const updatedLog = updateFoodLog(id, normalizedInput, result);
      
      return res.json({
        success: true,
        data: updatedLog
      });
    } catch (error) {
      console.warn(`[Validation/API Failure on Edit] Attempt ${attempts} failed: ${error.message}`);
      lastError = error;
    }
  }

  // Both attempts failed
  console.error(`[Error Log] All edit attempts failed for ID ${id}. Details: ${lastError.message}`);
  
  return res.status(502).json({
    success: false,
    error: lastError?.name || "Parser / Validation Error",
    message: "Unable to parse food log using the AI model at this moment.",
    detail: lastError?.message
  });
});

/**
 * DELETE /log/:id
 * Removes log from database
 */
router.delete('/log/:id', (req, res) => {
  const { id } = req.params;
  try {
    const success = deleteFoodLog(id);
    if (!success) {
      return res.status(404).json({
        success: false,
        error: "Not Found",
        message: `Food log with ID ${id} not found.`
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
      message: "Unable to delete food log.",
      detail: error.message
    });
  }
});

export default router;

