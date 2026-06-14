import { analyzeFoodClient, type GeminiResponse } from './geminiParser';
import { globalRateLimiter, RateLimitError } from '../middleware/rateLimiter';
import { responseCache } from './responseCache';
import { apiLogger } from '../middleware/apiLogger';

/**
 * Proxy function to call the serverless API.
 * If the API is offline, returns an error, or is not configured locally,
 * it falls back to the client-side direct Gemini call (analyzeFoodClient).
 * Uses in-memory responseCache to avoid redundant API queries.
 */
export async function analyzeFood(text: string): Promise<GeminiResponse> {
  // 1. Check in-memory cache first (hits bypass rate limiter)
  const cachedData = responseCache.get(text);
  if (cachedData) {
    apiLogger.info(`Cache hit for query: "${text}"`);
    return cachedData;
  }

  // 2. Consume rate limit token for live API requests
  const limitCheck = globalRateLimiter.consume();
  if (!limitCheck.allowed) {
    apiLogger.warn(`Rate limit triggered for user session. Delaying request for: "${text}"`);
    throw new RateLimitError('Rate limit exceeded', limitCheck.retryAfterMs);
  }

  apiLogger.info(`Sending live parse request for: "${text}"`);
  const startTime = Date.now();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 second timeout

  try {
    const response = await fetch('/api/analyze-food', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error || `HTTP error ${response.status}`);
    }

    const data = await response.json();

    // Validate the basic structure of the response
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid response structure from proxy');
    }

    // Cache the successful response
    responseCache.set(text, data);

    const duration = Date.now() - startTime;
    apiLogger.info(`Successfully parsed via proxy in ${duration}ms:`, data);

    return data as GeminiResponse;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'RateLimitError') {
      throw error;
    }
    apiLogger.warn(`[Proxy] Failed to query proxy, falling back to direct client-side call. Reason: ${error.message}`);

    // Fallback to direct client call using client-side API key
    const fallbackData = await analyzeFoodClient(text);

    // Cache the fallback response if successful
    responseCache.set(text, fallbackData);

    const duration = Date.now() - startTime;
    apiLogger.info(`Successfully parsed via direct client fallback in ${duration}ms:`, fallbackData);

    return fallbackData;
  }
}
