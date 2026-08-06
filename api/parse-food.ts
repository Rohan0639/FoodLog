import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getCache, setCache } from '../backend/services/cache';
import { parseFoodOrchestrator } from '../backend/parsers';
import { normalizeFoodInput } from '../shared/normalize';
import { check as checkRateLimit, clientKey } from '../backend/utils/rateLimit';
import { parseWithLabel } from '../backend/services/labelReader';

/** Roughly a 1600px JPEG. The client downscales before sending. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
/** Image requests cost far more than text, so they get a tighter allowance. */
const IMAGE_LIMIT_PER_WINDOW = 8;

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

  // This endpoint spends money on every miss and has no authentication, so a
  // discovered URL must not be able to drain the quota unattended.
  const limit = checkRateLimit(clientKey(req.headers));
  res.setHeader('X-RateLimit-Limit', String(limit.limit));
  res.setHeader('X-RateLimit-Remaining', String(limit.remaining));

  if (!limit.allowed) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit reached. Try again in ${limit.retryAfter}s.`,
    });
  }

  try {
    // Parse body safely
    let text = '';
    let image: string | undefined;
    let mimeType: string | undefined;

    const readBody = (body: any) => {
      text = body?.text;
      image = typeof body?.image === 'string' ? body.image : undefined;
      mimeType = typeof body?.mimeType === 'string' ? body.mimeType : undefined;
    };

    if (typeof req.body === 'string') readBody(JSON.parse(req.body));
    else if (req.body && typeof req.body === 'object') readBody(req.body);

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Bad Request. Missing or empty "text" parameter in request body.' });
    }

    /*
     * A nutrition label was attached.
     *
     * The panel is better evidence than anything cached or inferred, so this
     * path deliberately bypasses the cache and the rules parser and goes
     * straight to a combined text+image read. It also never writes to the
     * cache: that is keyed on the text alone, which would not capture the
     * image's contribution and could serve label-accurate figures to a later
     * request that had no label.
     */
    if (image) {
      if (!mimeType || !ALLOWED_IMAGE_TYPES.includes(mimeType)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unsupported image type. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}.`,
        });
      }

      // base64 inflates by ~4/3; check the decoded size.
      if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) {
        return res.status(413).json({
          error: 'Payload Too Large',
          message: 'That photo is too large. Try again — the app resizes images before sending.',
        });
      }

      const imageUsage = limit.limit - limit.remaining;
      if (imageUsage > IMAGE_LIMIT_PER_WINDOW) {
        res.setHeader('Retry-After', String(limit.retryAfter || 60));
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Too many photos in a short time. Please wait a minute.',
        });
      }

      const result = await parseWithLabel(text, image, mimeType);
      return res.status(200).json(result);
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
