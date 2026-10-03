import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, Cloud } from 'lucide-react';
import { createVault, unlockVault } from '../lib/security/vault';
import { loadStoredDb } from '../lib/storage/localDb';
import * as syncService from '../lib/sync/syncService';
import { Button, Card } from '../ui/primitives';

/**
 * Creates the passphrase on first use, or asks for it on every later visit.
 *
 * The passphrase is never stored or sent anywhere. Losing it means losing the
 * diary, because nothing else holds a copy that can be decrypted.
 */
export const VaultGate: React.FC<{ mode: 'setup' | 'unlock'; onReady: () => void }> = ({
  mode,
  onReady,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSetup = mode === 'setup';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    if (isSetup && passphrase !== confirm) {
      setError('The two passphrases do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (isSetup) await createVault(passphrase);
      else await unlockVault(passphrase);
      await loadStoredDb();
      onReady();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open your diary.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-dvh w-full flex items-center justify-center px-6">
      <Card className="max-w-sm w-full p-7">
        <div className="w-14 h-14 rounded-3xl grad-accent shadow-glow flex items-center justify-center mx-auto mb-4">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-fg-strong text-center">
          {isSetup ? 'Protect your diary' : 'Unlock your diary'}
        </h2>
        <p className="text-sm text-fg-muted font-semibold mt-2 mb-5 text-center leading-relaxed">
          {isSetup
            ? 'Choose a passphrase. Your diary is encrypted with it on this device before it is saved or synced.'
            : 'Enter your passphrase to open your diary.'}
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase"
            aria-label="Passphrase"
            className="field text-sm w-full"
            autoFocus
          />
          {isSetup && (
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat passphrase"
              aria-label="Repeat passphrase"
              className="field text-sm w-full"
            />
          )}

          {isSetup && (
            <p className="text-[11px] font-bold text-fg-dim leading-relaxed">
              There is no way to recover a forgotten passphrase. Keep it somewhere safe.
            </p>
          )}

          {error && <p className="text-[11px] font-bold text-accent">{error}</p>}

          <Button type="submit" variant="primary" size="md" fullWidth disabled={busy || !passphrase}>
            {busy ? 'Opening…' : isSetup ? 'Create passphrase' : 'Unlock'}
          </Button>
        </form>
      </Card>
    </div>
  );
};

/**
 * Requires a Google account before the diary opens. The account is only used to
 * reach the user's own private Drive folder, where the encrypted copy is kept.
 */
export const SignInGate: React.FC<{ onSignedIn: () => void }> = ({ onSignedIn }) => {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    // Silent attempt first: an already-authorised user goes straight through.
    let cancelled = false;
    syncService.resume().finally(() => {
      if (!cancelled && syncService.isSignedIn()) onSignedIn();
    });
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  const signIn = async () => {
    setBusy(true);
    setNote(null);
    const result = await syncService.signIn();
    setBusy(false);
    if (result.ok) onSignedIn();
    else setNote(result.error ?? 'Sign-in failed. Try again.');
  };

  return (
    <div className="h-dvh w-full flex items-center justify-center px-6">
      <Card className="max-w-sm w-full p-7 text-center">
        <div className="w-14 h-14 rounded-3xl grad-tile flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-fg-strong">Sign in to continue</h2>
        <p className="text-sm text-fg-muted font-semibold mt-2 mb-5 leading-relaxed">
          Your encrypted diary is kept in a private folder in your own Google Drive. FoodLog cannot
          read it, and it cannot see anything else in your Drive.
        </p>
        <Button variant="primary" size="md" fullWidth onClick={signIn} disabled={busy}>
          <Cloud className="w-4 h-4" />
          {busy ? 'Connecting…' : 'Sign in with Google'}
        </Button>
        {note && <p className="text-[11px] font-bold text-accent mt-3">{note}</p>}
      </Card>
    </div>
  );
};
