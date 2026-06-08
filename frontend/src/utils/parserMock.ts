import type { FoodItem } from '../types';

const GREETINGS = new Set([
  'hi', 'hello', 'hey', 'yo', 'greetings', 'good morning', 'good afternoon', 'good evening',
  'sup', 'howdy', 'hola', 'hi there', 'hello there', 'hey there', 'help', 'info',
  'how are you', 'what is this', 'clear', 'reset'
]);

export function isGreeting(text: string): boolean {
  const clean = text.toLowerCase().trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  return GREETINGS.has(clean);
}

interface DatabaseFood {
  name: string;
  calories: number; // per unit/serving
  protein: number;  // in grams
  carbs: number;    // in grams
  fat: number;      // in grams
  unit: string;
  defaultQty: number;
}

const FOOD_DATABASE: Record<string, DatabaseFood> = {
  banana: { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, unit: 'banana', defaultQty: 1 },
  bananas: { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, unit: 'banana', defaultQty: 1 },
  egg: { name: 'Whole Egg', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, unit: 'egg', defaultQty: 1 },
  eggs: { name: 'Whole Egg', calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, unit: 'egg', defaultQty: 1 },
  apple: { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, unit: 'apple', defaultQty: 1 },
  apples: { name: 'Apple', calories: 95, protein: 0.5, carbs: 25, fat: 0.3, unit: 'apple', defaultQty: 1 },
  'chicken breast': { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: '100g', defaultQty: 1.5 },
  chicken: { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, unit: '100g', defaultQty: 1.5 },
  salad: { name: 'Garden Salad', calories: 120, protein: 2, carbs: 10, fat: 8, unit: 'bowl', defaultQty: 1 },
  coffee: { name: 'Black Coffee', calories: 5, protein: 0.3, carbs: 0, fat: 0, unit: 'cup', defaultQty: 1 },
  cookie: { name: 'Chocolate Chip Cookie', calories: 150, protein: 2, carbs: 20, fat: 7, unit: 'cookie', defaultQty: 1 },
  cookies: { name: 'Chocolate Chip Cookie', calories: 150, protein: 2, carbs: 20, fat: 7, unit: 'cookie', defaultQty: 1 },
  milk: { name: 'Whole Milk', calories: 149, protein: 8, carbs: 12, fat: 8, unit: 'cup', defaultQty: 1 },
  rice: { name: 'White Rice', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, unit: '100g', defaultQty: 1.5 },
  'protein shake': { name: 'Protein Shake', calories: 180, protein: 30, carbs: 4, fat: 2.5, unit: 'shake', defaultQty: 1 },
  shake: { name: 'Protein Shake', calories: 180, protein: 30, carbs: 4, fat: 2.5, unit: 'shake', defaultQty: 1 },
  'sweet potato': { name: 'Sweet Potato', calories: 112, protein: 2, carbs: 26, fat: 0.1, unit: 'potato', defaultQty: 1 },
  blueberries: { name: 'Blueberries', calories: 85, protein: 1.1, carbs: 21, fat: 0.5, unit: 'cup', defaultQty: 1 },
  blueberry: { name: 'Blueberries', calories: 85, protein: 1.1, carbs: 21, fat: 0.5, unit: 'cup', defaultQty: 1 },
  avocado: { name: 'Avocado', calories: 240, protein: 3, carbs: 12, fat: 22, unit: 'avocado', defaultQty: 1 },
  avocados: { name: 'Avocado', calories: 240, protein: 3, carbs: 12, fat: 22, unit: 'avocado', defaultQty: 1 },
};

// Simple hash function to generate deterministic values for unknown foods
function generateMacrosForUnknownFood(foodName: string): Omit<DatabaseFood, 'unit' | 'defaultQty'> {
  let hash = 0;
  for (let i = 0; i < foodName.length; i++) {
    hash = foodName.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const absHash = Math.abs(hash);
  // Calories between 50 and 450
  const calories = 50 + (absHash % 400);
  
  // Distribute calories into protein, carbs, fat
  // 1g protein = 4 cal, 1g carb = 4 cal, 1g fat = 9 cal
  const fatPercentage = 10 + (absHash % 40); // 10% to 50% fat calories
  const proteinPercentage = 15 + ((absHash >> 2) % 35); // 15% to 50% protein
  const carbsPercentage = 100 - fatPercentage - proteinPercentage;
  
  const fatCals = (calories * fatPercentage) / 100;
  const proCals = (calories * proteinPercentage) / 100;
  const carbCals = (calories * carbsPercentage) / 100;
  
  const fat = Math.round((fatCals / 9) * 10) / 10;
  const protein = Math.round((proCals / 4) * 10) / 10;
  const carbs = Math.round((carbCals / 4) * 10) / 10;
  
  // Title-case the food name
  const formattedName = foodName
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    name: formattedName,
    calories,
    protein,
    carbs,
    fat,
  };
}

/**
 * Parses a natural language sentence and extracts food items.
 * Example: "I ate 2 bananas and 3 eggs"
 * Matches: 
 *   - "2 bananas" -> Qty 2, Food: banana
 *   - "3 eggs" -> Qty 3, Food: egg
 */
export function parseFoodMessage(text: string): FoodItem[] {
  // Offline macro calculations are completely disabled to ensure only valid, Gemini-verified data is logged.
  return [];
}
  


