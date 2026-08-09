import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Check, Cloud, CloudOff, Loader2, RefreshCw } from 'lucide-react';
import * as syncService from '../lib/sync/syncService';
import { Button } from '../ui/primitives';
import { cx } from '../ui/cx';
import { listItem } from '../ui/motion';

/**
 * Connecting the diary to the user's own Google Drive.
 *
 * Framed as "your data, somewhere you already own" rather than as an account
 * system, because that is what it is: the app has no accounts and no server,
 * and the file lives in a private corner of their Drive that only this app can
 * reach.
 */
export const SyncSection: React.FC = () => {
  const [state, setState] = useState(() => syncService.getState());
  const [busy, setBusy] = useState<'signin' | 'sync' | 'signout' | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const configured = syncService.isConfigured();
  const connected = Boolean(state.account);

  const refresh = () => setState(syncService.getState());

  const handleSignIn = async () => {
    setBusy('signin');
    setNote(null);
    const result = await syncService.signIn();
    refresh();
    setNote(result.ok ? 'Connected — your diary is now on all your devices.' : result.error ?? null);
    setBusy(null);
  };

  const handleSync = async () => {
    setBusy('sync');
    setNote(null);
    const result = await syncService.sync();
    refresh();

    if (result.ok) {
      const added = (result.stats?.logsAdded ?? 0) + (result.stats?.dictionaryAdded ?? 0);
      setNote(added > 0 ? `Synced — brought in ${added} new item${added === 1 ? '' : 's'}.` : 'Everything is up to date.');
    } else {
      setNote(result.error ?? 'Sync failed.');
    }
    setBusy(null);
  };

  const handleSignOut = async () => {
    setBusy('signout');
    await syncService.signOut();
    refresh();
    setNote('Disconnected. Your diary stays on this device.');
    setBusy(null);
  };

  const lastSynced = state.lastSyncedAt
    ? new Date(state.lastSyncedAt).toLocaleString(undefined, {
        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <motion.div variants={listItem} className="pt-2 space-y-2">
      <div className="flex items-center gap-2 px-1">
        {connected
          ? <Cloud className="w-3.5 h-3.5 text-fg-dim shrink-0" />
          : <CloudOff className="w-3.5 h-3.5 text-fg-dim shrink-0" />}
        <span className="text-[11px] font-extrabold text-fg-dim uppercase tracking-wide">
          Sync across devices
        </span>
      </div>

      <div className="bg-surface-card rounded-2xl border-2 border-surface-line p-3.5 space-y-3">
        {!configured ? (
          <p className="text-[11px] font-bold text-fg-muted leading-relaxed">
            Drive sync isn't set up for this build. Your diary stays on this device — use
            Export below to move it manually.
          </p>
        ) : !connected ? (
          <>
            <p className="text-[11px] font-bold text-fg-muted leading-relaxed">
              Sign in with Google to keep this diary on every device you use. It's saved to a
              private folder in <span className="text-fg-base">your own Drive</span> — no
              account here, no server, and nothing anyone else can read.
            </p>
            <Button variant="primary" size="sm" fullWidth onClick={handleSignIn} disabled={busy !== null}>
              {busy === 'signin'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting…</>
                : <><Cloud className="w-3.5 h-3.5" /> Sign in with Google</>}
            </Button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl grad-tile flex items-center justify-center shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-fg-strong truncate">{state.account}</p>
                <p className="text-[10px] font-bold text-fg-dim">
                  {lastSynced ? `Last synced ${lastSynced}` : 'Not synced yet'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="soft" size="sm" fullWidth onClick={handleSync} disabled={busy !== null}>
                {busy === 'sync'
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing…</>
                  : <><RefreshCw className="w-3.5 h-3.5" /> Sync now</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} disabled={busy !== null}>
                Disconnect
              </Button>
            </div>
          </>
        )}

        <AnimatePresence>
          {(note || state.lastError) && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className={cx(
                'text-[11px] font-bold leading-relaxed flex items-start gap-1.5 overflow-hidden',
                state.lastError && !note ? 'text-fg-muted' : 'text-fg-dim'
              )}
            >
              {state.lastError && !note && <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />}
              <span>{note ?? state.lastError}</span>
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
