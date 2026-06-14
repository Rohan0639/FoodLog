import type { GeminiResponse } from '../types';

/**
 * Service function to query the backend Gateway API Proxy.
 * All Gemini prompt logic, validation, rate limiting, and caching reside on the backend.
 */
export async function analyzeFood(text: string): Promise<GeminiResponse> {
  const response = await fetch('/api/analyze-food', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `HTTP error ${response.status}`);
  }

  const data = await response.json();
  return data as GeminiResponse;
}
