import { GeminiResponse, ParsedItem } from './types';
import { normalizeFoodInput } from './normalize';

interface FoodDefinition {
  name: string;
  unit: string;
  caloriesPerUnit: number;
  proteinPerUnit: number;
  carbsPerUnit: number;
  fatPerUnit: number;
  sugarPerUnit: number;
  fiberPerUnit: number;
  aliases: string[];
  defaultQty: number;
  isLiquid?: boolean;
}

const FOOD_DATABASE: FoodDefinition[] = [
  {
    name: 'egg',
    unit: 'piece',
    caloriesPerUnit: 70,
    proteinPerUnit: 6,
    carbsPerUnit: 0.6,
    fatPerUnit: 5,
    sugarPerUnit: 0.2,
    fiberPerUnit: 0,
    aliases: ['eggs', 'egg'],
    defaultQty: 1
  },
  {
    name: 'banana',
    unit: 'piece',
    caloriesPerUnit: 90,
    proteinPerUnit: 1.1,
    carbsPerUnit: 23,
    fatPerUnit: 0.3,
    sugarPerUnit: 12,
    fiberPerUnit: 2.6,
    aliases: ['bananas', 'banana'],
    defaultQty: 1
  },
  {
    name: 'apple',
    unit: 'piece',
    caloriesPerUnit: 52,
    proteinPerUnit: 0.3,
    carbsPerUnit: 14,
    fatPerUnit: 0.2,
    sugarPerUnit: 10,
    fiberPerUnit: 2.4,
    aliases: ['apples', 'apple'],
    defaultQty: 1
  },
  {
    name: 'chicken breast',
    unit: 'grams',
    caloriesPerUnit: 1.65, // per 1g
    proteinPerUnit: 0.31,
    carbsPerUnit: 0,
    fatPerUnit: 0.036,
    sugarPerUnit: 0,
    fiberPerUnit: 0,
    aliases: ['chicken breasts', 'chicken breast', 'chicken'],
    defaultQty: 100
  },
  {
    name: 'rice',
    unit: 'grams',
    caloriesPerUnit: 1.3, // per 1g
    proteinPerUnit: 0.027,
    carbsPerUnit: 0.28,
    fatPerUnit: 0.003,
    sugarPerUnit: 0,
    fiberPerUnit: 0.004,
    aliases: ['cooked rice', 'white rice', 'rice'],
    defaultQty: 150
  },
  {
    name: 'milk',
    unit: 'ml',
    caloriesPerUnit: 0.6, // per 1ml
    proteinPerUnit: 0.032,
    carbsPerUnit: 0.048,
    fatPerUnit: 0.032,
    sugarPerUnit: 0.05,
    fiberPerUnit: 0,
    aliases: ['whole milk', 'milk'],
    defaultQty: 200,
    isLiquid: true
  }
];

// Split input by "and", ",", "+", or "with"
function splitIngredients(text: string): string[] {
  return text
    .split(/\band\b|,|\+|\bwith\b/i)
    .map(p => p.trim())
    .filter(p => p.length > 0);
}

