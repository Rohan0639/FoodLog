import type { GeminiResponse } from '../types';

export async function analyzeFoodServer(foodText: string): Promise<GeminiResponse> {
  const response = await fetch('/api/parse-food', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: foodText })
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `Server returned status: ${response.status}`);
  }

  return response.json();
}
