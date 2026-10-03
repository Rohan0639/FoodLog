import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetStore } from './setup';
import { readDb, updateDb, invalidate, loadStoredDb, flushPersist } from '../src/lib/storage/localDb';
import { __setIterations } from '../src/lib/security/crypto';
import { createVault, lockVault, openJson, isEnvelope } from '../src/lib/security/vault';
import * as logService from '../src/lib/services/logService';
import { getLocalIsoDate } from '../src/utils/date';

/**
 * Drive and Google sign-in are replaced with fakes.
 *
 * What is under test is the orchestration — pull before push, merge before
 * upload, and never destroying local data when something goes wrong. The HTTP
 * details of Drive are not; they cannot be exercised without a real OAuth
 * client tied to a Google account.
 */
const fakeDrive = {
  file: null as { id: string } | null,
  content: null as unknown,
  calls: [] as string[],
  failOn: null as string | null,
};

vi.mock('../src/lib/sync/googleAuth', () => ({
  isConfigured: () => true,
  hasToken: () => true,
  getAccessToken: async () => 'fake-token',
  signOut: async () => {},
}));

vi.mock('../src/lib/sync/driveClient', () => ({
  findFile: async () => {
    fakeDrive.calls.push('find');
    if (fakeDrive.failOn === 'find') throw new Error('Drive is busy.');
    return fakeDrive.file;
  },
  download: async () => {
    fakeDrive.calls.push('download');
    if (fakeDrive.failOn === 'download') throw new Error('Drive is busy.');
    return fakeDrive.content;
  },
  create: async (_t: string, content: unknown) => {
    fakeDrive.calls.push('create');
    if (fakeDrive.failOn === 'create') throw new Error('Drive is busy.');
    fakeDrive.content = content;
    fakeDrive.file = { id: 'file-1' };
    return fakeDrive.file;
  },
  update: async (_t: string, id: string, content: unknown) => {
    fakeDrive.calls.push('update');
    if (fakeDrive.failOn === 'update') throw new Error('Drive is busy.');
    fakeDrive.content = content;
    return { id };
  },
  accountEmail: async () => 'me@example.com',
}));

const syncService = await import('../src/lib/sync/syncService');

const today = getLocalIsoDate();

const addLog = (id: string, name: string, kcal: number) =>
  logService.addLogs([{
    id, name, quantity: 1, unit: 'piece', calories: kcal,
    protein: 1, carbs: 1, fats: 1, sugar: 0, fiber: 0,
    createdAt: `${today}T08:00:00.000Z`,
  }]);

const connect = () =>
  updateDb((db) => ({
    ...db,
    meta: { ...db.meta, sync: { ...db.meta.sync, account: 'me@example.com' } },
  }));

/** What the last upload contained, decrypted, so assertions can read it. */
const uploaded = async (): Promise<any> =>
  isEnvelope(fakeDrive.content) ? openJson(fakeDrive.content) : fakeDrive.content;

beforeEach(async () => {
  // Let queued saves land first, so none of them writes into the next test.
  await flushPersist();
  resetStore();
  lockVault();
  invalidate();
  // Sync only ever uploads ciphertext, so every test runs with an unlocked vault.
  __setIterations(1000);
  await createVault('correct horse battery');
  await loadStoredDb();
  fakeDrive.file = null;
  fakeDrive.content = null;
  fakeDrive.calls = [];
  fakeDrive.failOn = null;
});

describe('doing nothing when not connected', () => {
  it('succeeds silently with no Drive traffic', async () => {
    const result = await syncService.sync();
    expect(result.ok).toBe(true);
    expect(result.stats).toBeNull();
    expect(fakeDrive.calls).toEqual([]);
  });
});

describe('first sync', () => {
  it('creates the file and uploads what this device holds', async () => {
    connect();
    addLog('a', 'egg', 70);

    const result = await syncService.sync();
    expect(result.ok).toBe(true);
    expect(fakeDrive.calls).toContain('create');
    expect((await uploaded()).logs).toHaveLength(1);
  });

  it('remembers the file so it is not searched for again', async () => {
    connect();
    await syncService.sync();
    expect(readDb().meta.sync.fileId).toBe('file-1');

    fakeDrive.calls = [];
    await syncService.sync();
    expect(fakeDrive.calls).not.toContain('find');
  });

  it('records when it last succeeded', async () => {
    connect();
    await syncService.sync();
    expect(readDb().meta.sync.lastSyncedAt).toBeTruthy();
    expect(readDb().meta.sync.lastError).toBeNull();
  });
});

