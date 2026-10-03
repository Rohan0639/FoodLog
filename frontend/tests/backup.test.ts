import { describe, it, expect, beforeEach } from 'vitest';
import { __setIterations } from '../src/lib/security/crypto';
import { sealBackup, openBackup, isBackupEnvelope } from '../src/lib/security/backup';
import * as backupService from '../src/lib/services/backupService';

const PASS = 'backup passphrase';
const PLAIN = JSON.stringify({ schemaVersion: 1, logs: [{ id: 'a', name: 'egg', date: '2026-01-01' }] });

beforeEach(() => {
  __setIterations(1000); // fast in tests; production uses 600k
});

describe('passphrase-protected backups', () => {
  it('round-trips a diary with the same passphrase', async () => {
    const sealed = await sealBackup(PLAIN, PASS);
    expect(isBackupEnvelope(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toContain('egg');
    expect(await openBackup(sealed, PASS)).toBe(PLAIN);
  });

  it('rejects the wrong passphrase', async () => {
    const sealed = await sealBackup(PLAIN, PASS);
    await expect(openBackup(sealed, 'not the passphrase')).rejects.toThrow('does not open');
  });

  it('gives each backup its own salt, so identical diaries seal differently', async () => {
    const a = await sealBackup(PLAIN, PASS);
    const b = await sealBackup(PLAIN, PASS);
    expect(a.salt).not.toBe(b.salt);
    expect(a.data).not.toBe(b.data);
  });

  it('refuses a passphrase shorter than eight characters', async () => {
    await expect(sealBackup(PLAIN, 'short')).rejects.toThrow('at least 8');
  });

  it('recognises encrypted backups and reads them with the passphrase', async () => {
    const file = JSON.stringify(await sealBackup(PLAIN, PASS));
    expect(backupService.isEncryptedBackup(file)).toBe(true);
    await expect(backupService.readBackup(file)).rejects.toThrow('passphrase');
    expect(await backupService.readBackup(file, PASS)).toBe(PLAIN);
  });

  it('still accepts a plain backup from before encryption existed', async () => {
    expect(backupService.isEncryptedBackup(PLAIN)).toBe(false);
    expect(await backupService.readBackup(PLAIN)).toBe(PLAIN);
  });
});
