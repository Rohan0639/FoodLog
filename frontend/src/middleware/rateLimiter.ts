/**
 * Rate Limiter utility using a Token Bucket algorithm.
 * Limits the client to 10 requests per minute (refills 1 token every 6 seconds, max capacity 10 tokens).
 * Resets on page reload, which is perfectly safe for UX-level limiting.
 */
class TokenBucket {
  private capacity: number;
  private refillRate: number; // tokens per millisecond
  private tokens: number;
  private lastRefillTime: number;

  constructor(capacity: number, refillRatePerMin: number) {
    this.capacity = capacity;
    this.refillRate = refillRatePerMin / (60 * 1000); // convert per minute to per millisecond
    this.tokens = capacity;
    this.lastRefillTime = Date.now();
  }

  /**
   * Attempts to consume 1 token.
   * Returns an object indicating success and retry wait time if limited.
   */
  consume(): { allowed: boolean; retryAfterMs: number } {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, retryAfterMs: 0 };
    }

    // Calculate time until at least 1 token is refilled
    const tokensNeeded = 1 - this.tokens;
    const retryAfterMs = Math.ceil(tokensNeeded / this.refillRate);

    return { allowed: false, retryAfterMs };
  }

  private refill() {
    const now = Date.now();
    const elapsedTime = now - this.lastRefillTime;
    
    if (elapsedTime <= 0) return;

    const refillAmount = elapsedTime * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + refillAmount);
    this.lastRefillTime = now;
  }
}

// Instantiate rate limiter instance for the current session: 10 requests/min capacity
export const globalRateLimiter = new TokenBucket(10, 10);

/**
 * Custom error class for rate limit exceptions.
 */
export class RateLimitError extends Error {
  public retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}
