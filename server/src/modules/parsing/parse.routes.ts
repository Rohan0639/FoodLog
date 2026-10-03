import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Database } from '../../db/client';
import { sendError } from '../../middleware/errors';
import { requireAuth } from '../../middleware/auth';
import { callGemini } from '../../../../backend/services/gemini';
import { parseWithLabel } from '../../../../backend/services/labelReader';
import { log } from '../../utils/logger';
import { parseMeal, type AiParser, type ParsedFood } from './foodParsing';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
const MAX_IMAGE_BASE64 = 6 * 1024 * 1024;

const parseSchema = z.object({
  text: z.string().trim().min(1, 'Describe what you ate').max(500),
  image: z.string().max(MAX_IMAGE_BASE64).optional(),
  mimeType: z.string().optional(),
});

/** Reads "2 piece", "200 g", "1 serving" into a number and a unit. */
function splitQuantity(quantity: string): { quantity: number; unit: string } {
  const match = quantity.trim().match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  return {
    quantity: match ? parseFloat(match[1]) : 1,
    unit: (match?.[2] || 'piece').trim(),
  };
}

/**
 * The production AI parser: Gemini via the existing client. Its output has already
 * passed the nutrition validator inside callGemini, so it is only reshaped here.
 */
export const geminiParser: AiParser = async (text) => {
  const response = await callGemini(text);
  if (response.status !== 'valid' || !response.items) return [];
  return response.items.map((item) => {
    const { quantity, unit } = splitQuantity(item.quantity);
    return {
      name: item.name,
      quantity,
      unit,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      sugar: item.sugar,
      fiber: item.fiber,
    };
  });
};

/** The item shape the frontend's review table already uses. */
function toClientItem(food: ParsedFood) {
  return {
    name: food.name,
    quantity: `${food.quantity} ${food.unit}`,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    sugar: food.sugar,
    fiber: food.fiber,
    source: food.source,
    baseFoodName: food.name,
    baseUnit: food.unit,
    baseQty: food.quantity,
  };
}

function totalsOf(items: ParsedFood[]) {
  const sum = (pick: (item: ParsedFood) => number) =>
    Math.round(items.reduce((acc, item) => acc + pick(item), 0) * 10) / 10;
  return {
    calories: Math.round(sum((i) => i.calories)),
    protein: sum((i) => i.protein),
    carbs: sum((i) => i.carbs),
    fat: sum((i) => i.fat),
    sugar: sum((i) => i.sugar),
    fiber: sum((i) => i.fiber),
  };
}

export function parseRouter(deps: { db: Database; jwtSecret: string; ai?: AiParser }): Router {
  const router = Router();
  const ai = deps.ai ?? geminiParser;

  router.post('/parse-food', requireAuth(deps.jwtSecret), async (req: Request, res: Response) => {
    const parsed = parseSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, 422, 'VALIDATION_ERROR', parsed.error.issues[0].message);
      return;
    }
    const { text, image, mimeType } = parsed.data;

    try {
      // A nutrition label is stronger evidence than the saved foods, so it skips them.
      if (image) {
        if (!mimeType || !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
          sendError(res, 422, 'VALIDATION_ERROR', 'Unsupported image type.');
          return;
        }
        const labelled = await parseWithLabel(text, image, mimeType);
        res.json({
          success: true,
          data: {
            ...labelled,
            items: (labelled.items ?? []).map((item) => ({ ...item, source: 'label' })),
          },
        });
        return;
      }

      const foods = await parseMeal(deps.db, req.userId, text, ai);
      if (foods.length === 0) {
        res.json({ success: true, data: { status: 'invalid', reason: 'Input is not a valid food item' } });
        return;
      }
      const items = foods.map(toClientItem);
      res.json({
        success: true,
        data: {
          status: 'valid',
          reply: `Recognised ${items.map((i) => `${i.quantity} of ${i.name}`).join(' and ')}.`,
          items,
          totals: totalsOf(foods),
        },
      });
    } catch (err) {
      // The AI service or database failed. Say so, without the cause.
      log('error', 'food parse failed', {
        requestId: res.locals.requestId,
        errorName: err instanceof Error ? err.name : 'UnknownError',
      });
      sendError(res, 503, 'PARSER_UNAVAILABLE', 'The food parser is unavailable right now. Try again shortly.');
    }
  });

  return router;
}
