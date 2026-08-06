import { GeminiResponse } from '../../shared/types';
import { normalizeFoodInput } from '../../shared/normalize';
import { GEMINI_CONFIG } from '../../config';

/**
 * Parses a meal description together with a photo of the product's nutrition
 * label.
 *
 * The label is supporting evidence, not a separate workflow: the user's words
 * still decide *what* and *how much*, while the panel supplies the figures that
 * would otherwise be estimated. That division matters — "3 slices of bread"
 * cannot be read off a label, and 132 kcal per 2 slices cannot be guessed from
 * the sentence.
 *
 * Returns the same shape as a text-only parse, so the review table, confirm
 * step, scaling and logging are all completely unchanged downstream.
 */

const REQUEST_TIMEOUT_MS = 30000; // vision is slower than text
const MAX_ATTEMPTS = 2;

export interface LabelParseResult extends GeminiResponse {
  /** False when the photo could not be read; the caller then falls back. */
  labelRead: boolean;
  labelNote?: string;
}

const PROMPT = `You are logging a meal. You are given what the user says they ate,
and a photograph of the nutrition label from that product.

## DIVISION OF EVIDENCE — this is the important part

From the USER'S TEXT, take:
  - the food name
  - how much they ate (quantity and unit)

From the LABEL PHOTO, take:
  - every nutrition figure

NEVER estimate a nutrition figure that the label shows. NEVER let a typical
value for this kind of food override what is printed. The label wins.

## READING THE LABEL

Find the serving the panel's figures refer to — "per 2 slices", "per 100g",
"per serving (30g)". Then scale those figures to the amount the USER ate.

Example:
  user says     "I ate 3 slices of brown bread"
  label says    "per 2 slices: 132 kcal, 5g protein"
  you return    quantity "3 slices", calories 198, protein 7.5
                (because 3/2 x the panel figures)

Energy printed in kJ converts to kcal by dividing by 4.184.

## IF THE LABEL IS UNREADABLE

If the image is blurred, cropped, not a nutrition panel, or you cannot read the
figures with confidence, DO NOT GUESS. Respond only with:
{"status":"label_unreadable"}

## OUTPUT

Respond ONLY with JSON:
{
  "status": "valid",
  "reply": "a short friendly confirmation mentioning you used the label",
  "items": [
    {
      "name": "food name, from the user's words, including brand if stated",
      "quantity": "what the user ate, e.g. '3 slices'",
      "calories": number,   // total for what they ate
      "protein": number, "carbs": number, "fat": number,
      "sugar": number, "fiber": number,
      "baseFoodName": "normalised name, lowercase",
      "brand": "brand from the label, or null",
      "baseUnit": "the unit the label's own figures use: slice, grams, ml, piece, serving",
      "baseQty": number,          // the label's serving size, e.g. 2
      "caloriesPerUnit": number,  // label figures divided down to ONE baseUnit
      "proteinPerUnit": number, "carbsPerUnit": number, "fatPerUnit": number,
      "sugarPerUnit": number, "fiberPerUnit": number,
      "aliases": ["other names the user might type for this"]
    }
  ],
  "totals": { "calories": number, "protein": number, "carbs": number,
              "fat": number, "sugar": number, "fiber": number }
}

If the user mentions foods the label does not cover, include them too, using
your own knowledge for those items only.`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(url: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

const num = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value ?? 0));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/**
 * Sanity-checks the figures before they are trusted.
 *
 * Looser than the text-only validator, because a real label can legitimately
 * look extreme — an oil is ~900 kcal/100g, an isolate is nearly all protein.
 * This only rejects readings that are physically impossible.
 */
function isImplausible(items: any[]): string | null {
  for (const item of items) {
    const grams = String(item?.quantity ?? '').match(/^(\d+(?:\.\d+)?)\s*(g|grams?|ml)\b/i);
    if (!grams) continue;

    const weight = parseFloat(grams[1]);
    if (weight <= 0) continue;

    if (num(item.calories) > weight * 9.5) {
      return `${item.name}: ${item.calories} kcal is impossible for ${weight}g.`;
    }
    if (num(item.protein) + num(item.carbs) + num(item.fat) > weight * 1.1) {
      return `${item.name}: the macros exceed the stated weight.`;
    }
  }
  return null;
}

export async function parseWithLabel(
  text: string,
  imageBase64: string,
  mimeType: string
): Promise<LabelParseResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing Gemini API Key in server environment variables!');
  }

  const url = `${GEMINI_CONFIG.API_URL}?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [
      {
        parts: [
          { text: PROMPT },
          { text: `\n\nThe user said: "${normalizeFoodInput(text).replace(/"/g, '\\"')}"` },
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
        ],
      },
    ],
    // Zero temperature: reading printed digits is not a creative task.
    generationConfig: { responseMimeType: 'application/json', temperature: 0 },
  });

  let lastError: Error | null = null;

  for (let n = 1; n <= MAX_ATTEMPTS; n++) {
    try {
      const response = await attempt(url, body);

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        lastError = new Error(`Gemini returned ${response.status}: ${detail || response.statusText}`);
        if (response.status < 500 && response.status !== 429) throw lastError;
        if (n === MAX_ATTEMPTS) throw lastError;
        await sleep(700);
        continue;
      }

      const data = (await response.json()) as any;
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!raw) throw new Error('Gemini returned an empty response.');

      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) throw new SyntaxError('No JSON object in the response.');

      const parsed = JSON.parse(raw.slice(start, end + 1));

      // The model was told to say so rather than invent figures.
      if (parsed.status === 'label_unreadable') {
        return { status: 'invalid', labelRead: false, labelNote: 'unreadable' };
      }

      if (parsed.status !== 'valid' || !Array.isArray(parsed.items) || parsed.items.length === 0) {
        return { status: 'invalid', labelRead: false, labelNote: 'no-items' };
      }

      const implausible = isImplausible(parsed.items);
      if (implausible) {
        console.warn('[Label] rejected implausible reading:', implausible);
        return { status: 'invalid', labelRead: false, labelNote: 'implausible' };
      }

      return { ...(parsed as GeminiResponse), labelRead: true };
    } catch (err) {
      const error = err as Error;
      lastError = error.name === 'AbortError'
        ? new Error(`Reading the label timed out after ${REQUEST_TIMEOUT_MS / 1000}s`)
        : error;
      if (n === MAX_ATTEMPTS) throw lastError;
      await sleep(700);
    }
  }

  throw lastError ?? new Error('Could not read the label.');
}
