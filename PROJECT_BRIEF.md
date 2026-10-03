# FoodLog — Project Brief

> Written for: an AI assistant (such as ChatGPT) that has never seen this project.
> Paste this whole document in, then ask questions. It describes the project as it
> is on the `main` branch in October 2026. Where something is planned rather than
> built, it says so.

---

## 1. What FoodLog is

FoodLog is a personal food and nutrition diary. Instead of searching a food
database and choosing from many similar entries, the user types what they ate in
plain English:

> "I had 2 fried eggs, a slice of whole wheat toast, and 200ml orange juice."

The app splits this into separate food items, estimates calories and macronutrients
(protein, carbs, fat, sugar, fiber), shows an editable review table so the user can
adjust portions, and then saves the confirmed items to a daily log. It also shows a
dashboard against daily goals, a monthly history, a streak counter, and a 7-day
calorie chart.

The app is built for one person's diary at a time. There are no social features,
and no one else can see a user's data.

---

## 2. Core product principles

- **Frictionless input.** Typing a meal should be as easy as texting a friend.
- **Private by default.** The diary is encrypted on the device with a passphrase only
  the user knows. The server stores nothing about users.
- **Cheap and fast.** Foods the user has logged before are resolved on the device,
  with no network call and no AI cost. The AI is used only for genuinely new text.
- **Nothing silently lost.** Deletions are recorded so they don't come back from
  other devices. Corrupt data is preserved, not discarded. Failed saves are shown.
- **The user has final say.** Every parsed item is reviewed before it is saved, and
  the user can edit any entry later.

---

## 3. Current status

| Area | Status |
|---|---|
| Natural-language logging | Built |
| Local parsing (dictionary, fuzzy matching) | Built |
| AI parsing via Google Gemini | Built |
| Nutrition label photo reading | Built (AI-based) |
| Review table before saving | Built |
| Dashboard, history, calendar, streak, chart | Built |
| Daily goals (editable in Settings) | Built |
| Encrypted on-device storage (passphrase) | Built, newly merged, **not yet tested by hand in a browser** |
| Google sign-in gate | Built, requires a Google OAuth client ID to run |
| Encrypted Google Drive sync | Built, needs real-Google testing |
| Passphrase-protected backup export and restore | Built, newly merged, **not yet tested by hand** |
| Save-failure banner | Built |
| Automated tests | 243 tests passing (unit tests for storage, parsing, sync, vault, backup) |
| Barcode scanning, PWA, reports, favourites UI | Planned, not built |
| Recovery for a forgotten passphrase | Not built and not possible by design |

---

## 4. Technology stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 3, Framer Motion
  (animation), Lucide icons, canvas-confetti. A single-page app.
- **Backend:** one Vercel serverless function, `POST /api/parse-food`, written in
  TypeScript. It is stateless apart from a short-lived in-memory cache and a
  per-IP rate limiter.
- **AI:** Google Gemini, model `gemini-3.1-flash-lite`, called only from the
  serverless function.
- **Storage on the device:** browser `localStorage`, under one key
  (`foodlog_db_v1`). The vault header is under `foodlog_vault_v1`.
- **Cloud sync (optional):** Google Identity Services (OAuth 2.0) and the Google
  Drive REST API, using the `drive.appdata` scope. This scope gives access only to
  the app's own private folder, not the rest of the user's Drive.
- **Testing:** Vitest.
- **Hosting:** Vercel.
- **Deliberately not used:** no database server, no user accounts on the server,
  no ORM, no state-management library. React hooks plus a small custom store.

---

## 5. How a meal gets logged (the parsing ladder)

The app tries the cheapest method first and only moves on when it has to.

1. **Whole-phrase cache.** If this exact sentence was parsed before, reuse the result.
2. **Personal food dictionary (on device).** Each fragment of the sentence is checked
   against foods the user has logged before:
   - exact match on the normalised name ("2 eggs" → "egg"),
   - partial match on words in a longer name ("bread" → "britannia whole wheat bread",
     only when unambiguous),
   - fuzzy match for typos ("gss" → "eggs"). This is the riskiest step, so it refuses
     whenever the evidence is weak, and it never "corrects" a word that is already a
     real food (for example, "pear" is never changed to "peas").
3. **Server parser, for whatever is left.** The serverless function:
   - applies a per-IP rate limit (30 requests per minute; 8 per minute for photos),
   - checks a small in-memory cache,
   - tries a rule-based matcher for a few staple foods (egg, banana, apple, chicken
     breast, rice, milk),
   - otherwise asks Gemini for structured JSON.
4. **Validation.** Every AI answer is checked before the user sees it:
   - calories should roughly equal 4×protein + 4×carbs + 9×fat (within 20%),
   - calorie density must not exceed 9 kcal per gram,
   - macro grams must not exceed the stated weight,
   - the structure must be valid JSON with the expected fields.
   Invalid answers are rejected, not shown.
