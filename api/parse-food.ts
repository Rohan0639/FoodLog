import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCache, setCache } from '../backend/services/cache';
import { parseFoodOrchestrator } from '../backend/parsers';
import { normalizeFoodInput } from '../shared/normalize';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST is supported.' });
  }

  try {
    // Parse body safely
    let text = '';
    if (typeof req.body === 'string') {
      const parsedBody = JSON.parse(req.body);
      text = parsedBody.text;
    } else if (req.body && typeof req.body === 'object') {
      text = req.body.text;
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Bad Request. Missing or empty "text" parameter in request body.' });
    }

    const normalizedText = normalizeFoodInput(text);

    // 1. Check in-memory cache
    const cachedResult = getCache(normalizedText);
    if (cachedResult) {
      console.log(`[Cache Hit] key: "${normalizedText}"`);
      return res.status(200).json(cachedResult);
    }

    // 2. Parse food via orchestrator (rules-based first, falling back to Gemini)
    const parseResult = await parseFoodOrchestrator(normalizedText);

    // 3. Save to cache
    setCache(normalizedText, parseResult);

    return res.status(200).json(parseResult);
  } catch (error: any) {
    console.error('[API Error]', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}
