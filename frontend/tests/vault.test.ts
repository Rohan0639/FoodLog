import { describe, it, expect, beforeEach } from 'vitest';
import { resetStore } from './setup';
import { __setIterations } from '../src/lib/security/crypto';
import {
  createVault, unlockVault, lockVault, isUnlocked, hasVault, sealJson, openJson, isEnvelope,
} from '../src/lib/security/vault';
import { DB_KEY } from '../src/lib/storage/schema';
import { writeDb, readDb, invalidate, loadStoredDb, isLocked, flushPersist } from '../src/lib/storage/localDb';
import { createEmptyDb } from '../src/lib/storage/schema';

const PASS = 'correct horse battery';

beforeEach(async () => {
  __setIterations(1000); // fast in tests; production uses 600k
  await flushPersist();
  resetStore();
  lockVault();
  invalidate();
});

describe('vault', () => {
  it('round-trips a value through seal and open', async () => {
    await createVault(PASS);
    const sealed = await sealJson({ hello: 'world' });
    expect(isEnvelope(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain('hello');
    expect(await openJson(sealed)).toEqual({ hello: 'world' });
  });

  it('rejects a wrong passphrase on unlock', async () => {
    await createVault(PASS);
    lockVault();
    await expect(unlockVault('wrong passphrase')).rejects.toThrow('not right');
    expect(isUnlocked()).toBe(false);
  });

  it('unlocks with the right passphrase', async () => {
    await createVault(PASS);
    lockVault();
    await unlockVault(PASS);
    expect(isUnlocked()).toBe(true);
  });

  it('refuses a passphrase shorter than eight characters', async () => {
    await expect(createVault('short')).rejects.toThrow('at least 8');
    expect(hasVault()).toBe(false);
  });

  it('cannot seal while locked', async () => {
    await expect(sealJson({ a: 1 })).rejects.toThrow('Unlock');
  });
});

describe('encrypted diary storage', () => {
  it('stores the diary as ciphertext, not readable JSON', async () => {
    await createVault(PASS);
    await loadStoredDb();
    writeDb({ ...readDb(), goals: { ...readDb().goals, calories: 1234 } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    const stored = localStorage.getItem(DB_KEY) ?? '';
    expect(stored).not.toContain('1234');
    expect(stored).not.toContain('"logs"');
  });

  it('restores the diary after unlock', async () => {
    await createVault(PASS);
    await loadStoredDb();
    writeDb({ ...createEmptyDb(), goals: { ...createEmptyDb().goals, calories: 1777 } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    lockVault();
    invalidate();
    await unlockVault(PASS);
    const restored = await loadStoredDb();
    expect(restored.goals.calories).toBe(1777);
  });

  it('blocks writes while locked, so a locked store is never overwritten', async () => {
    await createVault(PASS);
    await loadStoredDb();
    await new Promise((resolve) => setTimeout(resolve, 20));

    lockVault();
    invalidate();
    expect(isLocked()).toBe(true);
    expect(() => writeDb(createEmptyDb())).toThrow('Unlock your diary');
  });
});
