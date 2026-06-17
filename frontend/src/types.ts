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
  isOffline?: boolean;
  isOfflineUpdated?: boolean;
  baseQuantity?: number;
  baseUnit?: string;
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
}

export interface ParsedTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar: number;
  fiber: number;
}

export interface ParsedData {
  reply: string;
  items: ParsedItem[];
  totals: ParsedTotals;
}

export interface GeminiResponse {
  status: 'valid' | 'invalid';
  reason?: string;
  reply?: string;
  items?: ParsedItem[];
  totals?: ParsedTotals;
}

export interface FoodLog {
  _id: string;
  userId: string;
  foodText: string;
  parsedData: ParsedData;
  createdAt: string;
  updatedAt: string;
  isOffline?: boolean;
  isOfflineUpdated?: boolean;
}

export interface OfflineAction {
  type: 'ADD' | 'EDIT' | 'DELETE';
  id?: string;
  tempId?: string;
  text?: string;
  entry?: FoodEntry;
  parsedEntries?: FoodEntry[];
  timestamp: string;
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

