import axios from 'axios';
import config from '../config.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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
Convert the given food text into structured JSON.

Return ONLY valid JSON in this format:
{
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

No explanation. No extra text.

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
    if (!rawText) {
      throw new Error('Empty response content received from Gemini.');
    }

    // Attempt to parse JSON response directly
    let parsedData;
    try {
      parsedData = JSON.parse(rawText.trim());
    } catch (parseErr) {
      console.warn('Direct JSON parsing failed. Attempting sanitization...', parseErr);
      
      // Fallback clean up of markdown wrappers if Gemini returned them
      const cleanJsonText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
      parsedData = JSON.parse(cleanJsonText);
    }

    // Validate structured format requirements
    if (!parsedData.items || !Array.isArray(parsedData.items) || !parsedData.totals) {
      throw new Error('Response is missing required "items" or "totals" fields.');
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
