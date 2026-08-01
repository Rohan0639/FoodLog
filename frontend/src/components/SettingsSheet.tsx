import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Flame, PartyPopper, RotateCcw, Target, X } from 'lucide-react';
import type { DailyGoal } from '../types';
import { goalService, settingsService } from '../lib/services';
import {Button, IconButton, Modal} from '../ui/primitives';
import { cx } from '../ui/cx';
import { spring, stagger, listItem } from '../ui/motion';

interface SettingsSheetProps {
  open: boolean;
  onClose: () => void;
  dailyGoal: DailyGoal;
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
export const SettingsSheet: React.FC<SettingsSheetProps> = ({ open, onClose, dailyGoal }) => {
  const [draft, setDraft] = useState<DailyGoal>(dailyGoal);
  const [confettiEnabled, setConfettiEnabled] = useState(
    () => settingsService.getSettings().confettiEnabled
  );
  const [saved, setSaved] = useState(false);

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

        <motion.p variants={listItem} className="text-[11px] text-fg-dim font-bold leading-relaxed px-1 pt-1">
          <Flame className="w-3 h-3 inline mb-0.5 mr-1 text-accent-dim" />
          Everything stays on this device — nothing is uploaded.
        </motion.p>
      </motion.div>

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
