/**
 * Passphrase-protected backup files.
 *
 * A backup carries its own salt and is sealed with a key derived from a
 * passphrase the user types when exporting. It is deliberately independent of the
 * device's vault, so the file can be opened on a new device with only the
 * passphrase. Losing the passphrase makes the backup unreadable.
 */

import {
  decryptText, deriveKey, encryptText, fromBase64, newSalt, toBase64, type Box,
} from './crypto';

const MIN_PASSPHRASE_LENGTH = 8;

export interface BackupEnvelope extends Box {
  kind: 'foodlog-backup';
  v: 1;
  salt: string;
}

export function isBackupEnvelope(value: unknown): value is BackupEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<BackupEnvelope>;
  return (
    candidate.kind === 'foodlog-backup' &&
    candidate.v === 1 &&
    typeof candidate.salt === 'string' &&
    typeof candidate.iv === 'string' &&
    typeof candidate.data === 'string'
  );
}

/** Seals a serialised diary with a passphrase. */
export async function sealBackup(payload: string, passphrase: string): Promise<BackupEnvelope> {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSPHRASE_LENGTH} characters for the backup passphrase.`);
  }
  const salt = newSalt();
  const key = await deriveKey(passphrase, salt);
  const box = await encryptText(key, payload);
  return { kind: 'foodlog-backup', v: 1, salt: toBase64(salt), ...box };
}

/** Opens a sealed backup. Throws if the passphrase is wrong or the file was altered. */
export async function openBackup(envelope: BackupEnvelope, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  try {
    return await decryptText(key, envelope);
  } catch {
    throw new Error('That passphrase does not open this backup.');
  }
}
