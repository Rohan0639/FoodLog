/**
 * Reading and writing one file in the user's Drive.
 *
 * The file lives in `appDataFolder` — a per-application private area. It does
 * not appear in the user's Drive listing, other apps cannot see it, and this
 * app cannot see anything else in their Drive. The scope granted is the
 * narrowest one that makes syncing possible.
 */

const FILE_NAME = 'foodlog-sync.json';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const REQUEST_TIMEOUT_MS = 20000;

export interface DriveFile {
  id: string;
  /** Drive's own version marker, used to detect a concurrent write. */
  version?: string;
  modifiedTime?: string;
}

async function request(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(describe(response.status, detail));
    }

    return response;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Google Drive did not respond. Check your connection.', { cause: err });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function describe(status: number, detail: string): string {
  if (status === 401) return 'Google sign-in expired. Sign in again to keep syncing.';
  if (status === 403) return 'Google Drive refused the request. Check the app has Drive access.';
  if (status === 404) return 'The sync file could not be found.';
  if (status === 429 || status >= 500) return 'Google Drive is busy. Sync will retry later.';
  return `Google Drive error ${status}. ${detail.slice(0, 120)}`;
}

/** The existing sync file, or null on first use. */
export async function findFile(token: string): Promise<DriveFile | null> {
  const url =
    `${DRIVE}/files?spaces=appDataFolder` +
    `&q=${encodeURIComponent(`name='${FILE_NAME}' and trashed=false`)}` +
    `&fields=${encodeURIComponent('files(id,version,modifiedTime)')}&pageSize=1`;

  const response = await request(url, token);
  const data = await response.json();
  const file = data?.files?.[0];
  return file ? { id: file.id, version: file.version, modifiedTime: file.modifiedTime } : null;
}

/** The file's contents, or null when it is empty or unreadable. */
export async function download(token: string, fileId: string): Promise<unknown | null> {
  const response = await request(`${DRIVE}/files/${fileId}?alt=media`, token);
  const text = await response.text();
  if (!text.trim()) return null;

  try {
    return JSON.parse(text);
  } catch {
    // A corrupt remote file must not take the local diary down with it.
    console.warn('[sync] The remote file was not valid JSON; ignoring it.');
    return null;
  }
}

/** Creates the file on first sync. */
export async function create(token: string, content: unknown): Promise<DriveFile> {
  const boundary = `foodlog-${Math.random().toString(16).slice(2)}`;
  const metadata = { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };

  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    `${JSON.stringify(content)}\r\n` +
    `--${boundary}--`;

  const response = await request(
    `${UPLOAD}/files?uploadType=multipart&fields=${encodeURIComponent('id,version,modifiedTime')}`,
    token,
    {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );

  const file = await response.json();
  return { id: file.id, version: file.version, modifiedTime: file.modifiedTime };
}

/** Overwrites the file. */
export async function update(token: string, fileId: string, content: unknown): Promise<DriveFile> {
  const response = await request(
    `${UPLOAD}/files/${fileId}?uploadType=media&fields=${encodeURIComponent('id,version,modifiedTime')}`,
    token,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(content),
    }
  );

  const file = await response.json();
  return { id: file.id, version: file.version, modifiedTime: file.modifiedTime };
}

/** The signed-in account's email, for display only. */
export async function accountEmail(token: string): Promise<string | null> {
  try {
    const response = await request(`${DRIVE}/about?fields=user(emailAddress)`, token);
    const data = await response.json();
    return data?.user?.emailAddress ?? null;
  } catch {
    // Cosmetic — never fail a sync over a missing label.
    return null;
  }
}
