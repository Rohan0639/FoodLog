import React, { useEffect, useState } from 'react';
import { Lock, UserRound } from 'lucide-react';
import { createVault, unlockVault } from '../lib/security/vault';
import { loadStoredDb } from '../lib/storage/localDb';
import { ApiError } from '../services/api/client';
import * as authApi from '../services/api/authApi';
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
 * Signs the user in to their FoodLog account, or creates one. The session cookie
 * is set by the server and is httpOnly, so scripts on the page cannot read it.
 */
export const AccountGate: React.FC<{ onSignedIn: () => void }> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in from an earlier visit: go straight through.
  useEffect(() => {
    let cancelled = false;
    authApi
      .currentUser()
      .then((user) => {
        if (!cancelled && user) onSignedIn();
      })
      .catch(() => {
        // Server unreachable: stay on the form, which will show the error on submit.
      });
    return () => {
      cancelled = true;
    };
  }, [onSignedIn]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await authApi.register({ email, name, password });
      else await authApi.login({ email, password });
      onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <div className="h-dvh w-full flex items-center justify-center px-6">
      <Card className="max-w-sm w-full p-7">
        <div className="w-14 h-14 rounded-3xl grad-tile flex items-center justify-center mx-auto mb-4">
          <UserRound className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-extrabold text-fg-strong text-center">
          {isRegister ? 'Create your account' : 'Sign in'}
        </h2>
        <p className="text-sm text-fg-muted font-semibold mt-2 mb-5 text-center leading-relaxed">
          Your account lets FoodLog remember the foods you eat, so repeat meals are recognised without
          waiting for the AI.
        </p>

        <form onSubmit={submit} className="space-y-3">
          {isRegister && (
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              aria-label="Your name"
              className="field text-sm w-full"
              required
            />
          )}
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            className="field text-sm w-full"
            required
          />
          <input
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (8+ characters)"
            aria-label="Password"
            className="field text-sm w-full"
            required
          />

          {error && <p role="alert" className="text-[11px] font-bold text-accent">{error}</p>}

          <Button type="submit" variant="primary" size="md" fullWidth disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? 'login' : 'register');
            setError(null);
          }}
          className="w-full text-center text-[11px] font-extrabold text-fg-dim hover:text-fg-base mt-4"
        >
          {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </Card>
    </div>
  );
};
