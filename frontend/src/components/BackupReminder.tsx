import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, ShieldAlert, X } from 'lucide-react';
import { backupService } from '../lib/services';
import { spring } from '../ui/motion';

/**
 * A quiet nudge to take a backup.
 *
 * The diary exists in exactly one place — clearing site data destroys it with
 * no recovery. Export has been available since it was built, but a feature
 * nobody remembers to use protects nobody, so this surfaces it at the point
 * where there is finally something worth losing.
 *
 * Deliberately restrained: silent until ~15 entries and ~3 weeks without a
 * backup, and dismissing it buys a real week of quiet.
 */
export const BackupReminder: React.FC<{
  onDismissed: () => void;
  onOpenBackup: () => void;
}> = ({ onDismissed, onOpenBackup }) => {
  const [risk] = React.useState(() => backupService.assessRisk());
  const [gone, setGone] = React.useState(false);

  if (!risk.atRisk) return null;

  const dismiss = () => {
    backupService.snoozeReminder(7);
    setGone(true);
    onDismissed();
  };

  // A backup needs a passphrase, so the reminder hands off to Settings, where it is entered.
  const backup = () => {
    setGone(true);
    onDismissed();
    onOpenBackup();
  };

  return (
    <AnimatePresence>
      {!gone && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={spring}
          className="overflow-hidden"
        >
          <div className="card p-3.5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-2xl grad-tile flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-fg-strong leading-tight">
                Back up your diary
              </p>
              <p className="text-[11px] font-bold text-fg-dim mt-0.5 leading-relaxed">
                {risk.daysSinceBackup === null
                  ? `${risk.entries} entries live only on this device.`
                  : `${risk.entries} entries, last backed up ${risk.daysSinceBackup} days ago.`}{' '}
                Clearing site data would erase them.
              </p>

              <div className="flex items-center gap-2 mt-2.5">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={backup}
                  className="chip grad-accent px-3 py-1.5 text-[11px] shadow-glow"
                >
                  <Download className="w-3 h-3" />
                  Save a copy
                </motion.button>
                <button
                  onClick={dismiss}
                  className="text-[11px] font-extrabold text-fg-dim hover:text-fg-base px-2 py-1.5"
                >
                  Not now
                </button>
              </div>
            </div>

            <button
              onClick={dismiss}
              aria-label="Dismiss backup reminder"
              className="p-1 text-fg-dim hover:text-fg-base shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
