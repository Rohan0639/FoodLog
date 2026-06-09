export const UNIT_CATEGORIES = {
  weight: ['g', 'grams', 'gram', 'gms', 'gm', 'kg', 'kilograms', 'kilogram', 'kgs', 'oz', 'ounces', 'ounce', 'lbs', 'pounds', 'pound', 'lb'],
  volume: ['ml', 'milliliters', 'milliliter', 'l', 'liters', 'liter', 'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon', 'teaspoons'],
  count: ['piece', 'pieces', 'item', 'items', 'unit', 'units', 'serving', 'servings']
};

export const UNIT_FACTORS = {
  // Base: g
  weight: {
    g: 1,
    grams: 1,
    gram: 1,
    gms: 1,
    gm: 1,
    kg: 1000,
    kilograms: 1000,
    kilogram: 1000,
    kgs: 1000,
    oz: 28.3495,
    ounces: 28.3495,
    ounce: 28.3495,
    lb: 453.592,
    lbs: 453.592,
    pounds: 453.592,
    pound: 453.592
  },
  // Base: ml
  volume: {
    ml: 1,
    milliliters: 1,
    milliliter: 1,
    l: 1000,
    liters: 1000,
    liter: 1000,
    cup: 240,
    cups: 240,
    tbsp: 15,
    tablespoon: 15,
    tablespoons: 15,
    tsp: 5,
    teaspoon: 5,
    teaspoons: 5
  },
  // Base: piece
  count: {
    piece: 1,
    pieces: 1,
    item: 1,
    items: 1,
    unit: 1,
    units: 1,
    serving: 1,
    servings: 1
  }
};

const DEFAULT_PIECE_WEIGHTS = {
  banana: 120,
  egg: 50,
  apple: 180,
  potato: 150,
  slice: 30,
  bread: 30,
  avocado: 150,
  chicken: 200,
  beef: 250,
  pork: 200,
  orange: 130,
  lemon: 60,
  cookie: 15,
  burger: 200,
  pizza: 100
};

export function getPieceWeight(foodName) {
  const cleanName = String(foodName || '').toLowerCase().trim();
  for (const [key, weight] of Object.entries(DEFAULT_PIECE_WEIGHTS)) {
    if (cleanName.includes(key)) {
      return weight;
    }
  }
  return 100; // Default fallback: 1 piece = 100g
}

export function getUnitCategory(unit) {
  const cleanUnit = String(unit || '').toLowerCase().trim();
  if (UNIT_CATEGORIES.weight.includes(cleanUnit)) return 'weight';
  if (UNIT_CATEGORIES.volume.includes(cleanUnit)) return 'volume';
  return 'count';
}

/**
 * Converts a quantity from one unit to another.
 * @param {number} value - Numeric value to convert
 * @param {string} fromUnit - Original unit
 * @param {string} toUnit - Target unit
 * @param {string} foodName - Name of the food item (used for weight lookup)
 * @returns {number} Converted value
 */
export function convertUnit(value, fromUnit, toUnit, foodName) {
  const cleanFrom = String(fromUnit || '').toLowerCase().trim();
  const cleanTo = String(toUnit || '').toLowerCase().trim();
  
  if (cleanFrom === cleanTo) return value;
  
  const fromCat = getUnitCategory(cleanFrom);
  const toCat = getUnitCategory(cleanTo);
  
  // Get factors to base unit of their categories
  const fromFactor = UNIT_FACTORS[fromCat]?.[cleanFrom] || 1;
  const toFactor = UNIT_FACTORS[toCat]?.[cleanTo] || 1;
  
  // Convert from input to its category's base unit
  const valueInBase = value * fromFactor;
  
  // If categories are the same, just convert to target unit
  if (fromCat === toCat) {
    return valueInBase / toFactor;
  }
  
  // Cross-category conversion
  let valueInTargetBase = 0;
  
  if (fromCat === 'weight' && toCat === 'volume') {
    // Weight (g) to Volume (ml) -> Assume density 1 g/ml
    valueInTargetBase = valueInBase;
  } else if (fromCat === 'volume' && toCat === 'weight') {
    // Volume (ml) to Weight (g) -> Assume density 1 g/ml
    valueInTargetBase = valueInBase;
  } else if (fromCat === 'count' && toCat === 'weight') {
    // Count (piece) to Weight (g) -> Look up piece weight
    const pieceWeight = getPieceWeight(foodName);
    valueInTargetBase = valueInBase * pieceWeight;
  } else if (fromCat === 'weight' && toCat === 'count') {
    // Weight (g) to Count (piece)
    const pieceWeight = getPieceWeight(foodName);
    valueInTargetBase = valueInBase / pieceWeight;
  } else if (fromCat === 'count' && toCat === 'volume') {
    // Count (piece) to Volume (ml) -> Count -> Weight -> Volume
    const pieceWeight = getPieceWeight(foodName);
    const weightG = valueInBase * pieceWeight;
    valueInTargetBase = weightG; // 1g = 1ml
  } else if (fromCat === 'volume' && toCat === 'count') {
    // Volume (ml) to Count (piece) -> Volume -> Weight -> Count
    const weightG = valueInBase; // 1ml = 1g
    const pieceWeight = getPieceWeight(foodName);
    valueInTargetBase = weightG / pieceWeight;
  }
  
  return valueInTargetBase / toFactor;
}
