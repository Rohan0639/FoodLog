/**
 * Fixed-window rate limiting for the public parsing endpoint.
 *
 * The endpoint has no authentication — it cannot have any, because the app has
 * no accounts — so the only thing standing between a discovered URL and a spent
 * Gemini quota is this.
 *
 * IMPORTANT LIMITATION: state lives in the memory of one serverless instance.
 * A platform running several instances enforces the limit per instance, and a
 * cold start resets it. That makes this a guard against casual abuse and
 * runaway clients, not against a determined attacker. A distributed limiter
 * (Upstash, Vercel KV) is the upgrade path if this ever needs to be real.
 */

interface Window {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 30;
/** Stops the map growing without bound on a long-lived warm instance. */
const MAX_TRACKED_CLIENTS = 5000;

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets — sent as Retry-After when blocked. */
  retryAfter: number;
  limit: number;
}

/** Best-effort client identity from the proxy headers Vercel sets. */
export function clientKey(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = raw?.split(',')[0]?.trim() || (headers['x-real-ip'] as string) || 'unknown';
  return ip;
}

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export function check(key: string, now: number = Date.now()): RateLimitResult {
  // Expired windows are cleared lazily, and only once the map is large enough
  // to be worth the pass.
  if (windows.size > MAX_TRACKED_CLIENTS) sweep(now);

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      retryAfter: 0,
      limit: MAX_REQUESTS_PER_WINDOW,
    };
  }

  existing.count++;
  const allowed = existing.count <= MAX_REQUESTS_PER_WINDOW;

  return {
    allowed,
    remaining: Math.max(0, MAX_REQUESTS_PER_WINDOW - existing.count),
    retryAfter: allowed ? 0 : Math.ceil((existing.resetAt - now) / 1000),
    limit: MAX_REQUESTS_PER_WINDOW,
  };
}

/** Test seam. */
export function reset(): void {
  windows.clear();
}
