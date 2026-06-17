export function normalizeFoodInput(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/\bgms\b/gi, 'grams')
    .replace(/\bgm\b/gi, 'grams')
    .replace(/\bg\b/gi, 'grams')
    .replace(/\bml\b/gi, 'ml')
    .replace(/\bl\b/gi, 'liters');
}
