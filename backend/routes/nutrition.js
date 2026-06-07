import express from 'express';
import { getNutritionDetails } from '../services/spoonacularService.js';

const router = express.Router();

// Middleware to validate foods array for /get-nutrition
const validateNutritionRequest = (req, res, next) => {
  const { foods } = req.body;

  if (foods === undefined || foods === null) {
    return res.status(400).json({
      error: "Bad Request",
      message: "The request body must contain a 'foods' field."
    });
  }

  if (!Array.isArray(foods)) {
    return res.status(400).json({
      error: "Bad Request",
      message: "The 'foods' field must be an array of food items."
    });
  }

  if (foods.length === 0) {
    return res.status(400).json({
      error: "Bad Request",
      message: "The 'foods' array must contain at least one item."
    });
  }

  // Validate properties of each item in the array
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    
    if (!food || typeof food !== 'object') {
      return res.status(400).json({
        error: "Bad Request",
        message: `Food item at index ${i} is not a valid object.`
      });
    }

    if (!food.name || typeof food.name !== 'string' || food.name.trim() === '') {
      return res.status(400).json({
        error: "Bad Request",
        message: `Food item at index ${i} is missing a valid 'name' field.`
      });
    }

    if (food.quantity === undefined || food.quantity === null || typeof food.quantity !== 'number' || food.quantity <= 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: `Food item at index ${i} must have a positive 'quantity' number.`
      });
    }
  }

  next();
};

/**
 * POST /get-nutrition
 * Request body: { "foods": [ { "name": "banana", "quantity": 2, "unit": "piece" } ] }
 */
router.post('/get-nutrition', validateNutritionRequest, async (req, res) => {
  try {
    const result = await getNutritionDetails(req.body.foods);
    return res.json(result);
  } catch (error) {
    console.error('Error processing /get-nutrition request:', error.message);
    
    return res.status(502).json({
      error: "Bad Gateway",
      message: "Failed to retrieve nutrition details from database.",
      detail: error.message
    });
  }
});

export default router;
