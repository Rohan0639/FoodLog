/**
 * Backup and restore.
 *
 * With no server, this file is the only thing standing between the user and
 * permanent data loss — clearing site data, switching browser, or replacing a
 * laptop all destroy the diary otherwise. The storage engine already knew how
 * to serialise itself; this exposes it through the service layer so components
 * never have to touch `localDb` directly.
 */

import { exportDb, importDb, readDb } from '../storage/localDb';
import { addDays, getCurrentIsoString, getLocalIsoDate } from '../../utils/date';
import { isBackupEnvelope, openBackup, sealBackup } from '../security/backup';
import { updateSettings } from './settingsService';

export interface BackupSummary {
  entries: number;
  days: number;
  learnedFoods: number;
  firstDate: string | null;
  lastDate: string | null;
}

/** What a backup would contain — shown before the user commits to anything. */
export function getSummary(): BackupSummary {
  const db = readDb();
  const dates = Array.from(new Set(db.logs.map((log) => log.date))).sort();
  return {
    entries: db.logs.length,
    days: dates.length,
    learnedFoods: db.foodDictionary.length,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/** `foodlog-backup-2026-08-01.json` */
export function suggestedFilename(): string {
  return `foodlog-backup-${getLocalIsoDate()}.json`;
}

/** Serialised copy of everything, ready to write to disk. */
export function serialize(): string {
  return exportDb();
}

/** Records that a backup was taken, which resets the reminder. */
export function markBackedUp(): void {
  updateSettings({ lastBackupAt: getCurrentIsoString(), backupSnoozedUntil: null });
}

/** Hides the reminder for a while without taking a backup. */
export function snoozeReminder(days = 7): void {
  updateSettings({ backupSnoozedUntil: addDays(getLocalIsoDate(), days) });
}

/** Entries worth protecting before nagging anyone. */
const REMIND_AFTER_ENTRIES = 15;
/** A backup older than this no longer covers recent logging. */
const REMIND_AFTER_DAYS = 21;

export interface BackupRisk {
  atRisk: boolean;
  /** Null when they have never exported. */
  daysSinceBackup: number | null;
  entries: number;
}

/**
 * Whether the user has enough unprotected data to be worth warning about.
 *
 * Deliberately quiet: nothing is said until there is a meaningful amount to
 * lose, and dismissing it buys real silence. A reminder people learn to ignore
 * protects nobody.
 */
export function assessRisk(): BackupRisk {
  const db = readDb();
  const entries = db.logs.length;
  const { lastBackupAt, backupSnoozedUntil } = db.settings;

  const daysSinceBackup = lastBackupAt
    ? Math.floor((Date.now() - new Date(lastBackupAt).getTime()) / 86_400_000)
    : null;

  const snoozed = Boolean(backupSnoozedUntil && getLocalIsoDate() < backupSnoozedUntil);
  const enoughToLose = entries >= REMIND_AFTER_ENTRIES;
  const stale = daysSinceBackup === null || daysSinceBackup >= REMIND_AFTER_DAYS;

  return { atRisk: enoughToLose && stale && !snoozed, daysSinceBackup, entries };
}

/** True when a backup file is passphrase-encrypted rather than plain JSON. */
export function isEncryptedBackup(serialized: string): boolean {
  try {
    return isBackupEnvelope(JSON.parse(serialized));
  } catch {
    return false;
  }
}

/**
 * Returns the plain diary JSON from a backup file, decrypting it if needed.
 * Plain backups from before encryption existed are accepted unchanged.
 */
export async function readBackup(serialized: string, passphrase?: string): Promise<string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new InvalidBackupError("That file isn't valid JSON.");
  }

  if (!isBackupEnvelope(parsed)) return serialized;
  if (!passphrase) throw new InvalidBackupError('This backup is encrypted. Enter its passphrase.');
  return openBackup(parsed, passphrase);
}

/**
 * Triggers a download of the whole diary, encrypted with a passphrase.
 *
 * Uses an object URL rather than a data URI so large stores don't hit the
 * browser's URL length ceiling.
 */
export async function downloadBackup(passphrase: string): Promise<void> {
  const envelope = await sealBackup(serialize(), passphrase);
  const blob = new Blob([JSON.stringify(envelope)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedFilename();
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Release the object URL once the download has been handed to the browser.
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  markBackedUp();
}

export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

/**
 * Checks a file really is a FoodLog backup before anything is overwritten.
 *
 * Restoring replaces the entire store, so a wrong file must be rejected here
 * rather than discovered afterwards.
 */
export function inspect(serialized: string): BackupSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new InvalidBackupError("That file isn't valid JSON.");
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidBackupError("That file doesn't look like a FoodLog backup.");
  }

  const candidate = parsed as Record<string, unknown>;
  if (!Array.isArray(candidate.logs) || typeof candidate.schemaVersion !== 'number') {
    throw new InvalidBackupError("That file doesn't look like a FoodLog backup.");
  }

  const logs = candidate.logs as { date?: string }[];
  const dates = Array.from(
    new Set(logs.map((log) => log.date).filter((d): d is string => typeof d === 'string'))
  ).sort();

  return {
    entries: logs.length,
    days: dates.length,
    learnedFoods: Array.isArray(candidate.foodDictionary) ? candidate.foodDictionary.length : 0,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/** Reads a picked file as text. */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new InvalidBackupError('That file could not be read.'));
    reader.readAsText(file);
  });
}

/**
 * Replaces the database with a backup.
 *
 * Validates first, and returns the previous contents so the caller can offer an
 * undo. Restoring is destructive by design — it is a restore, not a merge.
 */
export function restore(serialized: string): { previous: string; summary: BackupSummary } {
  const summary = inspect(serialized);
  const previous = serialize();
  importDb(serialized);
  return { previous, summary };
}
