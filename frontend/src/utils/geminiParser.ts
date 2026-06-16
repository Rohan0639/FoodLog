const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

export interface ParsedItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
}

export interface ParsedTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
}

export interface GeminiResponse {
  status: 'valid' | 'invalid';
  reason?: string;
  reply?: string;
  items?: ParsedItem[];
  totals?: ParsedTotals;
}

function extractWeightInGramsOrMl(quantityStr: string) {
  if (!quantityStr || typeof quantityStr !== 'string') return null;
  const clean = quantityStr.toLowerCase().trim();
  
  // Match grams (g, gm, gms, grams)
  const matchGrams = clean.match(/^(\d+(?:\.\d+)?)\s*(?:g|gm|gms|grams?)$/);
  if (matchGrams) return { value: parseFloat(matchGrams[1]), type: 'weight' as const };
  
  // Match ml (ml, milliliter, milliliters)
  const matchMl = clean.match(/^(\d+(?:\.\d+)?)\s*(?:ml|milliliters?)$/);
  if (matchMl) return { value: parseFloat(matchMl[1]), type: 'volume' as const };

  // Match liters (l, liter, liters)
  const matchL = clean.match(/^(\d+(?:\.\d+)?)\s*(?:l|liters?)$/);
  if (matchL) return { value: parseFloat(matchL[1]) * 1000, type: 'volume' as const }; // convert to ml
  
  return null;
}

function validateGeminiResponse(data: any) {
  if (!data || typeof data !== 'object') {
    throw new Error("Invalid structure: response data is not an object");
  }

  if (data.status === 'invalid') {
    if (typeof data.reason !== 'string' || !data.reason.trim()) {
      throw new Error("Invalid structure: missing reason for invalid status");
    }
    return;
  }

  if (data.status !== 'valid') {
    throw new Error("Invalid structure: missing or invalid status field");
  }

  if (!data.items || !Array.isArray(data.items)) {
    throw new Error("Invalid structure: missing items array");
  }
  if (!data.totals || typeof data.totals !== 'object') {
    throw new Error("Invalid structure: missing totals object");
  }

  const totals = data.totals;
  
  // C. Logical Limits (totals)
  if (totals.calories < 0 || totals.protein < 0 || totals.carbs < 0 || totals.fat < 0 || totals.sugar < 0 || totals.fiber < 0) {
    throw new Error("Logical limit failure: negative macro or nutrient values in totals");
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
        typeof item.carbs !== 'number' || typeof item.fat !== 'number' ||
        typeof item.sugar !== 'number' || typeof item.fiber !== 'number') {
      throw new Error(`Validation failure on item "${item.name}": nutrient values must be numbers`);
    }

    // C. Logical Limits (item)
    if (item.calories < 0 || item.protein < 0 || item.carbs < 0 || item.fat < 0 || item.sugar < 0 || item.fiber < 0) {
      throw new Error(`Logical limit failure on item "${item.name}": negative nutrient values`);
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

/**
 * Port of Input Normalization Helper
 */
function normalizeFoodInput(text: string): string {
  if (!text) return "";
  return text
    .replace(/\bgms\b/gi, 'grams')
    .replace(/\bgm\b/gi, 'grams')
    .replace(/\bg\b/gi, 'grams')
    .replace(/\bml\b/gi, 'ml')
    .replace(/\bl\b/gi, 'liters');
}

/**
 * Queries Gemini API directly from the client and parses the nutrition data.
 */
export async function analyzeFoodClient(foodText: string): Promise<GeminiResponse> {
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API Key! Please verify that VITE_GEMINI_API_KEY is configured in your .env file.');
  }

  const normalizedInput = normalizeFoodInput(foodText);

  const prompt = `You are a strict food recognition and calorie estimation assistant.

Step 1: Validate the input.
- Check if the user input describes real, edible food or drink.
- If the input is not food (e.g., objects, people, jokes, unrealistic items like "my friend", "stone", "car", etc.), DO NOT estimate calories.

Step 2: If invalid:
- Respond ONLY with:
{
  "status": "invalid",
  "reason": "Input is not a valid food item"
}

Step 3: If valid:
- Extract food items and estimate realistic calorie values.
- Avoid extreme or unrealistic calorie values.

Respond ONLY in JSON format.

Valid response format:
{
  "status": "valid",
  "reply": "A friendly confirmation or response message summarizing the food and macros, and maybe a helpful tip.",
  "items": [
    {
      "name": "food name",
      "quantity": "string quantity description (e.g. 1 apple, 100g, etc.)",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sugar": number,
      "fiber": number
    }
  ],
  "totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number,
    "sugar": number,
    "fiber": number
  }
}

Use realistic values for macros, sugar, fiber and calories:
- Max calories per gram ≤ 9 kcal
- Ensure macros match calories:
  calories ≈ (protein×4 + carbs×4 + fat×9)

No explanation. Only JSON.

Sentence to analyze: "${normalizedInput.replace(/"/g, '\\"')}"`;

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API returned status: ${response.status}`);
  }

  const resData = await response.json();
  const candidates = resData?.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini API did not return any candidates.');
  }

  const rawText = candidates[0].content?.parts[0]?.text;
  
  let parsedData: any;
  try {
    const text = (rawText || '').trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new SyntaxError("Could not find valid JSON object markers in response text");
    }
    
    const jsonSubstring = text.substring(firstBrace, lastBrace + 1);
    parsedData = JSON.parse(jsonSubstring);
  } catch (parseErr: any) {
    throw new SyntaxError(`JSON Parsing failed: ${parseErr.message}`);
  }

  // Validate format requirements
  validateGeminiResponse(parsedData);

  return parsedData as GeminiResponse;
}
