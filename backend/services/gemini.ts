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
