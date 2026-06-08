import axios from 'axios';
import config from '../config.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

/**
 * Sends a natural language food log to Gemini API for nutrition analysis.
 * @param {string} foodText - Raw text representing what the user ate
 * @returns {Promise<object>} Structured JSON from Gemini
 */
export async function analyzeFood(foodText) {
  if (!foodText || typeof foodText !== 'string' || foodText.trim() === '') {
    throw new Error('Input food text must be a valid non-empty string');
  }

  const prompt = `You are a nutrition analysis AI.

IMPORTANT:
- Quantity refers to TOTAL amount, not servings.
- 200g means 200 grams total, NOT 200 × 100g.

Return ONLY valid JSON in this format:
{
  "reply": "A friendly, conversational response to the user. Greet them warmly if they say hi/hello. If they log foods, confirm what you've logged and maybe add a short, helpful health/nutrition tip. If they ask a general question, answer/reply to them helpfuly.",
  "items": [
    {
      "name": "string",
      "quantity": "string",
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

Use realistic values:
- Max calories per gram ≤ 9 kcal
- Ensure macros match calories:
  calories ≈ (protein×4 + carbs×4 + fat×9)

No explanation. Only JSON.

Sentence: "${foodText.replace(/"/g, '\\"')}"`;

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${config.GEMINI_API_KEY}`,
      {
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
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 12000 // 12 seconds request timeout
      }
    );

    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini API did not return any candidates.');
    }

    const rawText = candidates[0].content?.parts[0]?.text;
    console.log(`[Gemini Response Log] Raw Text:\n${rawText}`);

    // Safe JSON Parsing: Extract and parse safely
    let parsedData;
    try {
      const text = (rawText || '').trim();
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
        throw new SyntaxError("Could not find valid JSON object markers in response text");
      }
      
      const jsonSubstring = text.substring(firstBrace, lastBrace + 1);
      parsedData = JSON.parse(jsonSubstring);
    } catch (parseErr) {
      throw new SyntaxError(`JSON Parsing failed: ${parseErr.message}`);
    }

    // Validate structured format requirements
    if (parsedData.reply === undefined || !parsedData.items || !Array.isArray(parsedData.items) || !parsedData.totals) {
      throw new Error('Response is missing required "reply", "items" or "totals" fields.');
    }

    return parsedData;

  } catch (error) {
    console.error('Error in geminiService:', error.message);
    if (error.response) {
      console.error('Gemini API Response Error details:', error.response.status, JSON.stringify(error.response.data));
    }
    throw error;
  }
}
