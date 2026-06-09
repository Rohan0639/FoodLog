export interface FoodItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number; // in grams
  carbs: number;   // in grams
  fat: number;     // in grams
  loggedAt: Date;
}

export interface ParsedItem {
  name: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ParsedTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface ParsedData {
  reply: string;
  items: ParsedItem[];
  totals: ParsedTotals;
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
  timestamp: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: Date;
  isTyping?: boolean;
  parsedFoods?: FoodItem[];
}

export interface NutritionSummary {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DailyGoal {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

