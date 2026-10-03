import { AlertTriangle } from 'lucide-react';
import { useDbRevision } from '../hooks/useDbRevision';
import { getPersistError } from '../lib/storage/localDb';

/**
 * Shown only when a save failed, so the user knows the last change is not on the
 * device yet. Reads the storage layer's status directly, and re-renders when it changes.
 */
export const SaveStatus: React.FC = () => {
  useDbRevision();
  const error = getPersistError();
  if (!error) return null;

  return (
    <div
      role="alert"
      className="mx-3 mt-2 flex items-start gap-2 rounded-2xl bg-white/[0.06] border-2 border-white/10 px-3.5 py-2.5"
    >
      <AlertTriangle className="w-4 h-4 text-accent shrink-0 mt-px" />
      <p className="text-[11px] font-bold text-fg-base leading-relaxed">{error}</p>
    </div>
  );
};
