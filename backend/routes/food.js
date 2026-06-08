import express from 'express';
import { analyzeFood } from '../services/geminiService.js';
import { saveFoodLog } from '../services/dbService.js';

const router = express.Router();

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
 * POST /parse-food
 * Request body: { "text": "I ate 2 bananas and 3 eggs" }
 */
router.post('/parse-food', validateParseRequest, async (req, res) => {
  const { text } = req.body;
  
  try {
    // 1. Send it to Gemini API
    const result = await analyzeFood(text);
    
    // 2. Store response directly in DB
    saveFoodLog(text, result);
    
    // 3. Return response to client
    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(`Error processing /parse-food for text "${text}":`, error.message);
    
    // Handle specific API error types (Timeout, API failure, Parser error)
    let statusCode = 502; // Bad Gateway
    let errorType = "API Failure / Parser Error";
    
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      statusCode = 504; // Gateway Timeout
      errorType = "API Timeout";
    } else if (error instanceof SyntaxError) {
      statusCode = 502;
      errorType = "Invalid JSON from Gemini";
    }

    return res.status(statusCode).json({
      success: false,
      error: errorType,
      message: "Unable to parse food log using the AI model at this moment.",
      detail: error.message
    });
  }
});

export default router;