describe('pull happens before push', () => {
  it('downloads before uploading', async () => {
    // Uploading first would overwrite whatever another device wrote since this
    // one last looked — the single most destructive ordering mistake possible.
    connect();
    fakeDrive.file = { id: 'file-1' };
    fakeDrive.content = { logs: [], foodDictionary: [], favorites: [], tombstones: [] };

    await syncService.sync();

    const download = fakeDrive.calls.indexOf('download');
    const upload = fakeDrive.calls.indexOf('update');
    expect(download).toBeGreaterThanOrEqual(0);
    expect(download).toBeLessThan(upload);
  });

  it('brings in another device\'s entries', async () => {
    connect();
    addLog('mine', 'egg', 70);
    fakeDrive.file = { id: 'file-1' };
    fakeDrive.content = {
      logs: [{
        id: 'theirs', date: today, createdAt: `${today}T09:00:00.000Z`,
        updatedAt: `${today}T09:00:00.000Z`, name: 'rice', quantity: 1, unit: 'piece',
        calories: 200, protein: 1, carbs: 1, fats: 1, sugar: 0, fiber: 0,
      }],
      foodDictionary: [], favorites: [], tombstones: [],
    };

    const result = await syncService.sync();

    expect(result.stats?.logsAdded).toBe(1);
    expect(readDb().logs.map((l) => l.id).sort()).toEqual(['mine', 'theirs']);
  });

  it('uploads the union, not just what it downloaded', async () => {
    connect();
    addLog('mine', 'egg', 70);
    fakeDrive.file = { id: 'file-1' };
    fakeDrive.content = {
      logs: [{
        id: 'theirs', date: today, createdAt: `${today}T09:00:00.000Z`,
        updatedAt: `${today}T09:00:00.000Z`, name: 'rice', quantity: 1, unit: 'piece',
        calories: 200, protein: 1, carbs: 1, fats: 1, sugar: 0, fiber: 0,
      }],
      foodDictionary: [], favorites: [], tombstones: [],
    };

    await syncService.sync();
    expect((await uploaded()).logs.map((l: any) => l.id).sort()).toEqual(['mine', 'theirs']);
  });
});

describe('failures never cost data', () => {
  it.each(['find', 'download', 'create', 'update'])('survives a failure during %s', async (stage) => {
    connect();
    addLog('a', 'egg', 70);
    if (stage === 'download' || stage === 'update') fakeDrive.file = { id: 'file-1' };
    fakeDrive.failOn = stage;

    const result = await syncService.sync();

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    // The local diary is exactly as it was.
    expect(readDb().logs).toHaveLength(1);
  });

  it('records the error for the settings screen', async () => {
    connect();
    fakeDrive.failOn = 'find';
    await syncService.sync();
    expect(readDb().meta.sync.lastError).toBeTruthy();
  });

  it('clears the error after a later success', async () => {
    connect();
    fakeDrive.failOn = 'find';
    await syncService.sync();
    expect(readDb().meta.sync.lastError).toBeTruthy();

    fakeDrive.failOn = null;
    await syncService.sync();
    expect(readDb().meta.sync.lastError).toBeNull();
  });

  it('refuses a remote file that is not a diary', async () => {
    connect();
    addLog('a', 'egg', 70);
    fakeDrive.file = { id: 'file-1' };
    fakeDrive.content = { something: 'else' };

    const result = await syncService.sync();

    expect(result.ok).toBe(false);
    expect(readDb().logs).toHaveLength(1);
  });

  it('treats an empty remote file as a first sync, not a wipe', async () => {
    connect();
    addLog('a', 'egg', 70);
    fakeDrive.file = { id: 'file-1' };
    fakeDrive.content = null;

    const result = await syncService.sync();

    expect(result.ok).toBe(true);
    expect(readDb().logs).toHaveLength(1);
    expect((await uploaded()).logs).toHaveLength(1);
  });
});

describe('overlapping runs', () => {
  it('shares one run rather than racing', async () => {
    connect();
    const [a, b] = await Promise.all([syncService.sync(), syncService.sync()]);
    expect(a).toBe(b);
    expect(fakeDrive.calls.filter((c) => c === 'create')).toHaveLength(1);
  });
});

describe('disconnecting', () => {
  it('keeps every local entry', async () => {
    connect();
    addLog('a', 'egg', 70);
    await syncService.sync();

    await syncService.signOut();

    // Signing out is not a request to delete a diary.
    expect(readDb().logs).toHaveLength(1);
    expect(readDb().meta.sync.account).toBeNull();
    expect(readDb().meta.sync.fileId).toBeNull();
  });

  it('stops syncing afterwards', async () => {
    connect();
    await syncService.sync();
    await syncService.signOut();

    fakeDrive.calls = [];
    await syncService.sync();
    expect(fakeDrive.calls).toEqual([]);
  });
});
