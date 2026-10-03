import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle, BookMarked, Check, ChevronRight, Download, Flame, HardDrive,
  PartyPopper, RotateCcw, Target, Upload, X,
} from 'lucide-react';
import type { DailyGoal } from '../types';
import { backupService, dictionaryService, goalService, settingsService } from '../lib/services';
import type { BackupSummary } from '../lib/services/backupService';
import { SyncSection } from './SyncSection';
import {Button, ConfirmDialog, IconButton, Modal} from '../ui/primitives';
import { cx } from '../ui/cx';
import { spring, stagger, listItem } from '../ui/motion';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  dailyGoal: DailyGoal;
  onOpenMyFoods: () => void;
}

const GOAL_FIELDS: { key: keyof DailyGoal; label: string; unit: string; color: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', color: '#FFFFFF' },
  { key: 'protein', label: 'Protein', unit: 'g', color: '#FFFFFF' },
  { key: 'carbs', label: 'Carbs', unit: 'g', color: '#DCDCE0' },
  { key: 'fat', label: 'Fat', unit: 'g', color: '#B8B8C0' },
  { key: 'sugar', label: 'Sugar', unit: 'g', color: '#9A9AA3' },
  { key: 'fiber', label: 'Fiber', unit: 'g', color: '#7E7E88' },
];

/**
 * Daily targets and preferences.
 *
 * Every value here was already persisted by `goalService` / `settingsService`;
 * this screen is the first UI to expose them. No new storage, no new logic.
 */
