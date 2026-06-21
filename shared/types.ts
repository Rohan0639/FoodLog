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
