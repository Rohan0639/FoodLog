import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleAnalyzeFood } from '../backend/api/analyzeFoodController';

/**
 * Vercel Serverless Function entry point.
 * Delegates execution to the backend controller layer.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return handleAnalyzeFood(req, res);
}