5. **Review.** The user sees an editable table. Quantities and units can be changed,
   and macros recalculate live.
6. **Confirm.** The items are saved to the day's log. The dictionary learns from the
   confirmed items, so the next time the same food is typed it resolves on the device.

**Nutrition label photos.** The user can attach a photo of a packaged food's label.
The label figures are used in place of an estimate. The user's text still decides
what was eaten and how much. If the label can't be read confidently, the app falls
back to the normal text path and says so.

**Trust ranking for macros.** A food's stored macros come from one of three sources,
ranked from lowest to highest trust: AI estimate, label, then the user's own
correction. A lower-ranked source can never overwrite a higher-ranked one.

---

## 6. Data model (what gets stored)

The whole diary is one object, stored as one JSON document. Its main parts:

- **profile:** a single local profile (name, created date). No login credentials.
- **logs:** each logged food item: id, local date (`YYYY-MM-DD`), creation and update
  times, name, quantity, unit, calories, protein, carbs, fats, sugar, fiber.
- **goals:** daily targets (default 2000 kcal, 135 g protein, 230 g carbs, 70 g fat,
  50 g sugar, 30 g fiber).
- **settings:** confetti on or off, chat retention days, history chart length,
  last backup time, backup reminder snooze.
- **favorites:** saved foods. The data layer exists, but there is no UI yet.
- **chat:** conversation transcripts per day. These are not synced.
- **parseCache:** recent successful parses, capped at 200. Not synced.
- **foodDictionary:** foods the user has learned: names, aliases, per-unit macros,
  how often each was logged, and the trust source. Capped at 2,000 entries.
- **tombstones:** records of deletions, kept for 90 days, so a deleted item does not
  reappear from another device.
- **meta:** timestamps, the one-time migration status, and sync state.

All local dates are the user's local calendar day, not UTC. A meal logged at 11 pm
belongs to that evening.

---

## 7. Security and privacy model

This is the most recent and most important part of the design.

**On the device**
- On first use, the user creates a passphrase (minimum 8 characters). It is never
  stored or sent anywhere.
- The key is derived from the passphrase with PBKDF2-SHA256 (600,000 iterations)
  and used with AES-256-GCM to encrypt the whole diary. The key stays in memory for
  the page session only. On every page load the user enters the passphrase again.
- A small "vault header" in storage holds the salt and an encrypted check value.
  The check value tells a wrong passphrase apart from corrupt data.
- Writes are refused while the vault is locked, so a locked store can never be
  overwritten with empty data.
- Old unencrypted data is encrypted automatically on the user's first unlock.

**Google sign-in and Drive sync**
- When sync is configured, the user must sign in with Google before the diary opens.
- The sign-in grants access only to the app's private `appDataFolder` in Google Drive.
- The diary is uploaded to Drive encrypted with the same vault key, so Google stores
  only ciphertext. Downloads are decrypted on the device before they are merged.
- Merging uses pull, then merge, then push. The app never uploads before it has read
  the latest remote copy, so one device can't overwrite another device's work.
- The Google access token is kept in memory only.

**Backups**
- Export asks for a backup passphrase (minimum 8 characters). Each backup has its own
  salt and is encrypted with a key derived from that passphrase, so it opens on any
  device with just that passphrase.
- Restore asks for the passphrase first, then shows a summary of what the file
  contains before anything is replaced.
- Old unencrypted backups can still be restored.

**What cannot be recovered**
- If the user forgets the device passphrase, the local data, the Drive copy and any
  backup protected by it are unreadable. There is no reset or recovery code, by design.
- If the user forgets a backup's passphrase, that backup is unreadable.

**What the server sees**
- The text of the meal being parsed, and a label photo when one is attached.
- No names, no accounts, no diary history. The server has no database.

---

## 8. Synchronisation rules

- Each record has an update timestamp. When two copies of the same record disagree,
  the later update wins.
- A record missing on one side is kept, not treated as deleted.
- A deletion is recorded as a tombstone. A record is removed only if its tombstone is
  newer than the record's last edit. So editing an item after deleting it elsewhere
  brings it back.
- Goals and settings are single values. Whichever device changed them more recently wins.
- Chat transcripts and the parse cache are not synced. They can be rebuilt.

---

## 9. Project structure (short form)

