import axios from 'axios';
import config from '../config.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/**
 * Communicates with Gemini API to parse natural language food logs into structured JSON.
 * @param {string} text - User's food entry description
 * @returns {Promise<object>} Structured foods JSON
 */
export async function parseFoodText(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text must be a valid non-empty string');
  }

  const prompt = `Extract food items from the user sentence.
Return ONLY JSON in this format:
{
  "foods": [
    { "name": "string", "quantity": number, "unit": "string" }
  ]
}

Rules:
- Normalize food names to singular, lower-case (e.g., "bananas" -> "banana", "boiled eggs" -> "boiled egg").
- Convert words representing numbers to actual digits (e.g., "two" -> 2, "three and a half" -> 3.5, "half" -> 0.5).
- If quantity is missing, assume 1 (e.g., "I had rice and chicken" -> rice: 1 piece/serving, chicken: 1 piece/serving).
- Keep units simple (e.g., "piece", "grams", "ml", "cup", "slice", "serving"). Use "piece" for countable individual items.
- If quantity is combined with a unit like "100g rice" or "100 grams of rice", set quantity to 100 and unit to "grams".
- If no food items are found in the text, return an empty array: {"foods": []}.
- No explanations, comments, or markdown fences. Output ONLY valid, parsable raw JSON.

Sentence: "${text.replace(/"/g, '\\"')}"`;

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

    // Extract text from Gemini structure
    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini API did not return any candidates.');
    }

    const rawText = candidates[0].content?.parts[0]?.text;
    if (!rawText) {
      throw new Error('Empty response content received from Gemini.');
    }

    // Try parsing the text directly
    try {
      const parsedData = JSON.parse(rawText.trim());
      
      // Basic validation of structured schema
      if (!parsedData.foods || !Array.isArray(parsedData.foods)) {
        throw new Error('Invalid JSON format: missing "foods" array.');
      }
      
      return parsedData;
    } catch (parseErr) {
      console.warn('Direct JSON parsing failed. Attempting sanitization...', parseErr);
      
      // Fallback: strip markdown JSON fences if the LLM output is wrapped despite instructions
      const cleanJsonText = rawText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
        
      const parsedData = JSON.parse(cleanJsonText);
      if (!parsedData.foods || !Array.isArray(parsedData.foods)) {
        throw new Error('Invalid JSON format after sanitization.');
      }
      return parsedData;
    }
  } catch (error) {
    console.error('Error in llmService:', error.message);
    
    // Check if it's an Axios/API error vs code error
    if (error.response) {
      console.error('Gemini API Error details:', error.response.status, JSON.stringify(error.response.data));
    }
    
    // Provide user-friendly error fallback
    throw new Error(`Failed to parse food text: ${error.message}`);
  }
}
