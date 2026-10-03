# FoodLog — File-by-File Guide

> Companion to `PROJECT_DETAILS.md` (architecture overview) and `DOCUMENTATION.md`
> (older, partially stale — written before Drive sync, the food dictionary and
> image scanning existed). This document walks through **every source file**,
> what it does, and how it connects to the rest of the app. Generated from a
> direct read of the code on 2026-09-22.

---

## 1. Root & config

| File | What it does |
|---|---|
| `package.json` | Root workspace scripts: `install:all` (installs root + frontend deps), `dev`/`dev:frontend` (runs Vite). Only devDependency is `@vercel/node` types, since the actual API code lives at the root and is typed against them. |
| `tsconfig.json` | Compiles `api/`, `backend/`, `shared/`, `config/` only (frontend has its own). Target ES2020, CommonJS modules — matches the Node runtime Vercel functions run under. |
| `vercel.json` | Deployment config: builds the frontend (`npm run build --prefix frontend`) into `frontend/dist`, and rewrites every non-`/api/*` path to `/index.html` (SPA routing). `api/parse-food.ts` is auto-detected as a serverless function by its location. |
| `.env` / `.env.example` | Root env vars: `GEMINI_API_KEY` is the only one the backend needs. |
| `README.md` | Short pitch/marketing description of the product. |
| `DOCUMENTATION.md` | An earlier architecture write-up. **Stale**: describes a pre-sync, pre-dictionary, Supabase-auth-gated version of the app. Kept for history; `PROJECT_DETAILS.md` and this file reflect the current code. |
| `PROJECT_DETAILS.md` | Up-to-date architecture overview: tech stack, parsing ladder, key algorithms, repo layout. Good starting point before this file. |

---

## 2. `api/` — the one serverless endpoint

**`api/parse-food.ts`** — `POST /api/parse-food`, the app's only backend route.
- Sets permissive CORS headers, handles `OPTIONS` preflight.
- Applies IP-based rate limiting (`backend/utils/rateLimit.ts`) before doing any work, since the endpoint has no auth and would otherwise be an open door to the Gemini quota.
- If the request carries an `image` (a nutrition label photo), validates its MIME type and size, then routes straight to `parseWithLabel` in `labelReader.ts` — bypassing cache and the rule parser, since a label is stronger evidence than either.
- Otherwise: normalizes the text, checks the in-memory server cache, then calls `parseFoodOrchestrator` (rules → Gemini), and caches a successful result.
- Photo requests get a tighter per-window allowance (`IMAGE_LIMIT_PER_WINDOW = 8`) since vision calls cost more.

---

## 3. `backend/` — parsing & AI logic

**`backend/parsers/index.ts`** — `parseFoodOrchestrator(text)`. Two-tier: tries the rule-based parser first; on a miss (`null`), falls back to Gemini. This is the function `api/parse-food.ts` calls.

**`backend/parsers/parser.ts`** — the rule-based tier.
- Hardcodes a 6-item `FOOD_DATABASE` (egg, banana, apple, chicken breast, rice, milk) with per-unit macros and aliases.
- Splits input on `and`/`,`/`+` (never `with`, since "burger with cheese" is one dish).
- Matches each part by longest alias, with a **coverage gate**: if the matched alias covers less than 50% of the phrase's characters, it refuses (e.g. "rice" inside "KFC rice bowl" would otherwise wrongly match plain rice) — this hands ambiguous or branded phrases to the LLM instead of guessing.
- If any single part fails to match, the *whole* request falls through to Gemini rather than returning partial results.

**`backend/services/gemini.ts`** — calls `gemini-3.1-flash-lite` for text-only parsing.
- Builds a large system prompt enforcing strict JSON output, preservation of brand/preparation detail, and realistic macro estimates.
- Retries once on a 429/5xx or timeout (20s per attempt, `AbortController`-based), fails immediately on 4xx.
- Extracts the first `{...}` JSON block from the response text, parses it, and runs it through `validateGeminiResponse` before returning.

**`backend/services/labelReader.ts`** — `parseWithLabel(text, imageBase64, mimeType)`, the multimodal (vision) path.
- Sends a different prompt: the user's *text* decides what/how much was eaten, the *label photo* supplies every nutrition figure — the model is told never to estimate a number the label shows, and to scale the label's stated serving to the amount the user said they ate.
- If the model can't read the label confidently, it's instructed to return `{"status":"label_unreadable"}` rather than guess; the caller (`Dashboard.tsx`) then transparently falls back to the ordinary text parser.
- Runs its own looser plausibility check (`isImplausible`) — real packaged foods can legitimately be calorie-dense (oils ~900kcal/100g), so this only rejects physically impossible readings, not merely unusual ones.
- Uses `temperature: 0`, since reading printed digits off a photo is not a creative task.

