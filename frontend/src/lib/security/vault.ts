/**
 * The user's vault: the one place the encryption key lives.
 *
 * The key is held in memory only, so every page load needs the passphrase again.
 * What is stored on disk is a header with the salt and a small encrypted check
 * value. The check lets us tell a wrong passphrase apart from a corrupt store
 * without touching the diary itself.
 */

import {
  decryptText, deriveKey, encryptText, fromBase64, newSalt, toBase64, type Box,
} from './crypto';

/** localStorage key for the vault header (salt + check value). */
export const VAULT_HEADER_KEY = 'foodlog_vault_v1';

const CHECK_TEXT = 'foodlog-vault-ok';
const MIN_PASSPHRASE_LENGTH = 8;

interface VaultHeader {
  v: 1;
  salt: string;
  check: Box;
}

/** An encrypted value as it is written to storage or to Drive. */
export interface Envelope extends Box {
  v: 1;
}

let key: CryptoKey | null = null;

export function hasVault(): boolean {
  try {
    return window.localStorage.getItem(VAULT_HEADER_KEY) !== null;
  } catch {
    return false;
  }
}

export function isUnlocked(): boolean {
  return key !== null;
}

/** Creates a new vault. Only call this when none exists; it replaces the header. */
export async function createVault(passphrase: string): Promise<void> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }
  const salt = newSalt();
  const derived = await deriveKey(passphrase, salt);
  const header: VaultHeader = {
    v: 1,
    salt: toBase64(salt),
    check: await encryptText(derived, CHECK_TEXT),
  };
  window.localStorage.setItem(VAULT_HEADER_KEY, JSON.stringify(header));
  key = derived;
}

/** Unlocks an existing vault. Throws if the passphrase is wrong. */
export async function unlockVault(passphrase: string): Promise<void> {
  const raw = window.localStorage.getItem(VAULT_HEADER_KEY);
  if (!raw) throw new Error('No vault has been set up on this device.');

  const header = JSON.parse(raw) as VaultHeader;
  const derived = await deriveKey(passphrase, fromBase64(header.salt));

  let matches = false;
  try {
    matches = (await decryptText(derived, header.check)) === CHECK_TEXT;
  } catch {
    matches = false;
  }
  if (!matches) throw new Error('That passphrase is not right.');

  key = derived;
}

/** Forgets the key. The diary becomes unreadable until the passphrase is entered again. */
export function lockVault(): void {
  key = null;
}

export function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Envelope>;
  return candidate.v === 1 && typeof candidate.iv === 'string' && typeof candidate.data === 'string';
}

/** Encrypts any JSON-serialisable value with the vault key. */
export async function sealJson(value: unknown): Promise<Envelope> {
  if (!key) throw new Error('Unlock your diary before saving it.');
  const box = await encryptText(key, JSON.stringify(value));
  return { v: 1, ...box };
}

/** Decrypts a value produced by `sealJson`. */
export async function openJson<T = unknown>(envelope: Envelope): Promise<T> {
  if (!key) throw new Error('Unlock your diary before reading it.');
  return JSON.parse(await decryptText(key, envelope)) as T;
}
