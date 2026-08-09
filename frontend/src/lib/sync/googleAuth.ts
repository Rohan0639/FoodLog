/**
 * Signing in with Google, purely to reach the user's own Drive.
 *
 * There is no account system here and no server. Google verifies who someone
 * is; this app only ever receives a short-lived token scoped to a private
 * folder inside *their* Drive. Nothing about them is stored anywhere we run.
 *
 * The token is deliberately kept in memory only. Putting it in localStorage
 * would make it readable by any script on the origin and leave it lying around
 * after the tab closes — for a credential that grants access to someone's
 * Drive, that is not a reasonable trade for skipping a silent, invisible
 * re-authorisation on load.
 */

/** Only the app's own private folder — this cannot read the user's real Drive. */
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

export interface GoogleToken {
  accessToken: string;
  /** Epoch ms. */
  expiresAt: number;
}

/**
 * The slice of Google Identity Services this app uses.
 *
 * Declared here rather than pulled in as a dependency — five fields do not
 * justify a types package, and writing them out documents exactly how much of
 * the SDK is relied upon.
 */
interface TokenResponse {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
}

interface TokenClient {
  requestAccessToken(options: { prompt: string }): void;
}

interface GoogleAccounts {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: TokenResponse) => void;
        error_callback?: (error: { type?: string }) => void;
      }): TokenClient;
      revoke?(token: string, done?: () => void): void;
    };
  };
}

function googleApi(): GoogleAccounts | undefined {
  return (window as unknown as { google?: GoogleAccounts }).google;
}

let token: GoogleToken | null = null;
let gisLoading: Promise<void> | null = null;

/** The OAuth client, supplied at build time. Absent means sync is switched off. */
export function clientId(): string | null {
  const id = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  return typeof id === 'string' && id.trim() ? id.trim() : null;
}

/** Whether this build is configured for Drive sync at all. */
export function isConfigured(): boolean {
  return clientId() !== null;
}

/** Loads Google's script once, on demand. */
function loadGis(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No browser context.'));
  if (googleApi()?.accounts?.oauth2) return Promise.resolve();

  if (!gisLoading) {
    gisLoading = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('Google sign-in failed to load.')));
        return;
      }

      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Google sign-in failed to load. Check your connection.'));
      document.head.appendChild(script);
    }).catch((err) => {
      // Allow a later attempt to retry rather than caching the failure forever.
      gisLoading = null;
      throw err;
    });
  }

  return gisLoading;
}

/** A token with a little life left in it, or null. */
function usableToken(): string | null {
  // 60s of headroom so a request cannot expire mid-flight.
  if (token && token.expiresAt > Date.now() + 60_000) return token.accessToken;
  return null;
}

/**
 * Obtains an access token.
 *
 * `interactive` decides whether Google may show its account chooser. Silent
 * requests are used on startup so an already-authorised user is simply signed
 * in, with no popup; a popup is only ever raised from a real button press,
 * because browsers block unrequested ones anyway.
 */
export async function getAccessToken(interactive: boolean): Promise<string | null> {
  const cached = usableToken();
  if (cached) return cached;

  const id = clientId();
  if (!id) throw new Error('Drive sync is not configured for this build.');

  await loadGis();
  const oauth2 = googleApi()?.accounts?.oauth2;
  if (!oauth2) throw new Error('Google sign-in is unavailable.');

  return new Promise<string | null>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: id,
      scope: SCOPE,
      callback: (response: TokenResponse) => {
        if (response?.error) {
          // A silent attempt that needs consent is not a failure, just a "no".
          if (!interactive) return resolve(null);
          return reject(new Error(describeAuthError(response.error)));
        }
        if (!response.access_token) {
          return interactive
            ? reject(new Error('Google returned no access token.'))
            : resolve(null);
        }
        token = {
          accessToken: response.access_token,
          expiresAt: Date.now() + Number(response.expires_in ?? 3600) * 1000,
        };
        resolve(token.accessToken);
      },
      error_callback: (err: { type?: string }) => {
        if (!interactive) return resolve(null);
        reject(new Error(describeAuthError(err?.type)));
      },
    });

    // An empty prompt reuses an existing grant without showing anything.
    client.requestAccessToken({ prompt: interactive ? '' : 'none' });
  });
}

function describeAuthError(code: unknown): string {
  switch (code) {
    case 'popup_closed':
    case 'popup_failed_to_open':
      return 'Sign-in was cancelled.';
    case 'access_denied':
      return 'Google Drive access was declined.';
    default:
      return 'Could not sign in to Google.';
  }
}

/** Forgets the token and asks Google to revoke it. */
export async function signOut(): Promise<void> {
  const current = token?.accessToken;
  token = null;

  if (!current) return;
  try {
    googleApi()?.accounts?.oauth2?.revoke?.(current);
  } catch {
    // Revocation is best-effort; the local token is already gone.
  }
}

/** True when a token is held right now. */
export function hasToken(): boolean {
  return usableToken() !== null;
}

/** Test seam. */
export function __setToken(value: GoogleToken | null): void {
  token = value;
}