export const SettingsSheet: React.FC<SettingsSheetProps> = ({
  open, onClose, dailyGoal, onOpenMyFoods,
}) => {
  const [draft, setDraft] = useState<DailyGoal>(dailyGoal);
  const [confettiEnabled, setConfettiEnabled] = useState(
    () => settingsService.getSettings().confettiEnabled
  );
  const [saved, setSaved] = useState(false);

  // ── Learned foods ─────────────────────────────────────────────────────
  const learned = dictionaryService.getAll();
  const packagedCount = learned.filter((food) => food.kind === 'scanned').length;
  const totalRecall = learned.reduce((sum, food) => sum + food.timesLogged, 0);

  // ── Backup ────────────────────────────────────────────────────────────
  const [summary] = useState<BackupSummary>(() => backupService.getSummary());
  const [exported, setExported] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<
    { serialized: string; summary: BackupSummary } | null
  >(null);
  /** The passphrase used to seal the next export. Never stored. */
  const [backupPassphrase, setBackupPassphrase] = useState('');
  /** An encrypted file waiting for its passphrase before it can be read. */
  const [encryptedRestore, setEncryptedRestore] = useState<string | null>(null);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setBackupBusy(true);
    setRestoreError(null);
    try {
      await backupService.downloadBackup(backupPassphrase);
      setBackupPassphrase('');
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (err) {
      console.error('[backup] export failed', err);
      setRestoreError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setBackupBusy(false);
    }
  };

  /** Opens an encrypted backup with the passphrase the user typed, then shows its summary. */
  const openEncryptedRestore = async () => {
    if (!encryptedRestore) return;
    setBackupBusy(true);
    setRestoreError(null);
    try {
      const plain = await backupService.readBackup(encryptedRestore, restorePassphrase);
      setPendingRestore({ serialized: plain, summary: backupService.inspect(plain) });
      setEncryptedRestore(null);
      setRestorePassphrase('');
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'That backup could not be opened.');
    } finally {
      setBackupBusy(false);
    }
  };

  /** Validates the picked file and stages it; nothing is written until confirmed. */
  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset so picking the same file twice still fires a change event.
    event.target.value = '';
    if (!file) return;

    setRestoreError(null);
    try {
      const serialized = await backupService.readFile(file);
      if (backupService.isEncryptedBackup(serialized)) {
        // Asked for before anything is read, so the contents are never shown unopened.
        setEncryptedRestore(serialized);
        return;
      }
      setPendingRestore({ serialized, summary: backupService.inspect(serialized) });
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : 'That file could not be read.');
    }
  };

  const confirmRestore = () => {
    if (!pendingRestore) return;
    try {
      backupService.restore(pendingRestore.serialized);
      setPendingRestore(null);
      // A full reload is the honest way to rebuild every view from the new store.
      window.location.reload();
    } catch (err) {
      setPendingRestore(null);
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.');
    }
  };

  const setField = (key: keyof DailyGoal, raw: string) => {
    const value = parseFloat(raw);
    setDraft((prev) => ({ ...prev, [key]: Number.isFinite(value) && value >= 0 ? value : 0 }));
    setSaved(false);
  };

  const handleSave = () => {
    goalService.setDailyGoal(draft);
    settingsService.updateSettings({ confettiEnabled });
    setSaved(true);
    setTimeout(onClose, 620);
  };

  const handleReset = () => {
    const restored = goalService.resetDailyGoal();
    setDraft(restored);
    setSaved(false);
  };

  return (
    <Modal open={open} onClose={onClose} labelledBy="settings-title">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:pt-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl grad-accent shadow-glow flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 id="settings-title" className="text-base font-extrabold text-fg-strong leading-tight">
              Daily goals
            </h2>
            <p className="text-xs text-fg-dim font-bold">Tune your targets</p>
          </div>
        </div>
        <IconButton label="Close settings" tone="plain" onClick={onClose}>
          <X className="w-5 h-5" />
        </IconButton>
      </div>

      {/* Body */}
      <motion.div
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
        className="px-5 pb-5 space-y-3 overflow-y-auto"
      >
        {GOAL_FIELDS.map((field) => (
          <motion.label
            key={field.key}
            variants={listItem}
            className="flex items-center gap-3 bg-surface-card rounded-2xl border-2 border-surface-line px-3.5 py-2.5
                       focus-within:border-white/30 transition-colors duration-200"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: field.color }}
            />
            <span className="flex-1 text-sm font-extrabold text-fg-base">{field.label}</span>
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={draft[field.key]}
              onChange={(e) => setField(field.key, e.target.value)}
              className="w-20 bg-transparent text-right text-sm font-extrabold text-fg-strong num
                         focus:outline-none"
            />
            <span className="text-xs font-bold text-fg-dim w-9">{field.unit}</span>
          </motion.label>
        ))}

        {/* Confetti toggle */}
        <motion.div
          variants={listItem}
          className="flex items-center gap-3 bg-surface-card rounded-2xl border-2 border-surface-line px-3.5 py-2.5"
        >
          <PartyPopper className="w-4 h-4 text-accent shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="block text-sm font-extrabold text-fg-base">Celebrate a log</span>
            <span className="block text-[11px] font-bold text-fg-dim">Confetti when you confirm</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={confettiEnabled}
            aria-label="Toggle confetti"
            onClick={() => { setConfettiEnabled((v) => !v); setSaved(false); }}
            className={cx(
              'relative w-12 h-7 rounded-full transition-colors duration-300 shrink-0',
              confettiEnabled ? 'grad-accent' : 'bg-surface-raised'
            )}
          >
            {/* The knob inverts with the track so it stays legible in both states */}
            <motion.span
              layout
              transition={spring}
              className={cx(
                'absolute top-1 w-5 h-5 rounded-full shadow-soft',
                confettiEnabled ? 'bg-surface-base' : 'bg-fg-dim'
              )}
              style={{ left: confettiEnabled ? 26 : 4 }}
            />
          </button>
        </motion.div>

        {/* ── My foods ─────────────────────────────────────────────
            A summary and a way in; the full library has its own screen. */}
        <motion.div variants={listItem} className="pt-2 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <BookMarked className="w-3.5 h-3.5 text-fg-dim shrink-0" />
            <span className="text-[11px] font-extrabold text-fg-dim uppercase tracking-wide">
              My foods
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenMyFoods}
            className="w-full bg-surface-card rounded-2xl border-2 border-surface-line p-3.5
                       flex items-center gap-3 text-left hover:border-white/20 transition-colors"
          >
            <div className="min-w-0 flex-1">
              {learned.length === 0 ? (
                <p className="text-[11px] font-bold text-fg-muted leading-relaxed">
                  Nothing saved yet. Foods are remembered as you log them, or scan a
                  nutrition label to add a packaged product.
                </p>
              ) : (
                <p className="text-[11px] font-bold text-fg-muted leading-relaxed">
                  <span className="text-fg-strong num">{learned.length}</span> food
                  {learned.length === 1 ? '' : 's'} saved
                  {packagedCount > 0 && <> · <span className="text-fg-strong num">{packagedCount}</span> scanned</>}
                  {' · '}
                  <span className="text-fg-strong num">{totalRecall}</span> log
                  {totalRecall === 1 ? '' : 's'} resolved without the AI.
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-fg-dim shrink-0" />
          </button>
        </motion.div>

        <SyncSection />

        {/* ── Backup ─────────────────────────────────────────────────
            With no server, an exported file is the only copy that survives
            clearing site data or changing device. */}
        <motion.div variants={listItem} className="pt-2 space-y-2">
          <div className="flex items-center gap-2 px-1">
            <HardDrive className="w-3.5 h-3.5 text-fg-dim shrink-0" />
            <span className="text-[11px] font-extrabold text-fg-dim uppercase tracking-wide">
              Your data
            </span>
          </div>

          <div className="bg-surface-card rounded-2xl border-2 border-surface-line p-3.5 space-y-3">
            <p className="text-[11px] font-bold text-fg-muted leading-relaxed">
              {summary.entries > 0 ? (
                <>
                  <span className="text-fg-strong num">{summary.entries}</span> entries across{' '}
                  <span className="text-fg-strong num">{summary.days}</span> day
                  {summary.days === 1 ? '' : 's'}
                  {summary.learnedFoods > 0 && (
                    <>
                      {' · '}
                      <span className="text-fg-strong num">{summary.learnedFoods}</span> food
                      {summary.learnedFoods === 1 ? '' : 's'} learned
                    </>
                  )}
                  .
                </>
              ) : (
                'Nothing logged yet.'
              )}
            </p>

            <input
              type="password"
              autoComplete="new-password"
              value={backupPassphrase}
              onChange={(e) => setBackupPassphrase(e.target.value)}
              placeholder="Backup passphrase (8+ characters)"
              aria-label="Backup passphrase"
              className="field-sm w-full text-xs"
            />

            {encryptedRestore && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-fg-muted leading-relaxed">
                  This backup is encrypted. Enter the passphrase it was saved with.
                </p>
                <div className="flex gap-2">
                  <input
                    type="password"
                    autoComplete="off"
                    value={restorePassphrase}
                    onChange={(e) => setRestorePassphrase(e.target.value)}
                    placeholder="Backup passphrase"
                    aria-label="Backup passphrase to open"
                    className="field-sm flex-1 min-w-0 text-xs"
                  />
                  <Button
                    variant="soft"
                    size="sm"
                    onClick={openEncryptedRestore}
                    disabled={backupBusy || !restorePassphrase}
                  >
                    Open
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="soft"
                size="sm"
                fullWidth
                onClick={handleExport}
                disabled={backupBusy || backupPassphrase.length < 8}
              >
                <Download className="w-3.5 h-3.5" />
                {exported ? 'Saved!' : backupBusy ? 'Encrypting…' : 'Export'}
              </Button>
              <Button variant="soft" size="sm" fullWidth onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5" />
                Restore
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleFilePicked}
            />

            {restoreError && (
              <p className="text-[11px] font-bold text-accent flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                {restoreError}
              </p>
            )}

            <p className="text-[10px] font-bold text-fg-faint leading-relaxed">
              Export writes an encrypted file. Keep the passphrase somewhere safe: without
              it the backup cannot be opened. Restoring replaces everything on this device.
            </p>
          </div>
        </motion.div>

        <motion.p variants={listItem} className="text-[11px] text-fg-dim font-bold leading-relaxed px-1 pt-1">
          <Flame className="w-3 h-3 inline mb-0.5 mr-1 text-accent-dim" />
          Everything stays on this device — nothing is uploaded.
        </motion.p>
      </motion.div>

      {/* Restoring overwrites the whole store, so it is confirmed explicitly
          and the summary of the incoming file is shown first. */}
      <AnimatePresence>
        {pendingRestore && (
          <ConfirmDialog
            key="confirm-restore"
            open={!!pendingRestore}
            icon={<Upload className="w-7 h-7" />}
            title="Restore this backup?"
            message={
              `This file holds ${pendingRestore.summary.entries} entries across ` +
              `${pendingRestore.summary.days} days` +
              (pendingRestore.summary.firstDate
                ? ` (${pendingRestore.summary.firstDate} to ${pendingRestore.summary.lastDate})`
                : '') +
              `. It will replace the ${summary.entries} entries currently on this device.`
            }
            confirmLabel="Restore"
            cancelLabel="Cancel"
            onConfirm={confirmRestore}
            onCancel={() => setPendingRestore(null)}
          />
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-2.5 px-5 pb-6 pt-1 shrink-0" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <Button variant="soft" size="md" onClick={handleReset} className="shrink-0">
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        <Button variant={saved ? 'secondary' : 'primary'} size="md" fullWidth onClick={handleSave}>
          {saved ? (
            <motion.span initial={{ scale: 0.6 }} animate={{ scale: 1 }} className="flex items-center gap-2">
              <Check className="w-4 h-4" /> Saved!
            </motion.span>
          ) : (
            'Save goals'
          )}
        </Button>
      </div>
    </Modal>
  );
};
