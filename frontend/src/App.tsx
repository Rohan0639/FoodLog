import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Apple, Lock } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import { runLegacyMigration } from './lib/migration/legacyMigration';
import { isStorageAvailable } from './lib/storage/localDb';
import { profileService } from './lib/services';
import { Blobs, Card } from './ui/primitives';
import { spring } from './ui/motion';
import type { Profile } from './lib/storage/schema';

/**
 * App shell.
 *
 * There is no sign-in: the diary lives on this device, so the only thing to do
 * before showing it is give the one-time import of any pre-existing cloud data
 * a chance to finish. That runs at most once — afterwards this is a single
 * synchronous read and the loading frame is imperceptible.
 */
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageBlocked, setStorageBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!isStorageAvailable()) {
        if (!cancelled) {
          setStorageBlocked(true);
          setLoading(false);
        }
        return;
      }

      // Never allowed to block startup: a failed import is retried on the next
      // launch and leaves the original data untouched in the meantime.
      try {
        await runLegacyMigration();
      } catch (err) {
        console.error('[App] Legacy import failed', err);
      }

      if (cancelled) return;
      setProfile(profileService.getProfile());
      setLoading(false);
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center gap-5 px-6">
        <Blobs />
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring}
          className="relative"
        >
          <motion.div
            animate={{ y: [0, -10, 0], rotate: [0, -6, 6, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            className="w-20 h-20 rounded-4xl grad-accent flex items-center justify-center shadow-glow-lg"
          >
            <Apple className="w-10 h-10 fill-black/10" />
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center"
        >
          <h2 className="text-lg font-extrabold text-fg-strong">FoodLog</h2>
          <p className="text-sm text-fg-dim font-bold mt-1">Getting your diary ready…</p>
        </motion.div>

        {/* Indeterminate progress — a shimmer rather than a spinner */}
        <div className="w-40 h-1.5 rounded-full bg-surface-raised overflow-hidden">
          <motion.div
            className="h-full w-1/2 rounded-full grad-accent"
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 1.3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
      </div>
    );
  }

  if (storageBlocked || !profile) {
    return (
      <div className="h-dvh w-full flex items-center justify-center px-6">
        <Blobs />
        <Card initial="hidden" animate="show" className="max-w-sm text-center p-7">
          <div className="w-16 h-16 rounded-3xl bg-white/10 text-accent flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-extrabold text-fg-strong">Storage is switched off</h2>
          <p className="text-sm text-fg-muted font-semibold mt-2 leading-relaxed">
            FoodLog keeps your diary on this device. Turn off private browsing, or allow site
            data for this page, then reload.
          </p>
        </Card>
      </div>
    );
  }

  return <Dashboard />;
}
