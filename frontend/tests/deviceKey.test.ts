import { describe, it, expect, beforeEach } from 'vitest';
import { adoptKey, hasKey, lockVault, sealJson, openJson, isEnvelope } from '../src/lib/security/vault';

/** Same kind of key the browser creates for the device: AES-GCM, not extractable. */
async function deviceLikeKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

beforeEach(() => {
  lockVault();
});

describe('device key (no passphrase)', () => {
  it('seals and opens data once the key is adopted', async () => {
    adoptKey(await deviceLikeKey());
    expect(hasKey()).toBe(true);

    const sealed = await sealJson({ meal: 'two eggs' });
    expect(isEnvelope(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain('two eggs');
    expect(await openJson(sealed)).toEqual({ meal: 'two eggs' });
  });

  it('cannot open data sealed under a different device key', async () => {
    adoptKey(await deviceLikeKey());
    const sealed = await sealJson({ secret: 1 });

    adoptKey(await deviceLikeKey());
    await expect(openJson(sealed)).rejects.toThrow();
  });

  it('keeps the raw key out of reach of script', async () => {
    const key = await deviceLikeKey();
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });
});
