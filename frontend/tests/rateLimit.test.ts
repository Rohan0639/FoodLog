import { describe, it, expect, beforeEach } from 'vitest';
import { check, clientKey, reset } from '../../backend/utils/rateLimit';

/**
 * The only thing between a discovered URL and a spent Gemini quota, since the
 * endpoint cannot be authenticated.
 */
beforeEach(() => reset());

describe('clientKey', () => {
  it('reads the first hop of x-forwarded-for', () => {
    expect(clientKey({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip, then to a constant', () => {
    expect(clientKey({ 'x-real-ip': '9.9.9.9' })).toBe('9.9.9.9');
    expect(clientKey({})).toBe('unknown');
  });

  it('handles a header delivered as an array', () => {
    expect(clientKey({ 'x-forwarded-for': ['1.1.1.1', '2.2.2.2'] })).toBe('1.1.1.1');
  });
});

describe('windowing', () => {
  it('allows up to the limit', () => {
    for (let i = 0; i < 30; i++) {
      expect(check('ip', 1000).allowed, `request ${i + 1}`).toBe(true);
    }
  });

  it('blocks the request after the limit', () => {
    for (let i = 0; i < 30; i++) check('ip', 1000);
    const blocked = check('ip', 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it('counts down the remaining allowance', () => {
    expect(check('ip', 1000).remaining).toBe(29);
    expect(check('ip', 1000).remaining).toBe(28);
  });

  it('opens a fresh window once the old one expires', () => {
    for (let i = 0; i < 31; i++) check('ip', 1000);
    expect(check('ip', 1000).allowed).toBe(false);
    // 60s later
    expect(check('ip', 62_000).allowed).toBe(true);
  });

  it('tracks clients independently', () => {
    for (let i = 0; i < 31; i++) check('noisy', 1000);
    expect(check('noisy', 1000).allowed).toBe(false);
    expect(check('quiet', 1000).allowed).toBe(true);
  });
});
