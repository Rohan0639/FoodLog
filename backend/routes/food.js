import express from 'express';
import { parseFoodText } from '../services/llmService.js';

const router = express.Router();

// Middleware to validate request body for /parse-food
const validateParseRequest = (req, res, next) => {
  const { text } = req.body;
  
  if (text === undefined || text === null) {
    return res.status(400).json({
      error: "Bad Request",
      message: "The request body must contain a 'text' field."
    });
  }
  
  if (typeof text !== 'string' || text.trim() === '') {
    return res.status(400).json({
      error: "Bad Request",
      message: "The 'text' field must be a non-empty string."
    });
  }
  
  next();
};

/**
 * POST /parse-food
 * Request body: { "text": "I ate 2 bananas and 3 eggs" }
 */
router.post('/parse-food', validateParseRequest, async (req, res, next) => {
  try {
    const result = await parseFoodText(req.body.text);
    return res.json(result);
  } catch (error) {
    // Return structured failure response matching requirements
    console.error(`Error processing /parse-food for text "${req.body.text}":`, error.message);
    
    // Check if Gemini was unavailable or keys were bad
    return res.status(502).json({
      error: "Bad Gateway / Parser Error",
      message: "Unable to parse food log using the AI model at this moment.",
      detail: error.message,
      // Fallback response format so client applications can handle gracefully
      fallback: {
        foods: [
          // Fallback guess: return the entire text as a single unparsed entry
          { name: req.body.text.trim(), quantity: 1, unit: "serving" }
        ]
      }
    });
  }
});

export default router;
