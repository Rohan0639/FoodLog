/**
 * Food words the app recognises as real.
 *
 * This exists for one job: telling a misspelling apart from a different food.
 *
 * Approximate matching cannot make that distinction on letters alone. "gss" is
 * not a word, so reading it as "eggs" is a helpful correction. "pear" *is* a
 * word, so reading it as "peas" is a wrong meal in someone's diary — even
 * though both are two edits away from their target. The deciding factor is
 * whether the typed word means something, which is a vocabulary question, not
 * a spelling-distance one.
 *
 * This is the same rule a spell-checker follows: never autocorrect a word that
 * is already in the dictionary.
 *
 * The list is deliberately a heuristic, not an ontology. It does not need to be
 * exhaustive — an unlisted food simply falls through to the parser, which has
 * real semantic understanding. Its only job is to protect the common words
 * people actually type.
 *
 * Entries are singular stems, matching what `foodKey` produces.
 */

const WORDS = [
  // ── Meat, poultry, fish ────────────────────────────────────────────────
  'chicken', 'beef', 'pork', 'lamb', 'mutton', 'turkey', 'duck', 'bacon',
  'ham', 'sausage', 'salami', 'steak', 'mince', 'meat', 'veal', 'venison',
  'fish', 'salmon', 'tuna', 'cod', 'prawn', 'shrimp', 'crab', 'lobster',
  'squid', 'sardine', 'mackerel', 'anchovy', 'trout', 'herring',

  // ── Eggs & dairy ───────────────────────────────────────────────────────
  'egg', 'omelette', 'milk', 'cheese', 'butter', 'ghee', 'cream', 'yoghurt',
  'yogurt', 'curd', 'paneer', 'custard', 'kefir', 'mozzarella', 'cheddar',
  'feta', 'ricotta', 'parmesan',

  // ── Grains, bread, pasta ───────────────────────────────────────────────
  'rice', 'bread', 'roti', 'chapati', 'naan', 'paratha', 'toast', 'bun',
  'bagel', 'croissant', 'pasta', 'noodle', 'spaghetti', 'macaroni', 'penne',
  'oat', 'oatmeal', 'porridge', 'cereal', 'muesli', 'granola', 'quinoa',
  'barley', 'millet', 'couscous', 'wheat', 'flour', 'corn', 'maize', 'poha',
  'idli', 'dosa', 'upma', 'tortilla', 'cracker', 'biscuit', 'wrap', 'pita',

  // ── Legumes, nuts, seeds ───────────────────────────────────────────────
  'bean', 'lentil', 'dal', 'chickpea', 'pea', 'peanut', 'almond', 'cashew',
  'walnut', 'pistachio', 'hazelnut', 'pecan', 'nut', 'seed', 'sesame',
  'flaxseed', 'sunflower', 'pumpkin', 'soy', 'tofu', 'tempeh', 'hummus',
  'rajma', 'chana',

  // ── Vegetables ─────────────────────────────────────────────────────────
  'potato', 'tomato', 'onion', 'garlic', 'carrot', 'cabbage', 'lettuce',
  'spinach', 'kale', 'broccoli', 'cauliflower', 'pepper', 'capsicum',
  'cucumber', 'zucchini', 'courgette', 'eggplant', 'brinjal', 'aubergine',
  'mushroom', 'celery', 'beetroot', 'radish', 'turnip', 'pumpkin', 'squash',
  'okra', 'bhindi', 'peas', 'sweetcorn', 'asparagus', 'leek', 'salad',
  'vegetable', 'veg',

  // ── Fruit ──────────────────────────────────────────────────────────────
  'apple', 'banana', 'orange', 'mango', 'grape', 'pear', 'peach', 'plum',
  'cherry', 'strawberry', 'blueberry', 'raspberry', 'blackberry', 'melon',
  'watermelon', 'pineapple', 'papaya', 'guava', 'kiwi', 'lemon', 'lime',
  'coconut', 'date', 'fig', 'apricot', 'pomegranate', 'avocado', 'berry',
  'fruit', 'raisin', 'prune',

  // ── Prepared dishes ────────────────────────────────────────────────────
  'pizza', 'burger', 'sandwich', 'soup', 'stew', 'curry', 'biryani',
  'pulao', 'fry', 'roll', 'taco', 'burrito', 'sushi', 'dumpling', 'momo',
  'samosa', 'pakora', 'kebab', 'tikka', 'chowmein', 'pasta', 'lasagne',
  'risotto', 'casserole', 'pie', 'quiche',

  // ── Sweets & snacks ────────────────────────────────────────────────────
  'cake', 'cookie', 'brownie', 'donut', 'doughnut', 'chocolate', 'candy',
  'sweet', 'icecream', 'pudding', 'jam', 'honey', 'sugar', 'syrup',
  'chip', 'crisp', 'popcorn', 'pretzel', 'wafer', 'halwa', 'ladoo', 'jalebi',
  'barfi', 'gulab',

  // ── Drinks ─────────────────────────────────────────────────────────────
  'water', 'tea', 'coffee', 'juice', 'smoothie', 'shake', 'milkshake',
  'soda', 'cola', 'lemonade', 'beer', 'wine', 'whisky', 'vodka', 'rum',
  'lassi', 'buttermilk', 'drink',

  // ── Fats, condiments, other ────────────────────────────────────────────
  'oil', 'olive', 'mayonnaise', 'ketchup', 'mustard', 'vinegar', 'sauce',
  'dressing', 'gravy', 'pickle', 'chutney', 'salt', 'spice', 'protein',
  'whey', 'supplement', 'bar', 'powder', 'shakes',
];

const VOCABULARY = new Set(WORDS);

/**
 * Whether this word is a food the app recognises.
 *
 * A `true` means "the user typed something real" — so it must not be quietly
 * rewritten into a different food, however similar the letters look.
 */
export function isKnownFood(word: string): boolean {
  return VOCABULARY.has(word);
}

/**
 * Whether a phrase names a real food outright.
 *
 * Multi-word phrases count when every word is recognised, so "olive oil" is
 * protected but "britannia bred" (a typo) is not.
 */
export function isKnownFoodPhrase(phrase: string): boolean {
  const words = phrase.split(' ').filter(Boolean);
  return words.length > 0 && words.every(isKnownFood);
}

/** Exposed for tests and diagnostics. */
export const vocabularySize = VOCABULARY.size;
