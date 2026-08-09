# Turning on Drive sync

FoodLog can keep one diary across every device you use, by storing it in a
private folder inside **your own Google Drive**. There is no server, no account
system, and no database — the app never sees your data on any machine but yours.

Until you complete these steps the app works exactly as before, entirely
locally, and the sync section in Settings explains that it is switched off.

---

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com/>
2. Create a project (any name — "FoodLog" is fine)

## 2. Enable the Drive API

1. **APIs & Services → Library**
2. Search for **Google Drive API** → **Enable**

## 3. Configure the consent screen

1. **APIs & Services → OAuth consent screen**
2. User type **External**, then fill in the app name and your email
3. On the **Scopes** step, add:
   ```
   https://www.googleapis.com/auth/drive.appdata
   ```
   This is the narrowest Drive scope there is. It grants access to a private
   per-app folder and **cannot read any of your other Drive files.**
4. Add your own Google account under **Test users**

> ### This is the step everyone misses
>
> While the client is in **Testing**, Google blocks *every* account that is not
> on the test-user list — including the one that created the project. You get:
>
> ```
> Error 403: access_denied
> FoodLog has not completed the Google verification process
> ```
>
> The fix is not in the code. Go to **Google Auth Platform → Audience**
> (older console: **APIs & Services → OAuth consent screen**), find
> **Test users**, and add every Google account you will sign in with — one per
> device is not needed, but each *account* is. Up to 100.
>
> Testing mode is the right choice for personal use. Moving to **Production**
> avoids the list, but `drive.appdata` is a scope Google treats as sensitive,
> so unverified apps show an "unverified app" warning that users must click
> past. For a diary you and a few others use, test users is cleaner.

## 4. Create the OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**
2. Application type: **Web application**
3. Under **Authorised JavaScript origins**, add every origin you will use:
   ```
   http://localhost:5173
   https://your-app.vercel.app
   ```
4. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`)

## 5. Give it to the app

Add it to `frontend/.env`:

```
VITE_GOOGLE_CLIENT_ID=1234567890-abcdefg.apps.googleusercontent.com
```

Restart the dev server. **Settings → Sync across devices** will now offer
"Sign in with Google".

---

## Using it on a second device

1. Open the app there and sign in with the same Google account
2. It downloads the shared file and **merges** it with whatever is already on
   that device

Nothing is overwritten in either direction. If you had two weeks of logging on
your phone and three days on your laptop, you end up with all of it.

---

## Things worth knowing

**HTTPS is required in production.** Google will not run the OAuth flow over
plain HTTP. `http://localhost` is specifically exempt, so local development
works.

**Sync runs by itself.** At startup, about eight seconds after you stop making
changes, and whenever the network comes back. There is a **Sync now** button in
Settings if you want to force it.

**Nothing here blocks logging.** The app writes locally first, every time.
If Drive is unreachable the entry is still saved and syncs later.

**Conflicts resolve by most-recent-edit.** Edit the same meal on two devices
while both are offline, and the later edit wins once they reconnect. For a food
diary that is almost always right, but it does mean the earlier edit is lost.

**Deleting works properly across devices.** A deletion leaves a marker that
travels, so removing a meal on your phone also removes it on your laptop rather
than the laptop pushing it back.

**Chat history and the parse cache are not synced.** They are per-device
scrollback and a per-device speed-up; attached label photos would make the file
large for no benefit. Your food logs, your learned foods, your goals and your
settings all sync.

**Signing out changes nothing about your data.** It disconnects the account and
leaves both the local diary and the Drive copy alone.

---

## If something goes wrong

Errors appear under **Settings → Sync across devices**, with the last failure
and when it last succeeded.

| Message | Cause |
|---|---|
| **403 `access_denied`** — "has not completed the Google verification process" | The account is not on the **Test users** list. See step 3 — this is the most common failure by a wide margin |
| **`redirect_uri_mismatch`**, or the popup closes instantly | The origin is missing from **Authorised JavaScript origins**. It must match exactly, including port: `http://localhost:5173` |
| "Google sign-in expired" | Token lapsed — sign in again |
| "Google Drive refused the request" | Scope not granted on the consent screen |
| "Google Drive is busy" | Rate-limited or a temporary outage; it retries |
| "The file in Drive is not a FoodLog backup" | Something else wrote to the file; sync stops rather than merge it |

None of these are code faults — every one is a setting in the Google Cloud
Console, and the app is reporting Google's answer faithfully.

**Export is still your real backup.** Sync mirrors your data; it does not
replace a copy you hold yourself. If you delete a meal it disappears everywhere,
by design — that is the point, but it is not undo. Take an occasional export
from **Settings → Your data**.
