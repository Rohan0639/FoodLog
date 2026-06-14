import type { VercelRequest, VercelResponse } from '@vercel/node';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent';

function normalizeFoodInput(text: string): string {
  if (!text) return "";
  return text
    .replace(/\bgms\b/gi, 'grams')
    .replace(/\bgm\b/gi, 'grams')
    .replace(/\bg\b/gi, 'grams')
    .replace(/\bml\b/gi, 'ml')
    .replace(/\bl\b/gi, 'liters');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method Not Allowed' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text field' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  }

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
- Max calories per gram \u2264 9 kcal
- Ensure macros match calories:
  calories \u2248 (protein\u00d74 + carbs\u00d74 + fat\u00d79)

No explanation. Only JSON.

Sentence to analyze: "${normalizedInput.replace(/"/g, '\\"')}"`;

  // Timeout controller (10 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

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
      const errText = await response.text();
      return res.status(502).json({ error: `Gemini API returned status ${response.status}: ${errText}` });
    }

    const resData = await response.json();
    const candidates = resData?.candidates;
    if (!candidates || candidates.length === 0) {
      return res.status(502).json({ error: 'Gemini API did not return any candidates.' });
    }

    const rawText = candidates[0].content?.parts[0]?.text;
    const cleanText = (rawText || '').trim();
    const firstBrace = cleanText.indexOf('{');
    const lastBrace = cleanText.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
      return res.status(502).json({ error: "Could not find valid JSON object markers in response text" });
    }
    
    const jsonSubstring = cleanText.substring(firstBrace, lastBrace + 1);
    const parsedData = JSON.parse(jsonSubstring);

    return res.status(200).json(parsedData);
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Gateway Timeout: Gemini API request timed out after 10 seconds' });
    }
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
