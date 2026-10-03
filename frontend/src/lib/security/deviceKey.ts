/**
 * A per-browser encryption key that needs no passphrase.
 *
 * The key is generated once, with `extractable: false`. The browser keeps the raw
 * key material itself, so page scripts can use the key to encrypt and decrypt but
 * can never read it out. It is stored in IndexedDB, so it survives reloads.
 *
 * Trade-off: the key exists only in this browser profile. Clearing site data
 * removes it, and the local diary becomes unreadable. It does not carry over to
 * another device.
 */

const DB_NAME = 'foodlog-keys';
const STORE = 'keys';
const KEY_ID = 'device-v1';

function openKeyStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser cannot store the diary key.'));
  });
}

function readKey(db: IDBDatabase): Promise<CryptoKey | null> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY_ID);
    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) ?? null);
    request.onerror = () => reject(new Error('Could not read the diary key.'));
  });
}

function writeKey(db: IDBDatabase, key: CryptoKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(key, KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('Could not save the diary key.'));
  });
}

/** Returns this browser's key, creating and storing it on first use. */
export async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const db = await openKeyStore();
  try {
    const existing = await readKey(db);
    if (existing) return existing;

    const key = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // not extractable: scripts can use the key but cannot read it
      ['encrypt', 'decrypt']
    );
    await writeKey(db, key);
    return key;
  } finally {
    db.close();
  }
}
