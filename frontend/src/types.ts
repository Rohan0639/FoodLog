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
  source?: 'dictionary' | 'ai';
  matchConfidence?: number;
  matchStage?: 'exact' | 'fuzzy';
  /** Raw text the user typed for this item; learned as an alias on confirm. */
  sourceText?: string;
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
  /** Where this item came from — drives the review-table badge. */
  source?: 'dictionary' | 'ai';
  /** 0..1 for a fuzzy dictionary guess; 1 for an exact hit. */
  matchConfidence?: number;
  matchStage?: 'exact' | 'fuzzy';
  /**
   * The exact fragment the user typed for this item. Learned as an alias on
   * confirm, which is how a mistyped spelling becomes an exact hit next time.
   */
  sourceText?: string;
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

