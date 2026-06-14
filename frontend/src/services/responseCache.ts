import type { GeminiResponse } from './geminiParser';

interface CacheEntry {
  response: GeminiResponse;
  expiresAt: number;
}

/**
 * In-memory read-through cache for Gemini API response validation.
 * Caches 'valid' food parsing results for 5 minutes.
 */
class ResponseCache {
  private cache = new Map<string, CacheEntry>();
  private ttl: number; // in milliseconds

  constructor(ttlMinutes: number = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  /**
   * Helper to normalize keys to prevent duplicate keys for small spacing/casing variations
   */
  private normalizeKey(text: string): string {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  /**
   * Retrieves an item from the cache if it exists and hasn't expired.
   */
  get(text: string): GeminiResponse | null {
    try {
      const key = this.normalizeKey(text);
      const entry = this.cache.get(key);

      if (!entry) return null;

      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        return null;
      }

      return entry.response;
    } catch (e) {
      console.warn('[Cache] Error reading from cache:', e);
      return null;
    }
  }

  /**
   * Stores a response in the cache with the configured TTL.
   * Only caches 'valid' responses.
   */
  set(text: string, response: GeminiResponse): void {
    try {
      if (response.status !== 'valid') return; // Do not cache invalid/failed results

      const key = this.normalizeKey(text);
      this.cache.set(key, {
        response,
        expiresAt: Date.now() + this.ttl,
      });

      this.clearExpired();
    } catch (e) {
      console.warn('[Cache] Error writing to cache:', e);
    }
  }

  /**
   * Cleans up expired cache items to prevent memory bloat
   */
  private clearExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
}

export const responseCache = new ResponseCache(5); // 5-minute cache
