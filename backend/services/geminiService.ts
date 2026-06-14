import { validateGeminiResponse, normalizeFoodInput, type GeminiResponse } from './geminiParser';
import { globalRateLimiter, RateLimitError } from '../middleware/rateLimiter';
import { responseCache } from './responseCache';
import { apiLogger } from '../middleware/apiLogger';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

/**
 * Backend service to call Gemini API, validate responses, and handle caching.
 */
export async function analyzeFood(text: string): Promise<GeminiResponse> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  // 1. Check server-side cache
  const cachedData = responseCache.get(text);
  if (cachedData) {
    apiLogger.info(`[Server Cache] Hit for: "${text}"`);
    return cachedData;
  }

  // 2. Server-side Rate Limiting check
  const limitCheck = globalRateLimiter.consume();
  if (!limitCheck.allowed) {
    apiLogger.warn(`[Rate Limit] Triggered for query: "${text}"`);
    throw new RateLimitError('Rate limit exceeded', limitCheck.retryAfterMs);
  }

  apiLogger.info(`[Server API] Sending query to Gemini: "${text}"`);
  const startTime = Date.now();

  const normalizedInput = normalizeFoodInput(text);

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
      "fat": number
    }
  ],
  "totals": {
    "calories": number,
    "protein": number,
    "carbs": number,
    "fat": number
  }
}

Use realistic values for macros and calories:
- Max calories per gram ≤ 9 kcal
- Ensure macros match calories:
  calories ≈ (protein×4 + carbs×4 + fat×9)

No explanation. Only JSON.

Sentence to analyze: "${normalizedInput.replace(/"/g, '\\"')}"`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

  try {
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
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Gemini API returned status: ${response.status}`);
    }

    const resData = await response.json();
    const candidates = resData?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini API did not return any candidates.');
    }

    const rawText = candidates[0].content?.parts[0]?.text;
    const cleanText = (rawText || '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      throw new SyntaxError("Could not find valid JSON object markers in response text");
    }
    
    const jsonSubstring = cleanText.substring(firstBrace, lastBrace + 1);
    const parsedData = JSON.parse(jsonSubstring);

    // Validate structure, logical limits, density, and weight consistency
    validateGeminiResponse(parsedData);

    // Cache the response
    responseCache.set(text, parsedData);

    const duration = Date.now() - startTime;
    apiLogger.info(`[Server API] Successfully parsed via Gemini in ${duration}ms:`, parsedData);

    return parsedData as GeminiResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    apiLogger.error(`[Server API] Failed to parse query: "${text}". Error: ${error.message}`);
    throw error;
  }
}
