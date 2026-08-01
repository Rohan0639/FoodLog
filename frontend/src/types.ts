export interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  fiber: number;
  createdAt: string;
  baseQuantity?: number;
  baseUnit?: string;
  brand?: string | null;
}

export interface FoodEntry {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  sugar: number;
  fiber: number;
  createdAt: string;
  baseQuantity?: number;
  baseUnit?: string;
  baseFoodName?: string;
  brand?: string | null;
  caloriesPerUnit?: number;
  proteinPerUnit?: number;
  carbsPerUnit?: number;
  fatPerUnit?: number;
  sugarPerUnit?: number;
  fiberPerUnit?: number;
  aliases?: string[];
}

export interface ParsedItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
  baseFoodName?: string;
  baseName?: string;
  brand?: string | null;
  baseUnit?: string;
  baseQty?: number;
  caloriesPerUnit?: number;
  proteinPerUnit?: number;
  carbsPerUnit?: number;
  fatPerUnit?: number;
  sugarPerUnit?: number;
  fiberPerUnit?: number;
  aliases?: string[];
}

export interface ParsedTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
}

export interface GeminiResponse {
  status: 'valid' | 'invalid';
  reason?: string;
  reply?: string;
  items?: ParsedItem[];
  totals?: ParsedTotals;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isTyping?: boolean;
  parsedFoods?: FoodItem[];
  pendingFoods?: FoodEntry[];
  isConfirmed?: boolean;
  isDiscarded?: boolean;
}

export interface NutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
}

export interface DailyGoal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
}