```
foodlog/
├── api/parse-food.ts            Serverless endpoint (POST /api/parse-food)
├── backend/
│   ├── parsers/                 Orchestrator and rule-based staple matcher
│   ├── services/                Gemini client, label reader, in-memory cache
│   └── utils/                   Rate limiter, macro validator
├── shared/                      Types and text normalisation used by both sides
├── config/                      Gemini model name and endpoint
├── scripts/                     Browser-console diagnostics (local data, migration)
├── docs/                        Google sign-in setup guide and screenshots
├── README.md                    Public overview and setup
├── FILE_GUIDE.md                File-by-file walkthrough
├── PROJECT_DETAILS.md           Architecture overview
└── frontend/
    ├── src/
    │   ├── App.tsx              Startup gates: passphrase → sign-in → migration → app
    │   ├── pages/Dashboard.tsx  Main screen and parsing orchestration
    │   ├── components/          Chat, review table, dashboard, history, settings,
    │   │                        access gates, save-status banner
    │   ├── hooks/               Reactive data hooks, background auto-sync
    │   ├── lib/
    │   │   ├── security/        Crypto primitives, vault, backup format
    │   │   ├── storage/         The one module that touches localStorage; schema
    │   │   ├── services/        Data API: logs, dictionary, stats, chat, goals, backup
    │   │   ├── nlp/             Text normalisation, fuzzy matching, food vocabulary
    │   │   ├── parsing/         Offline parsing ladder
    │   │   ├── sync/            Google auth, Drive client, merge, tombstones
    │   │   └── migration/       One-time importer from the older Supabase version
    │   ├── ui/                  Design-system components and animation presets
    │   └── utils/               Unit conversion, dates, image preparation
    └── tests/                   Vitest suite (243 tests)
```

---

## 10. Setup and running it

- Requires Node.js 18 or newer and a Gemini API key.
- `npm run install:all` installs root and frontend dependencies.
- The root `.env` needs `GEMINI_API_KEY`.
- `frontend/.env` needs `VITE_GOOGLE_CLIENT_ID` to enable Google sign-in and sync.
  Without it, the app runs with the passphrase only, and sign-in is skipped.
- `npm run dev` starts the app at http://localhost:5173. The dev server runs the same
  serverless handler in-process, so parsing works locally.
- Tests: `npx vitest run` from the `frontend` folder.
- Deployment: Vercel, using `vercel.json`. The frontend builds to `frontend/dist`,
  and `api/` deploys as serverless functions.

---

## 11. Known limitations and open risks

1. **Nothing has been tested by hand in a browser since the security work landed.**
   The automated tests cover the logic, not the screens or real Google sign-in.
2. **A forgotten passphrase cannot be recovered.** A recovery code is a planned idea,
   not built.
3. **Local storage is limited to about 5 MB** per site. Very long histories will need
   IndexedDB or pruning.
4. **Rate limiting is per serverless instance**, so it is a guard against casual
   abuse, not a determined attacker. A shared limiter (for example, Upstash or Vercel
   KV) is needed for production scale.
5. **Estimates are estimates.** AI-parsed macros are approximate and vary with the
   wording. Labels and corrections are more reliable, and the app ranks them that way.
6. **The Drive copy is encrypted, but the account is still Google's.** A compromised
   Google account could delete the file, though not read it without the passphrase.
7. **Passphrase strength is the user's responsibility.** The minimum is 8 characters.
   Nothing checks that it is strong.
8. **Stale file in the repo.** `DOCUMENTATION.md` describes an older version (before
   sync and the food dictionary) and should be treated as history.
9. **Unused code.** `frontend/src/utils/imageScan.ts` exports a `scanLabel` function
   that calls an endpoint that does not exist. The real label flow goes through the
   parse endpoint.

---

## 12. Decisions already made (and why)

- **No database server.** Keeps hosting cheap and means the server never holds diary
  data. The trade-off is that the user is responsible for their own backups or Drive sync.
- **Google Drive as the sync store.** The user already has it, the app only gets
  access to its own folder, and it avoids running a backend.
- **Passphrase encryption rather than server-side accounts.** Only the user can read
  the data, but a forgotten passphrase means permanent loss.
- **Per-backup salt.** So a backup opens on any device with the passphrase, rather
  than only on the device that made it.
- **Deterministic matching before AI.** Common foods resolve reliably and cheaply.
  The AI handles only what the deterministic steps can't.
- **Refuse rather than guess.** Fuzzy matching and validation prefer asking the user
  or falling back over a confident wrong answer.

---

## 13. Questions this document can help answer

Examples of what to ask an AI assistant with this brief:

- What are the weakest parts of the security design, and how would you attack them?
- How would you add a recovery code for a forgotten passphrase without weakening encryption?
- Is the parsing ladder sound? Where could a wrong match slip through?
- What is the best way to move from localStorage to IndexedDB, and what would change?
- How would you test the passphrase, sign-in and sync flows end to end?
- What would it take to support multiple profiles on one device?
- Which parts would need to change to scale this to thousands of users?
- Review the merge and tombstone rules: can any sequence of edits lose data?
- Suggest an interview-ready explanation of the design, with trade-offs.
