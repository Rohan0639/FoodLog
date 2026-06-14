import { analyzeFood } from '../services/geminiService';
import { apiLogger } from '../middleware/apiLogger';

interface MockResponse {
  status: (code: number) => MockResponse;
  json: (data: any) => void;
}

/**
 * Controller handler for parsing food query requests.
 * Invokes the Gemini parsing service and formats HTTP responses.
 */
export async function handleAnalyzeFood(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method Not Allowed' });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid text field' });
  }

  try {
    const parsedData = await analyzeFood(text);
    return res.status(200).json(parsedData);
  } catch (error: any) {
    if (error.name === 'RateLimitError') {
      res.setHeader('Retry-After', String(Math.ceil(error.retryAfterMs / 1000)));
      return res.status(429).json({
        error: 'Too Many Requests',
        retryAfterMs: error.retryAfterMs
      });
    }

    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Gateway Timeout: Gemini API request timed out' });
    }

    apiLogger.error(`[Controller Error] Failed for query: "${text}". Details: ${error.message}`);
    return res.status(500).json({ error: `Internal Server Error: ${error.message}` });
  }
}
