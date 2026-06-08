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
  const normalized = text.toLowerCase().trim();
  if (!normalized || isGreeting(normalized)) {
    return [];
  }
  const items: FoodItem[] = [];
  
  // Split query by "and", ",", "then", "with", "+", etc.
  const parts = normalized.split(/\band\b|,|\bthen\b|\bwith\b|\+/);
  
  parts.forEach((part, index) => {
    const cleanedPart = part.trim();
    if (!cleanedPart) return;
    
    // Pattern matches:
    // 1. A number like "2", "3.5", "1/2" or articles like "a", "an", "one"
    // 2. An optional separator like "cups of", "grams of", "g of"
    // 3. The food name
    const match = cleanedPart.match(/^(?:(a|an|one|\d+(?:\.\d+)?|\d+\/\d+)\s+)?(?:(cups?|grams?|g|serving?s?|slices?|pcs?|cups?\s+of|g\s+of|grams?\s+of)\s+)?(.+)$/i);
    
    if (match) {
      const quantityStr = match[1] || '1';
      const unitPrefix = match[2] || '';
      let foodQuery = match[3].trim();
      
      // Clean up common prefixes like "ate", "had", "drank", "logged", "for lunch", "for breakfast"
      foodQuery = foodQuery.replace(/^(ate|had|drank|logged|consumed)\s+/i, '');
      foodQuery = foodQuery.replace(/\s+(for\s+(breakfast|lunch|dinner|snack|meals?))$/i, '');
      
      if (!foodQuery) return;
      
      // Parse quantity
      let quantity = 1;
      if (quantityStr === 'a' || quantityStr === 'an' || quantityStr === 'one') {
        quantity = 1;
      } else if (quantityStr.includes('/')) {
        const [num, den] = quantityStr.split('/').map(Number);
        if (num && den) quantity = num / den;
      } else {
        quantity = parseFloat(quantityStr) || 1;
      }
      
      // Lookup in database
      const dbFood = FOOD_DATABASE[foodQuery];
      
      if (dbFood) {
        // If unitPrefix is provided, adjust name/unit representation
        const finalUnit = unitPrefix ? unitPrefix.trim() : dbFood.unit;
        
        items.push({
          id: `food-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          name: dbFood.name,
          quantity,
          unit: finalUnit,
          calories: Math.round(dbFood.calories * quantity),
          protein: Math.round(dbFood.protein * quantity * 10) / 10,
          carbs: Math.round(dbFood.carbs * quantity * 10) / 10,
          fat: Math.round(dbFood.fat * quantity * 10) / 10,
          loggedAt: new Date()
        });
      } else {
        // Generate values for unknown food
        const generated = generateMacrosForUnknownFood(foodQuery);
        const finalUnit = unitPrefix ? unitPrefix.trim() : 'serving';
        
        items.push({
          id: `food-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
          name: generated.name,
          quantity,
          unit: finalUnit,
          calories: Math.round(generated.calories * quantity),
          protein: Math.round(generated.protein * quantity * 10) / 10,
          carbs: Math.round(generated.carbs * quantity * 10) / 10,
          fat: Math.round(generated.fat * quantity * 10) / 10,
          loggedAt: new Date()
        });
      }
    }
  });
  
  return items;
}

function getScaleFactor(dbUnit: string, userUnit: string): number {
  const normDb = dbUnit.toLowerCase().trim();
  const normUser = userUnit.toLowerCase().trim();
  
  if (normDb === normUser) return 1;
  
  // Case 1: Database unit is "100g" (e.g., chicken, rice)
  if (normDb === '100g') {
    if (normUser === 'g' || normUser === 'grams' || normUser === 'gram') {
      return 0.01; // 1g = 0.01 of 100g
    }
  }
  
  // Case 2: Database unit is "cup" (e.g., milk, blueberries)
  if (normDb === 'cup') {
    if (normUser === 'ml' || normUser === 'milliliters' || normUser === 'ml.') {
      return 1 / 240; // 1 cup = 240ml
    }
    if (normUser === 'g' || normUser === 'grams' || normUser === 'gram') {
      return 1 / 240; // Approx 1g = 1ml for liquids
    }
  }
  
  return 1;
}

export function enrichParsedFood(name: string, quantity: number, unit: string, index: number = 0): FoodItem {
  const normalizedQuery = name.toLowerCase().trim();
  const dbFood = FOOD_DATABASE[normalizedQuery];
  
  if (dbFood) {
    const scale = getScaleFactor(dbFood.unit, unit);
    return {
      id: `food-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      name: dbFood.name,
      quantity,
      unit: unit || dbFood.unit,
      calories: Math.round(dbFood.calories * quantity * scale),
      protein: Math.round(dbFood.protein * quantity * scale * 10) / 10,
      carbs: Math.round(dbFood.carbs * quantity * scale * 10) / 10,
      fat: Math.round(dbFood.fat * quantity * scale * 10) / 10,
      loggedAt: new Date()
    };
  } else {
    const generated = generateMacrosForUnknownFood(normalizedQuery);
    // For unknown foods, if logged in grams or ml, assume the generated macros were per 100g/ml
    const lowerUnit = (unit || '').toLowerCase().trim();
    const isWeightVolume = ['g', 'grams', 'gram', 'ml', 'milliliters'].includes(lowerUnit);
    const scale = isWeightVolume ? 0.01 : 1;
    
    return {
      id: `food-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
      name: generated.name,
      quantity,
      unit: unit || 'serving',
      calories: Math.round(generated.calories * quantity * scale),
      protein: Math.round(generated.protein * quantity * scale * 10) / 10,
      carbs: Math.round(generated.carbs * quantity * scale * 10) / 10,
      fat: Math.round(generated.fat * quantity * scale * 10) / 10,
      loggedAt: new Date()
    };
  }
}

