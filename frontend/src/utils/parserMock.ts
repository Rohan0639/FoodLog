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

export function parseFoodMessage(_text: string): FoodItem[] {
  // Offline macro calculations are completely disabled to ensure only valid, Gemini-verified data is logged.
  return [];
}
  