**`backend/services/cache.ts`** — a trivial in-memory `Map<string, GeminiResponse>` for warm-lambda parse results. Reset on cold start; that's acceptable because the client also caches (`parseCacheService.ts`), persistently.

**`backend/utils/rateLimit.ts`** — fixed-window limiter, 30 requests/60s per client IP (`x-forwarded-for`/`x-real-ip`), with a `MAX_TRACKED_CLIENTS` cap and lazy sweep of expired windows. Explicitly documented as **per-instance**, not distributed — a guard against casual abuse, not a determined attacker (Upstash/Vercel KV is called out as the real upgrade).

**`backend/utils/validator.ts`** — `validateGeminiResponse(data)`, throws on the first violation found:
- Structural checks (status field, items array, totals object, numeric types).
- Logical limits: no negative macros, total calories ≤ 5000.
- **Macro consistency**: `calories ≈ 4×protein + 4×carbs + 9×fat`, within 20%.
- **Calorie density**: ≤ 9 kcal per gram/ml (extracted from the item's `quantity` string).
- **Weight consistency**: sum of protein+carbs+fat grams can't exceed the stated weight (5% rounding allowance).

---

## 4. `shared/` — code used by both frontend and backend

**`shared/types.ts`** — `ParsedItem`, `ParsedTotals`, `GeminiResponse`: the wire format every parser (rules, Gemini, label reader, and the frontend's local dictionary matcher) produces, so the review table and confirm flow don't care which one answered.

**`shared/normalize.ts`** — `normalizeFoodInput(text)`: lowercases, trims, and collapses unit spelling variants (`gms`/`gm`/`g` → `grams`, `l` → `liters`, `pcs` → `pieces`) before a request reaches either parser tier.

---

## 5. `config/`

**`config/index.ts`** — `GEMINI_CONFIG`: model name (`gemini-3.1-flash-lite`) and API URL. The single place to change model versions.

---

## 6. `scripts/` — manual diagnostic tools (not part of the app bundle)

**`scripts/diagnose-local-data.js`** — paste into the browser console. Read-only report of what's actually in `foodlog_db_v1`: entry/day counts, migration status, and any legacy Supabase-era keys still present (the backup that's never deleted).

**`scripts/verify-migration.js`** — paste into the browser console **for a user upgrading from the old Supabase build**. Re-fetches their Supabase history and diffs it field-by-field against local storage, plus derived data (per-day totals, calendar, streak, weekly average, 7-day chart) — confirming the one-time migration (§ `legacyMigration.ts`) lost nothing. Entirely read-only; never modifies either store.

---

## 7. `frontend/` — build config

| File | What it does |
|---|---|
| `vite.config.ts` | Dev server on port 5173 (`strictPort`). Notably includes a custom `vercelApiDevServer` Vite plugin that runs `api/parse-food.ts` **in-process** during `npm run dev` by loading it through Vite's SSR pipeline and adapting Node's req/res to the slice of the Vercel handler signature it actually uses — so there's one parsing implementation, not a duplicated dev version. |
| `tailwind.config.js` | Dark monochrome (`zinc`) theme tokens, custom shadows/gradients/animations used throughout the `ui/` primitives. |
| `postcss.config.js` | Standard Tailwind + Autoprefixer pipeline. |
| `vitest.config.ts` | Test runner config for the `tests/` suite. |
| `tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json` | Project-reference split: app code vs. Vite/Node config typechecking. |
| `eslint.config.js` | ESLint 10 + typescript-eslint + react-hooks/react-refresh plugins. |
| `index.html` | SPA shell Vite mounts into. |

---

## 8. `frontend/src/` — entry & root

**`main.tsx`** — React 19 entry point; renders `<App />` in `StrictMode`.

**`App.tsx`** — the app shell. No sign-in screen (local-first, no accounts): on mount it checks `isStorageAvailable()` (fails gracefully in Safari private mode with a "storage is switched off" card), then awaits `runLegacyMigration()` (a one-time, never-blocking import of any pre-existing Supabase data — see §`legacyMigration.ts`), then loads the local `Profile` and renders `<Dashboard />`. Shows an animated loading splash while this resolves (usually imperceptible after the first launch, since migration is a one-shot).

**`types.ts`** — frontend-only types: `FoodItem`, `FoodEntry` (the UI's working representation of a logged/pending food, richer than the storage `FoodLogRecord`), `Message` (chat bubble, with optional `pendingFoods`/`parsedFoods`/`attachmentUrl`), `NutritionSummary`, `DailyGoal`, plus re-exports of `ParsedItem`/`GeminiResponse` from `shared/types`.

**`App.css` / `index.css`** — global styles layered on top of Tailwind (custom CSS variables for spacing/sizing tokens like `--navbar-h`, `--avatar-sm`, gradient/glow utility classes like `.grad-accent`, `.shadow-glow`, `.chip`, `.card`).

---

## 9. `frontend/src/pages/Dashboard.tsx` — the main screen

The largest component; owns almost all app-level state and orchestration:
- **`analyzeFood(text, image)`** — the client-side entry point for parsing, implementing the full ladder described in `PROJECT_DETAILS.md`: whole-phrase parse cache → per-fragment local dictionary match → AI, asked only about the fragments nothing local could resolve. If an image is attached, it skips straight to the server's label-reading path and falls back to ordinary parsing if the label can't be read (`LabelUnreadableError`).
- **`handleSendMessage`** — pushes the user's chat bubble, calls `analyzeFood`, turns the result into `FoodEntry[]`, and attaches them to a bot message as `pendingFoods` (the review table). Recognizes `clear`/`reset` as commands.
- **`handleConfirmLog`** — rescales each pending item's macros to its (possibly user-edited) quantity, persists them via `useFoodLog().addEntries`, and — the key learning step — calls `dictionaryService.learnMany()` so the app remembers this food for next time (label-sourced items are learned as `'label'`, everything else as `'gemini'`). Fires confetti if enabled.
- **`handleUpdateFoodEntry`** — an inline edit from the dashboard; re-learns the entry with `'user'` provenance, which outranks any future AI guess for that food.
- Midnight rollover: a self-re-arming `setTimeout` (`msUntilMidnight`) advances `todayDateStr`, reloads the (empty) day's transcript, and posts a rollover message — so the app can stay open across days without a reload.
- Renders `Navbar`, `FoodLogger` (chat/left panel), `NutritionDashboard` (stats/right panel — always both on desktop, tab-switched on mobile via `TABS`), and lazy-loads `SettingsSheet`/`MyFoodsSheet` only when opened.
- Calls `useAutoSync()` unconditionally — it's a no-op when Drive sync isn't configured.

---

## 10. `frontend/src/components/`

**`Navbar.tsx`** — brand header + online/offline indicator (reflects whether the *AI parser* is reachable, not whether the app itself works — logging is always local) + settings button.

**`FoodLogger.tsx`** — the chat panel container: renders `EmptyState` on first use, otherwise the `ChatMessage` list (with `AnimatePresence`/`popLayout` for smooth insert/remove), a typing-indicator bubble, and the floating `ChatInput`.

**`ChatInput.tsx`** — auto-resizing textarea (Enter to send, Shift+Enter for newline) plus an optional attach-photo control. Two separate hidden `<input type=file>` elements — one with `capture="environment"` for the camera, one without for the gallery — because the `capture` attribute can't be conditionally removed once set on a given input. Downscales the picked image via `prepareImage` before attaching.

**`ChatMessage.tsx`** — renders one bubble (user or bot), including an attached label photo, the typing-dots animation, the embedded `ReviewConfirmTable` when this message is the active pending review, and a "logged receipt" summary card once confirmed. Wrapped in `React.memo` since a transcript can hold hundreds of these and only the actively-reviewed one should re-render on every keystroke.

**`ReviewConfirmTable.tsx`** — the editable pre-confirm table: quantity stepper (+/- buttons sized by unit, direct numeric input), unit `<select>`, live-recalculated macros per row (via `scaleMacrosByQuantity`) and a running total, a badge showing whether a row came from the dictionary ("your foods") vs. a fuzzy guess ("guess" — with the match confidence in its tooltip), and Confirm/Discard actions.

**`EmptyState.tsx`** — first-run screen with four tappable example prompts that call `onSelectSuggestion` (which just sends that text as if typed).

**`BackupReminder.tsx`** — a dismissible nudge shown above the Today view, gated by `backupService.assessRisk()` (only appears once there's ≥15 entries and either no backup or one older than 21 days). "Not now" snoozes it for 7 real days rather than just hiding it for the session.

**`NutritionDashboard.tsx`** — the right-hand panel, tab-switched between **Today** (calorie ring via `ProgressRing`, macro bars, today's logged-food list with inline delete-confirm and edit) and **History** (lazy-loaded `CalendarView` + `HistoryStatsView` + `DayLogView`, all fed by one shared `useHistoryData` call so nothing double-fetches). Lazy-loads the History chunk, `EditFoodModal`, and shows a matching `HistorySkeleton` while it loads.

**`CalendarView.tsx`** — month grid with logged-day dots and a sliding month transition. Notably computes "should the visible month jump to follow the selected date" **during render** (`monthTransition()`, a pure function from `utils/date.ts`) rather than in a `useEffect` — the code comments explain this was a deliberate fix for a double-render/flash-of-wrong-month bug.

**`HistoryStatsView.tsx`** — streak + weekly-average tiles, and a 7-day calorie bar chart with hover/selected tooltips; bars are clickable to jump `DayLogView` to that day.

**`DayLogView.tsx`** — a single day's itemized timeline with a daily-summary macro tile row and prev/next day navigation.

**`EditFoodModal.tsx`** — edits name/quantity/unit of a logged entry. Macros are **derived during render** via `useMemo(() => scaleMacrosByQuantity(...))` rather than held as separate state synced by an effect — the comment explains this used to double-render and lag the displayed numbers by a frame.

**`SettingsSheet.tsx`** — daily-goal editor (six numeric fields, all already persisted by `goalService`, this is just the first UI exposing them), a confetti on/off toggle, a summary + entry point into `MyFoodsSheet`, the embedded `SyncSection`, and Export/Restore backup controls (restore is confirmed via a dialog showing what the incoming file contains, since it fully replaces the store).

**`MyFoodsSheet.tsx`** — browsable/searchable view of the learned food dictionary. Each entry can be inline-edited (brand, product name, per-unit macros) or deleted, with a confirm step on delete. Shows provenance badges ("from label", "edited").

**`SyncSection.tsx`** — embedded in Settings. Three states: not configured (no `VITE_GOOGLE_CLIENT_ID`), configured-but-signed-out (sign-in button), signed-in (account email, last-synced time, manual "Sync now"/"Disconnect"). Framed in the UI copy as "your data, in your own Drive" rather than an account system.

---

## 11. `frontend/src/hooks/`

**`useFoodLog.ts`** — today's (or any date's) log entries plus `addEntries`/`updateEntry`/`deleteEntry`/`clearDay`, all derived from the store via `useDbRevision()` rather than mirrored into local state — so there's no optimistic copy that can drift from what's actually persisted.

**`useChatMessages.ts`** — a day's chat transcript, loaded from `chatService` (or a welcome message if empty), auto-saved on change, and pruned per the retention setting. Keeps `{date, messages}` as one state object so a day rollover can't write the new day's messages under the wrong key mid-transition.

**`useHistoryData.ts`** — everything the History tab needs (logged days for the visible month, the selected day's summarized log, streak/average/chart stats) in one hook, memoized against `useDbRevision()`. Explicitly documented as replacing "five Supabase queries."

**`useDbRevision.ts`** — `useSyncExternalStore(subscribe, getRevision, getRevision)` over `localDb.ts`'s revision counter. The mechanism that makes every derived view (history, calendar, stats) refresh after *any* write anywhere in the app — including one made in another browser tab.

**`useOnlineStatus.ts`** — wraps `navigator.onLine` + the `online`/`offline` window events. Only meaningful for whether the AI parser can be reached; logging itself never depends on it.

**`useAutoSync.ts`** — the engine behind background Drive sync. Syncs on three triggers: once at startup (`syncService.resume()`, silent), 8 seconds after local writes settle (debounced via the `subscribe()` callback from `localDb.ts`, so one logging action that writes several times doesn't trigger several uploads), and when the network comes back online. All failures are swallowed silently by design — errors surface passively in `SyncSection`, not as interruptive banners.

---

## 12. `frontend/src/lib/storage/` — the persistence engine

**`schema.ts`** — the single source of truth for the DB shape (`FoodLogDb`): `logs`, `goals`, `settings`, `favorites`, `chat`, `parseCache`, `foodDictionary`, `tombstones`, `meta` (with `migration` and `sync` sub-state). Also defines `SCHEMA_VERSION`/`SCHEMA_MIGRATIONS` (for breaking changes) and `normalizeDb()` (back-fills missing keys on every read, so purely additive changes need no migration step and a store from an older build never crashes the app). `newId()` provides a `crypto.randomUUID` UUID with manual fallbacks for non-secure contexts.

**`localDb.ts`** — **the only module allowed to call `localStorage` directly** (enforced by convention/comment, not by tooling). Everything above it works with plain objects. Once a vault exists, the diary is stored encrypted under `foodlog_db_v1`, and writes are refused while locked. Key design points:
- The in-memory `current` copy is authoritative, so reads stay synchronous. It is invalidated on a `storage` event from another tab.
- `loadStoredDb()` decrypts the store after unlock. A plaintext store from before encryption is adopted and re-saved encrypted.
- Saves are queued and sealed asynchronously. Failures go to `getPersistError()` and the `SaveStatus` banner, and `flushPersist()` waits for queued saves (used by tests).
- `updateDb(mutate)` is the single read-modify-write primitive every service uses — the one place persistence, cache invalidation, and change notification (`notify()`, which powers `useDbRevision`) happen.
- `StorageUnavailableError` is thrown when a write is attempted while locked. Quota and failure messages are reported through `getPersistError()`.
- A payload that fails `JSON.parse` is never silently discarded — it's copied to a timestamped `foodlog_db_v1__corrupt__<ts>` key first.
- `exportDb()`/`importDb()` back the backup feature.

---

## 13. `frontend/src/lib/services/` — the data API

Components/hooks talk to storage exclusively through these; nothing above this layer knows `localStorage` exists.

- **`index.ts`** — barrel re-exporting every service as a namespace (`logService`, `dictionaryService`, etc.).
- **`logService.ts`** — food-log CRUD: `getLogsByDate`, `getLoggedDatesInMonth`, `getCaloriesByDate`, `addLogs`, `updateLog`, `deleteLog` (records a tombstone), `clearDate`, and `mergeLogs`/`hasAllIds` (used by both the legacy migration and Drive sync merge). `toRecord()` always derives `date` from `createdAt`, so the two can never disagree.
- **`dictionaryService.ts`** — the learned-food store; see §14 below for the matching algorithms it backs. Owns `learn()`/`learnMany()` (confirm-time learning with source-rank precedence — `user` > `label` > `gemini`, so a hand correction or a scanned label is never silently overwritten by a later estimate), `findByTokens()` (partial-name matching, e.g. "bread" finding "britannia whole wheat bread"), `savePackagedFood()` (from a scanned label), `search()` (for MyFoodsSheet), and LRU-style `prune()` capping the dictionary at 2000 entries.
- **`statsService.ts`** — `getStreak()` (consecutive logged days, tolerant of *today* alone being unlogged so far) and `getHistoryStats()` (streak + weekly average + 7-day chart series), all pure in-memory scans instead of the old build's per-render Supabase round-trips.
- **`chatService.ts`** — per-day transcript get/save, `getPendingReview()` (recovers an unfinished review table after a reload — a message still carrying `pendingFoods` means the user never confirmed or discarded it), and `pruneChats()` (retention-window cleanup that never touches actual food logs, only conversational scrollback).
- **`goalService.ts`** — daily macro targets: get/set/reset. Backs `SettingsSheet`'s goal editor.
- **`settingsService.ts`** — app preferences (confetti toggle, chat retention, history graph days, backup reminder state).
- **`favoritesService.ts`** — CRUD for saved/favorite foods. **Has no UI yet** — fully wired data layer waiting for a feature.
- **`profileService.ts`** — the single local `Profile` (no credentials — created on first launch, replaces Supabase's `auth.getUser()`).
- **`parseCacheService.ts`** — the client-side whole-phrase parse cache (`foodlog_db_v1.parseCache`, capped at 200 entries, LRU-evicted by `cachedAt`). Only *successful* parses are cached — caching an "invalid" verdict would permanently reject a phrase that might parse correctly later.
- **`backupService.ts`** — export/restore. `assessRisk()` backs the `BackupReminder` nudge logic; `downloadBackup()` triggers a JSON file download via an object URL (not a data URI, to avoid the browser's URL length ceiling); `inspect()` validates a file really is a FoodLog backup (checks `logs` array + `schemaVersion`) before `restore()` is allowed to overwrite the store.

---

## 13a. `frontend/src/lib/security/` — encryption

**`crypto.ts`** — the primitives: PBKDF2-SHA256 key derivation (600,000 iterations; lowered only in tests via `__setIterations`), AES-256-GCM `encryptText`/`decryptText`, and base64 helpers. GCM authenticates the ciphertext, so tampering or a wrong key fails loudly.

**`vault.ts`** — the device vault. `createVault(passphrase)` writes a header (`foodlog_vault_v1`: salt plus an encrypted check value) and holds the key in memory. `unlockVault` verifies the passphrase against the check value, so a wrong passphrase is distinguishable from corrupt data. `sealJson`/`openJson` encrypt and decrypt any JSON, and `isEnvelope` recognises encrypted values. The key is never persisted, so each page load needs the passphrase again.

**`backup.ts`** — passphrase-sealed backup files. Each backup has its own salt, so it opens on any device with just the passphrase, independent of the device vault. `sealBackup` and `openBackup` are used by `backupService.ts`.

## 13b. `frontend/src/components/AccessGate.tsx` — startup gates

**`VaultGate`** creates the passphrase on first use or asks for it on later visits, then loads the diary. **`SignInGate`** requires Google sign-in when sync is configured, and tries a silent sign-in first. Both are used by `App.tsx`.

---

## 14. `frontend/src/lib/nlp/` — the text-understanding layer

**`normalizeText.ts`** — deterministic (no guessing) phrase parsing: `parsePhrase("2 eggs")` → `{quantity: 2, unit: null, foodKey: "egg", ...}`. Handles written numbers ("two", "couple", "half"), weak articles ("a"/"an" only fill the quantity slot if nothing stronger was said, so "a couple of eggs" doesn't read as one egg), unit-word collapsing, filler-word stripping, singularization (with a `NOT_A_PLURAL` guard for words like "hummus"/"asparagus"), and a token-sorted `foodKey` so "brown rice" and "rice brown" resolve identically. `surfaceForms()` generates the plural spelling of an alias too, since a typo of a plural should be compared against the plural, not the singular. `splitParts()` is the shared "and/,/+/&, never with" splitter used by both the local matcher and Dashboard's AI-alignment logic.

**`foodVocabulary.ts`** — a ~250-word list of known food nouns. Its only job: telling a *misspelling* apart from a *different, real food*. "gss" isn't a word, so correcting it to "eggs" is safe; "pear" *is* a word, so a fuzzy matcher must never quietly rewrite it to "peas" even though they're letter-distance-close. `isKnownFoodPhrase()` gates the fuzzy matcher in `fuzzy.ts`.

**`fuzzy.ts`** — the only place in the app that guesses. Implements:
- `editDistance()` — optimal string alignment (handles adjacent-character transpositions, since "engg" for "eggs" is one slip, not two).
- `jaroWinkler()` — rewards a shared prefix, since food typos usually agree on the first letters.
- `findBestMatch(query, candidates)` — combines both, adds a small frequency-based boost (`frequencyBoost`, capped at 0.15, log-scaled by `timesLogged`), and refuses to answer (`null`) in several cases by design: the query is already a known food word (handed to the parser instead, since letter-distance can't tell "pear" from a misspelling of "peas"); nothing clears `MIN_CONFIDENCE` (0.72); the top two candidates are too close to separate (`MIN_MARGIN` 0.08); or the query is short (<4 chars) without either strong similarity or a well-established, unambiguous frequency prior. `couldBeTypoOf()` additionally guards against Jaro-Winkler's known failure mode of scoring a short prefix-match unreasonably high against a much longer, unrelated name.

---

## 15. `frontend/src/lib/parsing/localParser.ts` — ties NLP + dictionary together

`matchPhrase(text)` runs the full offline ladder per fragment (split via `splitParts`): exact alias hit → partial/token-contained match (`dictionaryService.findByTokens`) → fuzzy guess (`findBestMatch`) → unmatched (handed to the AI). `toParsedItem()` converts a match into the same `ParsedItem` shape the AI/rules produce (via `scaleMacrosByQuantity`, so a dictionary hit behaves identically to an AI result when later rescaled), tagging it with `source: 'dictionary'`, `matchStage`, and `matchConfidence` so the review table can badge it. `buildResponse()` assembles a full `GeminiResponse`-shaped reply purely from local matches, with a different confirmation message when any item was a guess ("I think you meant... — from foods you've logged before").

---

## 16. `frontend/src/lib/sync/` — Google Drive sync engine

**`googleAuth.ts`** — Google Identity Services OAuth2 token flow, scoped to `drive.appdata` only (the app's own private folder — cannot see the rest of the user's Drive). Loads the GIS script on demand. Token is kept **in memory only**, never `localStorage` — the comment explains this trade-off explicitly (a Drive-scoped credential shouldn't be readable by any script on the origin, even at the cost of re-authorizing silently on every load). `getAccessToken(interactive)`: `interactive=false` is used for silent startup/background resume (`prompt: 'none'`, fails quietly rather than popping a dialog); `interactive=true` is only ever called from a real user click.

**`driveClient.ts`** — raw REST calls against one file (`foodlog-sync.json`) in `appDataFolder`: `findFile`, `download`, `create` (multipart upload), `update` (media upload), `accountEmail` (cosmetic, for the UI). Each request has a 20s timeout and maps HTTP status codes to human-readable error strings (401 → "sign-in expired", 403 → Drive access issue, 429/5xx → "busy, will retry").

**`tombstones.ts`** — `record()` marks ids as deleted (called by `logService.deleteLog`/`clearDate` and `dictionaryService.remove`/`clear`); `merge()` combines tombstone lists from two devices keeping the later `deletedAt` per record; `prune()` drops tombstones older than `TOMBSTONE_RETENTION_DAYS` (90) so the list doesn't grow forever, on the assumption every device has synced within that window.

**`merge.ts`** — the reconciliation algorithm, deliberately **pure** (no storage access, so its "nothing is lost" property is testable): a record present on only one side is kept; a record on both sides has the later `updatedAt` win; a record is removed only if a tombstone for it is newer than its own `updatedAt` (so editing a meal after deleting it elsewhere on purpose brings it back — the edit is the later intent). Chat transcripts and the parse cache are deliberately **excluded** from sync (per-device scrollback/speed-up, can be large with inlined image attachments, and losing them costs nothing). Goals/settings are single objects, not collections, so they're taken wholesale from whichever device changed them more recently (`preferencesUpdatedAt` vs. local `meta.updatedAt`).

**`syncService.ts`** — the orchestrator: `signIn()`, `signOut()`, `sync()` (de-duped via an `inFlight` promise so overlapping calls share one run), `resume()` (silent startup restore). `sync()`'s core discipline, stated explicitly in the file's own comment, is **pull → merge → push, never push-first** — uploading first would overwrite whatever another device wrote since this one last looked. Rejects a downloaded file that parses as JSON but isn't a recognizable FoodLog payload (`isValidPayload`) rather than merging garbage in.

---

## 17. `frontend/src/lib/migration/legacyMigration.ts` — one-time Supabase importer

The only file in the project that still knows Supabase ever existed; self-disabling once it reports `completed`. Recovers a previous build's cloud history **without requiring sign-in**, by reading the session token the old Supabase-JS client left in `localStorage` (`sb-<ref>-auth-token`, handling all three shapes that library has used historically, including a `base64-` prefixed payload) and hitting the REST API directly with `fetch` — refreshing the token first if expired. Also imports the old offline log cache (`food_logs_local_*` keys) and old per-day chat transcripts (`chat_messages_<uid>_<date>` keys), local-only steps that run before anything network-dependent, so they can't be lost to a failed request. Idempotent (guarded by persisted `MigrationState` + an in-flight promise), non-destructive (merges by id, existing records always win, legacy keys are never deleted), and verified (status only flips to `completed` after re-reading storage and confirming every imported id is actually present — see `hasAllIds` in `logService.ts`). Retries up to 5 attempts across launches on failure.

---

## 18. `frontend/src/ui/` — shared design system

**`primitives.tsx`** — the component kit everything else composes: `Card`, `Button` (5 variants), `IconButton`, `Chip`, `SectionTitle`, `CountUp` (animates via a `requestAnimationFrame` loop writing directly to a DOM node's `textContent`, deliberately avoiding React state so a 60-frame count-up doesn't trigger 60 re-renders of its parent), `ProgressRing`/`ProgressBar`, `Skeleton`, `Blobs` (ambient background, `pointer-events-none` and transform-only so it never intercepts taps), `Modal` (centered dialog on desktop, bottom sheet on mobile, closes on Escape/backdrop click), `ConfirmDialog`.

**`motion.ts`** — the app's single animation vocabulary (Framer Motion `Variants`/`Transition` objects: `spring`, `cardIn`, `stagger`, `bubbleIn`, `listItem`, `monthSlide`, etc.) so every screen moves consistently instead of each component inventing its own timings. Everything animates only `transform`/`opacity` for GPU compositing.

**`cx.ts`** — a minimal conditional className joiner (`cx(...)`), kept in its own file (rather than inline in a component) specifically so component files stay component-only and hot-reload cleanly under React Fast Refresh.

---

## 19. `frontend/src/utils/`

**`unitConverter.ts`** — `UNIT_CATEGORIES`/`UNIT_FACTORS` (weight/volume/count, with conversion factors to each category's base unit), `DEFAULT_PIECE_WEIGHTS` (banana 120g, egg 50g, etc. — used for count↔weight/volume cross-category conversion), and `scaleMacrosByQuantity()` — the single function every macro-rescaling call site in the app uses (review table, edit modal, confirm), with a fixed, documented rounding contract (calories to integer, everything else to 1dp, floored at 0).

**`date.ts`** — every date bucket in the app is a **local** calendar day, never UTC (documented explicitly: an 11pm meal belongs to that evening). Provides `getLocalIsoDate`, `parseLocalDateString` (coerces any timestamp shape into a `YYYY-MM-DD` bucket), `addDays`, `recentDates`, `monthBounds`, `monthTransition` (the pure function behind `CalendarView`'s render-time month-jump logic), and `msUntilMidnight` (drives Dashboard's daily-reset timer).

**`imageScan.ts`** — `prepareImage(file)`: loads a picked file, downscales it client-side to a 1600px long edge and re-encodes as JPEG (~4MB camera photo → ~250KB upload), which also normalizes formats like HEIC that a phone might hand over into something the backend accepts. *Note:* this file also exports a `scanLabel()` function that posts to `/api/scan-label` — but no such endpoint exists in `api/`; the actual label-scanning flow goes through `ChatInput`'s attachment → `Dashboard.analyzeFood` → `serverParser.analyzeFoodServer(text, image)` → `POST /api/parse-food` (handled by `labelReader.ts`). `scanLabel`/`ScannedLabel` appear to be unused leftovers from an earlier, separate scanning design.

**`serverParser.ts`** — `analyzeFoodServer(text, image?)`: the sole client → `/api/parse-food` HTTP caller, optionally attaching a base64 image + MIME type.

---

## 20. `frontend/tests/` — Vitest suite

No test runner config exists at the root (`package.json` has no root `test` script), but `frontend/` has a full Vitest setup:

- **`normalizeText.test.ts`** — phrase parsing (quantities, units, filler stripping, singularization).
- **`fuzzy.test.ts`** — edit distance, Jaro-Winkler, `findBestMatch` threshold/margin/ambiguity behavior.
- **`dictionary.test.ts`** — `dictionaryService` learn/merge/token-matching logic.
- **`packagedFoods.test.ts`** — `savePackagedFood`/label-derived dictionary entries.
- **`wrongFoodRepro.test.ts`** — regression test(s) for specific mismatch bugs (e.g. the "chicken" vs. "chicken egg alias" cross-contamination case described in `dictionaryService.ts`'s comments).
- **`storage.test.ts`** — `localDb`/`schema` read/write/normalize/corruption-recovery behavior.
- **`merge.test.ts`** — the sync reconciliation algorithm's "nothing is lost" properties.
- **`syncService.test.ts`** — sync orchestration (pull/merge/push ordering, error states).
- **`rateLimit.test.ts`** — backend fixed-window limiter (imported directly, since it's plain TS with no Vercel-specific dependencies).
- **`setup.ts`** — Vitest global setup/config (mocks, environment).
---       
## How it all fits together (quick trace)

A single "log 2 eggs" round-trip touches, in order:
`ChatInput` → `Dashboard.handleSendMessage` → `Dashboard.analyzeFood` → `parseCacheService` (miss) → `localParser.matchPhrase` (via `normalizeText`, `fuzzy`, `foodVocabulary`, `dictionaryService`) → (on a full local miss) `serverParser.analyzeFoodServer` → `POST /api/parse-food` → `rateLimit` → `parseFoodOrchestrator` → `parser.ts` rules or `gemini.ts` → `validator.ts` → back to `Dashboard` → `ReviewConfirmTable` (via `ChatMessage`) → `Dashboard.handleConfirmLog` → `unitConverter.scaleMacrosByQuantity` → `logService.addLogs` → `localDb.updateDb` (persists + bumps revision) → `dictionaryService.learnMany` (teaches the dictionary) → every `useDbRevision()`-subscribed view (dashboard totals, history, calendar) re-renders → `useAutoSync`'s debounced timer eventually fires `syncService.sync()` → Drive.