// Parse a single ingredient part
function parseIngredientPart(part: string): ParsedItem | null {
  const clean = part.toLowerCase().trim();
  
  // Try to find matching food definition
  let matchedFood: FoodDefinition | null = null;
  let matchedAlias = '';
  
  for (const food of FOOD_DATABASE) {
    for (const alias of food.aliases) {
      // Look for alias matching as a full word boundary or surrounded by spaces/ends
      const regex = new RegExp(`\\b${alias}\\b`, 'i');
      if (regex.test(clean)) {
        // We matched this food! Prefer longer matches (like "chicken breast" over "chicken")
        if (!matchedFood || alias.length > matchedAlias.length) {
          matchedFood = food;
          matchedAlias = alias;
        }
      }
    }
  }
  
  if (!matchedFood) {
    return null;
  }
  
  // Now try to extract quantity and units from the string
  // Format 1: "2 eggs", "100g chicken", "2.5 bananas", "150 ml milk", "1.5 liters milk"
  // Look for any number in the part
  const numberRegex = /(\d+(?:\.\d+)?)/;
  const numMatch = clean.match(numberRegex);
  
  let quantity = matchedFood.defaultQty;
  let unit = matchedFood.unit;
  
  if (numMatch) {
    const rawVal = parseFloat(numMatch[1]);
    
    // Determine unit based on words near it
    const hasGrams = /\b(grams?|g|gms?)\b/.test(clean);
    const hasMl = /\b(ml|milliliters?)\b/.test(clean);
    const hasLiters = /\b(liters?|l)\b/.test(clean);
    const hasPcs = /\b(pieces?|pcs?)\b/.test(clean);
    
    if (hasLiters && matchedFood.isLiquid) {
      quantity = rawVal * 1000;
      unit = 'ml';
    } else if (hasMl && matchedFood.isLiquid) {
      quantity = rawVal;
      unit = 'ml';
    } else if (hasGrams && matchedFood.unit === 'grams') {
      quantity = rawVal;
      unit = 'grams';
    } else if (hasPcs && matchedFood.unit === 'piece') {
      quantity = rawVal;
      unit = 'piece';
    } else {
      // No explicit unit word or matches, guess based on food default unit
      if (matchedFood.unit === 'piece') {
        quantity = rawVal; // e.g. "2 eggs" -> 2
        unit = 'piece';
      } else {
        // E.g. "100 chicken" -> 100g
        quantity = rawVal;
        unit = matchedFood.unit;
      }
    }
  } else {
    // No number found, e.g. "egg", "banana", "chicken breast"
    // Use default quantity
    quantity = matchedFood.defaultQty;
    unit = matchedFood.unit;
  }

  // Calculate macros
  let factor = 1;
  if (matchedFood.unit === 'grams' || matchedFood.unit === 'ml') {
    factor = quantity; // caloriesPerUnit is per 1g/1ml
  } else {
    factor = quantity; // caloriesPerUnit is per 1 piece
  }
  
  // Format quantity description
  const quantityStr = matchedFood.unit === 'piece'
    ? `${quantity} ${quantity === 1 ? 'piece' : 'pieces'}`
    : `${quantity}${matchedFood.unit === 'grams' ? 'g' : 'ml'}`;

  // Round values to 1 decimal place
  const round = (val: number) => Math.round(val * 10) / 10;

  return {
    name: matchedFood.name,
    quantity: quantityStr,
    calories: round(matchedFood.caloriesPerUnit * factor),
    protein: round(matchedFood.proteinPerUnit * factor),
    carbs: round(matchedFood.carbsPerUnit * factor),
    fat: round(matchedFood.fatPerUnit * factor),
    sugar: round(matchedFood.sugarPerUnit * factor),
    fiber: round(matchedFood.fiberPerUnit * factor)
  };
}

export function parseFoodRules(text: string): GeminiResponse | null {
  const normalized = normalizeFoodInput(text);
  if (!normalized) return null;
  
  const parts = splitIngredients(normalized);
  if (parts.length === 0) return null;
  
  const items: ParsedItem[] = [];
  
  for (const part of parts) {
    const item = parseIngredientPart(part);
    if (!item) {
      // If any ingredient fails to parse via rules, fall back to LLM
      return null;
    }
    items.push(item);
  }
  
  // Calculate totals
  const totals = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    sugar: 0,
    fiber: 0
  };
  
  for (const item of items) {
    totals.calories += item.calories;
    totals.protein += item.protein;
    totals.carbs += item.carbs;
    totals.fat += item.fat;
    totals.sugar += item.sugar;
    totals.fiber += item.fiber;
  }
  
  // Round totals
  const round = (val: number) => Math.round(val * 10) / 10;
  
  const formattedTotals = {
    calories: round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    sugar: round(totals.sugar),
    fiber: round(totals.fiber)
  };
  
  const reply = `Recognized ${items.map(i => `${i.quantity} of ${i.name}`).join(' and ')} via direct rules.`;
  
  return {
    status: 'valid',
    reply,
    items,
    totals: formattedTotals
  };
}
