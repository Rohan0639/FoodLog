import { GeminiResponse } from '../../shared/types';
import { normalizeFoodInput } from '../../shared/normalize';
import { validateGeminiResponse } from '../utils/validator';
import { GEMINI_CONFIG } from '../../config';

const GEMINI_API_URL = GEMINI_CONFIG.API_URL;

export async function callGemini(foodText: string): Promise<GeminiResponse> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('Missing Gemini API Key in server environment variables! Please configure GEMINI_API_KEY.');
  }

  const normalizedInput = normalizeFoodInput(foodText);

  const prompt = `You are an advanced food parsing and nutrition extraction engine.

Your task is to convert natural language food input into accurate structured food items with correct quantities and realistic nutritional values.

## CRITICAL RULES

1. NEVER oversimplify food items.
   - "KFC rice bowl" must NOT become "rice"
   - "peri peri chicken strips" must NOT become "chicken breast"
   - Preserve brand, preparation style, and dish type in the name

2. Treat multi-word foods as SINGLE entities when appropriate.
   - "fried rice", "rice bowl", "chicken strips", "burger", "pizza slice"

3. Detect brand and restaurant foods.
   - KFC, McDonald's, Domino's, Subway, etc.
   - These are COMPOSITE FOODS → estimate realistic macros for the whole dish

4. Handle quantities correctly:
   - Extract numbers (300g, 2 pieces, 1 cup, etc.)
   - Normalize units: g, ml, piece, slice, serving

5. If weight is given (like 300g):
   - Calculate nutrition proportionally based on weight
   - Do NOT ignore weight

6. If food is complex or branded:
   - Estimate macros based on real-world nutritional data
   - DO NOT fallback to generic base ingredients

7. Split multiple items on "and", ",", "+" only.
   - DO NOT split on "with" if it describes a single dish (e.g. "burger with cheese" is ONE item)

## INPUT VALIDATION

First, check if the input describes real, edible food or drink.
If the input is not food (e.g., objects, people, jokes, unrealistic items like "my friend", "stone", "car"), respond ONLY with:
{
  "status": "invalid",
  "reason": "Input is not a valid food item"
}

## OUTPUT FORMAT (for valid food)

Respond ONLY in JSON format. No explanation.

{
  "status": "valid",
  "reply": "A friendly confirmation summarizing the food items and a helpful tip.",
  "items": [
    {
      "name": "full food name (preserve brand and preparation)",
      "quantity": "string quantity description (e.g. '1 serving', '300g', '2 pieces')",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fat": number,
      "sugar": number,
      "fiber": number,
      "baseFoodName": "normalized base name (singular, lowercase, e.g. 'kfc rice bowl', 'pizza', 'banana')",
      "baseName": "short normalized name without brand (e.g. 'rice bowl', 'chicken strips')",
      "brand": "brand name or null (e.g. 'KFC', 'McDonald\\'s', null)",
      "baseUnit": "base unit of lookup (e.g. 'serving', 'piece', 'grams', 'ml')",
      "baseQty": number,
      "caloriesPerUnit": number,
      "proteinPerUnit": number,
      "carbsPerUnit": number,
      "fatPerUnit": number,
      "sugarPerUnit": number,
      "fiberPerUnit": number,
      "aliases": ["array of common string aliases"]
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

Sentence to analyze: "${normalizedInput.replace(/"/g, '\"')}"`;

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
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gemini API returned status ${response.status}: ${errorBody || response.statusText}`);
  }

  const resData = (await response.json()) as any;
  const candidates = resData?.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('Gemini API did not return any candidates.');
  }

  const rawText = candidates[0].content?.parts[0]?.text;
  if (!rawText) {
    throw new Error('Gemini API returned an empty response.');
  }
  
  let parsedData: any;
  try {
    const text = rawText.trim();
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new SyntaxError("Could not find valid JSON object markers in response text");
    }
    
    const jsonSubstring = text.substring(firstBrace, lastBrace + 1);
    parsedData = JSON.parse(jsonSubstring);
  } catch (parseErr: any) {
    throw new SyntaxError(`JSON Parsing failed: ${parseErr.message}. Raw text: ${rawText}`);
  }

  // Validate structure and ranges
  validateGeminiResponse(parsedData);

  return parsedData as GeminiResponse;
}
