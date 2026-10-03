import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Apple, Lock } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import { runLegacyMigration } from './lib/migration/legacyMigration';
import { isStorageAvailable } from './lib/storage/localDb';
import { adoptKey, hasVault, isUnlocked } from './lib/security/vault';
import { getOrCreateDeviceKey } from './lib/security/deviceKey';
import { loadStoredDb } from './lib/storage/localDb';
import { profileService } from './lib/services';
import { VaultGate, AccountGate } from './components/AccessGate';
import { Blobs, Card } from './ui/primitives';
import { spring } from './ui/motion';

/**
 * Startup order, each step gating the next:
 *   1. storage must work
 *   2. the diary is unlocked: a legacy passphrase vault if one exists, otherwise
 *      this browser's device key (created silently on first use)
 *   3. the user must be signed in to their FoodLog account
 *   4. the one-time Supabase import runs, then the dashboard opens
 */
type Phase = 'blocked' | 'device' | 'unlock' | 'account' | 'booting' | 'ready';

function initialPhase(): Phase {
  if (!isStorageAvailable()) return 'blocked';
  if (isUnlocked()) return 'account';
  return hasVault() ? 'unlock' : 'device';
}

export default function App() {
  const [phase, setPhase] = useState<Phase>(initialPhase);

  const afterVault = useCallback(() => setPhase('account'), []);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  // No passphrase: open the diary with this browser's device key.
  useEffect(() => {
    if (phase !== 'device') return;
    let cancelled = false;
    getOrCreateDeviceKey()
      .then(async (key) => {
        adoptKey(key);
        await loadStoredDb();
        if (!cancelled) setPhase('account');
      })
      .catch((err) => {
        if (!cancelled) setDeviceError(err instanceof Error ? err.message : 'Could not open your diary.');
      });
    return () => {
      cancelled = true;
    };
  }, [phase]);
  const afterAccount = useCallback(() => setPhase('booting'), []);

  useEffect(() => {
    if (phase !== 'booting') return;
    let cancelled = false;

    // Never allowed to block startup: a failed import is retried on the next launch.
    runLegacyMigration()
      .catch((err) => console.error('[App] Legacy import failed', err))
      .finally(() => {
        if (!cancelled) setPhase('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [phase]);

  if (phase === 'blocked') {
    return (
      <div className="h-dvh w-full flex items-center justify-center px-6">
        <Blobs />
        <Card className="max-w-sm text-center p-7">
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

  if (phase === 'device') {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center gap-4 px-6">
        <Blobs />
        {deviceError ? (
          <p role="alert" className="text-sm font-bold text-accent text-center max-w-sm">{deviceError}</p>
        ) : (
          <p className="text-sm text-fg-dim font-bold">Getting your diary ready…</p>
        )}
      </div>
    );
  }

  if (phase === 'unlock') {
    return (
      <>
        <Blobs />
        <VaultGate mode="unlock" onReady={afterVault} />
      </>
    );
  }

  if (phase === 'account') {
    return (
      <>
        <Blobs />
        <AccountGate onSignedIn={afterAccount} />
      </>
    );
  }

  if (phase === 'booting') {
    return (
      <div className="h-dvh w-full flex flex-col items-center justify-center gap-5 px-6">
        <Blobs />
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={spring}
          className="w-20 h-20 rounded-4xl grad-accent flex items-center justify-center shadow-glow-lg"
        >
          <Apple className="w-10 h-10 fill-black/10" />
        </motion.div>
        <p className="text-sm text-fg-dim font-bold">Getting your diary ready…</p>
      </div>
    );
  }

  // Touch the profile so it is created on first use, as before.
  profileService.getProfile();
  return <Dashboard />;
}
