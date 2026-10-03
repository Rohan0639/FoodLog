/**
 * Encryption primitives for the diary.
 *
 * The key is derived from the user's passphrase in the browser with PBKDF2, and
 * the data is sealed with AES-256-GCM. The passphrase and the derived key never
 * leave the device, so neither FoodLog nor Google can read the diary.
 */

/** Deliberately slow to brute-force; OWASP's current guidance for PBKDF2-SHA256. */
let iterations = 600_000;

/** Lowers the cost in tests so key derivation does not dominate the run. */
export function __setIterations(count: number): void {
  iterations = count;
}

export interface Box {
  /** Base64 initialisation vector, unique per encryption. */
  iv: string;
  /** Base64 ciphertext, including the GCM authentication tag. */
  data: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

export function newSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<Box> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    encoder.encode(plaintext) as BufferSource
  );
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(ciphertext)) };
}

/** Throws if the key is wrong or the data has been altered (GCM authenticates it). */
export async function decryptText(key: CryptoKey, box: Box): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(box.iv) as BufferSource },
    key,
    fromBase64(box.data) as BufferSource
  );
  return decoder.decode(plaintext);
}
