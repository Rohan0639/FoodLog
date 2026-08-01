# FoodLog — Project Documentation

> A conversational, AI-powered food diary. You type what you ate in plain English
> ("I had 2 fried eggs and 200ml orange juice") and the app parses it into
> individual food items, estimates calories and macros, and logs them.

This document describes the project **exactly as it exists in the repository**. It
does not describe planned or aspirational features.

---

## 1. What it is

FoodLog turns natural-language meal descriptions into structured nutrition data.
The flow is:

1. User types a message in a chat interface.
2. The text is parsed into food items with calories, protein, carbs, fat, sugar, and fiber.
3. Parsed items appear in an editable **review table** where quantities can be adjusted.
4. On confirm, items are saved to the user's daily log (Supabase) and shown on a nutrition dashboard.
5. A **history / stats** view shows past days, a monthly calendar, logging streak, and a 7-day calorie chart.

---

## 2. Tech stack (from `package.json` files)

### Frontend (`frontend/`)
- **React 19** (`react` / `react-dom` `^19.2.6`)
- **TypeScript** (`~6.0.2`)
- **Vite 8** (`^8.0.12`) as build tool / dev server
- **Tailwind CSS 3** (`^3.4.19`) + PostCSS + Autoprefixer
- **lucide-react** for icons
- **canvas-confetti** for the confirm animation
- ESLint 10 + typescript-eslint for linting
- **No data or auth library.** Persistence is the browser's own `localStorage`,
  reached through the app's storage layer (`src/lib/storage`, `src/lib/services`).

### Backend / API (repo root)
- **Vercel serverless functions** (`@vercel/node`)
- TypeScript compiled with `tsconfig.json` (target ES2020, module CommonJS)
- **Stateless.** The endpoint parses text and returns it. It stores nothing.

### External services
- **Google Gemini API** — model `gemini-3.1-flash-lite` (defined in `config/index.ts`).
  The only external service, and only for parsing text into food items.

### Hosting
- **Vercel** (`vercel.json`), building the frontend to `frontend/dist` and serving `/api/*` as functions. Non-API routes are rewritten to `/index.html` (SPA fallback).

---

## 3. Repository layout

```
foodlog/
├── api/
│   └── parse-food.ts          # Vercel serverless endpoint: POST /api/parse-food
├── backend/
│   ├── parsers/
│   │   ├── index.ts           # parseFoodOrchestrator — rules first, Gemini fallback
│   │   └── parser.ts          # Rule-based parser + hardcoded FOOD_DATABASE
│   ├── services/
│   │   ├── cache.ts           # In-memory Map cache for parse results
│   │   ├── gemini.ts          # Gemini API call + prompt (server side)
│   │   └── supabaseClient.ts  # Server Supabase client
│   └── utils/
│       └── validator.ts       # Validates Gemini output (macro/calorie sanity checks)
├── config/
│   └── index.ts               # Gemini model name + API URL
├── shared/
│   ├── normalize.ts           # normalizeFoodInput() — unit/text normalization
│   └── types.ts               # Shared TS types (ParsedItem, GeminiResponse, etc.)
├── frontend/
│   ├── index.html
│   ├── vite.config.ts         # Vite config (dev port 5173, strictPort)
│   ├── tailwind.config.js     # Tailwind theme (monochrome macro palette, animations)
│   └── src/
│       ├── main.tsx           # React entry (StrictMode)
│       ├── App.tsx            # Auth gate: session check → Login/Signup or Dashboard
│       ├── types.ts           # Frontend TS types
│       ├── pages/
│       │   └── Dashboard.tsx  # Main app: chat state, logging actions, layout
│       ├── components/
│       │   ├── Navbar.tsx
│       │   ├── FoodLogger.tsx        # Chat thread + input container
│       │   ├── ChatInput.tsx         # Auto-resizing textarea input
│       │   ├── ChatMessage.tsx       # Renders a single chat bubble
│       │   ├── ReviewConfirmTable.tsx# Editable parsed-items table before confirm
│       │   ├── EmptyState.tsx        # First-run suggestions
│       │   ├── NutritionDashboard.tsx# Today + History tabs, totals, macro bars
│       │   ├── CalendarView.tsx      # Monthly calendar with logged-day markers
│       │   ├── HistoryStatsView.tsx  # Streak, weekly average, 7-day calorie chart
│       │   ├── DayLogView.tsx        # A selected past day's entries
│       │   └── EditFoodModal.tsx     # Edit an existing logged item
│       ├── hooks/
│       │   ├── useFoodLog.ts         # A day's entries + the writes that change them
│       │   ├── useChatMessages.ts    # Per-day transcript, persisted
│       │   ├── useHistoryData.ts     # Calendar days, selected day, stats
│       │   ├── useDbRevision.ts      # Re-render on any store write
│       │   └── useOnlineStatus.ts    # Network reachability (for the parser)
│       ├── lib/
│       │   ├── storage/
│       │   │   ├── schema.ts         # DB shape, defaults, versioning, normalisation
│       │   │   └── localDb.ts        # THE only module that touches localStorage
│       │   ├── services/             # The data API — all CRUD goes through here
│       │   │   ├── logService.ts     # Food-log create/read/update/delete
│       │   │   ├── statsService.ts   # Streak, weekly average, chart series
│       │   │   ├── chatService.ts    # Transcripts + pending-review recovery
│       │   │   ├── goalService.ts    # Daily macro targets
│       │   │   ├── settingsService.ts# App settings
│       │   │   ├── favoritesService.ts # Saved foods (no UI yet)
│       │   │   ├── profileService.ts # The local profile
│       │   │   ├── parseCacheService.ts # Remembers parsed phrases
│       │   │   └── index.ts          # Barrel — components import from here
│       │   └── migration/
│       │       └── legacyMigration.ts# One-time import of pre-existing cloud data
│       └── utils/
│           ├── serverParser.ts       # analyzeFoodServer() → POST /api/parse-food
│           ├── unitConverter.ts      # Unit categories/factors + macro scaling
│           └── date.ts               # Local YYYY-MM-DD helpers (shared)
├── package.json               # Root workspace scripts
├── tsconfig.json              # Backend/shared/api/config TS config
├── vercel.json                # Vercel build + rewrites
└── README.md
```

---

## 4. How food parsing works

Parsing runs through a **two-tier orchestrator** on the server
(`backend/parsers/index.ts` → `parseFoodOrchestrator`):

### Tier 1 — Rule-based parser (`backend/parsers/parser.ts`)
- Normalizes the input, then splits it on `and`, `,`, or `+` (intentionally **not** on `with`).
- Matches each part against a **hardcoded `FOOD_DATABASE`** of 6 foods:
  `egg`, `banana`, `apple`, `chicken breast`, `rice`, `milk`.
- Extracts quantity/unit (grams, ml, liters, pieces) and computes macros per unit.
- A **coverage gate**: if the matched alias covers less than 50% of the phrase (e.g. "rice" inside "KFC rice bowl"), it bails so the LLM handles it.
- If **any** part fails to match, the whole request falls through to Tier 2.

### Tier 2 — Gemini LLM (`backend/services/gemini.ts`)
- Sends a detailed prompt to `gemini-3.1-flash-lite` instructing it to:
  - preserve brand/preparation (e.g. don't reduce "KFC rice bowl" to "rice"),
  - treat multi-word/branded dishes as single composite items,
  - return **JSON only** with items + totals, or `{ "status": "invalid", ... }` for non-food input.
- The raw response is JSON-extracted and validated.

### Validation (`backend/utils/validator.ts`)
Gemini output is checked for:
- correct structure and numeric types,
- non-negative values, total calories ≤ 5000,
- **macro consistency**: `calories ≈ protein×4 + carbs×4 + fat×9` (fails if off by ≥20%),
- **calorie density** ≤ 9 kcal per gram/ml when a weight/volume quantity is given,
- **weight consistency**: sum of macros can't exceed the item's gram weight.

### Caching
Two layers, both keyed by normalized input text:
- **Server**: `backend/services/cache.ts`, an in-memory `Map` per warm serverless instance.
- **Client**: `parseCacheService`, persisted in the local database (capped at 200
  entries, successful parses only). Re-logging a phrase you have logged before
  costs no request and works with no connection.

The client cache replaced a shared `macro_dictionary` table of foods learned
from all users' entries. That was server-side storage of user-derived data,
which this app no longer has.

---

## 5. Data & persistence

**The app is local-first. Nothing a user logs leaves their device.** There is no
database server, no account, and no sign-in.

### The store
Everything lives under **one** `localStorage` key, `foodlog_db_v1`:

```jsonc
{
  "schemaVersion": 1,
  "appVersion":    "2.0.0-local",
  "profile":       { "id": "…", "name": "You", "createdAt": "…" },
  "logs":          [ /* FoodLogRecord: id, date, createdAt, name, quantity, unit, macros */ ],
  "goals":         { "calories": 2000, "protein": 135, /* … */ },
  "settings":      { "chatRetentionDays": 1, "confettiEnabled": true, "historyGraphDays": 7 },
  "favorites":     [ /* saved foods — store and service exist; no UI yet */ ],
  "chat":          { "2026-08-01": [ /* messages */ ] },
  "parseCache":    { "2 eggs": { "response": { /* … */ }, "cachedAt": "…" } },
  "meta":          { "createdAt": "…", "updatedAt": "…", "migration": { /* … */ } }
}
```

`date` is always a **local** calendar day, so a meal logged at 11pm belongs to
that evening rather than to the next UTC day.

### The layers
```
components / hooks       never see a storage key
        │
        ▼
lib/services/*           the data API — every CRUD operation
        │
        ▼
lib/storage/localDb.ts   the ONLY module that touches localStorage
        │
        ▼
        localStorage["foodlog_db_v1"]
```
Reads are served from an in-memory snapshot, invalidated on write and by
`storage` events from other tabs, so the hot paths never re-parse JSON.
Writes go through a single `updateDb()` primitive, which is the one place
persistence, snapshot invalidation and change notification happen.

### Schema evolution
`schema.ts` owns the shape. Additive fields are back-filled by `normalizeDb()`
on every read; structural changes get an entry in `SCHEMA_MIGRATIONS` and a
`SCHEMA_VERSION` bump. An unparseable payload is copied to a
`foodlog_db_v1__corrupt__<timestamp>` key rather than discarded.

### One-time import of pre-existing cloud data
`lib/migration/legacyMigration.ts` runs once on first launch after the upgrade.
It reads the session the previous build left in `localStorage`, pulls the user's
history over REST, merges it in **by id with existing records winning**, and only
records success after verifying the writes. It never deletes the legacy keys.
See §11.

### Offline behaviour
Logging, editing, deleting, history, and statistics all work with **no network at
all** — they are local reads and writes. Only *parsing new text* needs the AI
service; phrases parsed before are served from the local parse cache. The
navbar indicator reflects network reachability, which now affects parsing only.

The previous build's offline machinery — an action queue, pending-action
replay, and online/offline reconciliation — existed because a network write
could fail after the UI had moved on. A local write cannot half-succeed, so all
of it was removed.

### Daily reset
A self-re-arming timer fires at local midnight, rolls the "today" date over,
loads the new day's (empty) transcript, and posts a reset message. Previous days
remain in history.

---

## 6. Key UI features (as implemented)

- **Chat logging** with typing indicator and first-run suggestion prompts (`EmptyState`).
- **Review & confirm table** (`ReviewConfirmTable`) — edit quantity before saving; macros re-scale live via `unitConverter.scaleMacrosByQuantity`.
- **Confetti** on successful confirm (`canvas-confetti`).
- **Nutrition dashboard** with a **Today** tab (calorie progress bar, macro bars for protein/carbs/fat/sugar/fiber, logged-food list with edit/delete) and a **History & Stats** tab.
- **History**: monthly calendar (`CalendarView`) with logged-day dots, **streak** + **weekly average** + **7-day calorie chart** (`HistoryStatsView`), and a per-day breakdown (`DayLogView`).
- **Edit modal** (`EditFoodModal`) for changing name/quantity/unit/macros of a logged item.
- **Responsive layout**: desktop shows chat + dashboard side by side; mobile uses a bottom tab bar (Log / Progress).
- **Daily goals** default to 2000 kcal, 135g protein, 230g carbs, 70g fat, 50g sugar, 30g fiber. They are now persisted per device and read through `goalService`, so adding an editor is a UI change only. There is still no in-app UI to change them.
- **Design**: dark, monochrome theme (`zinc` palette). Tailwind config defines a grayscale "macro" color set and custom shadows/animations.

---

## 7. Unit conversion (`frontend/src/utils/unitConverter.ts`)

- Classifies units into `weight`, `volume`, or `count` with conversion factors
  (e.g. kg→1000g, oz→28.35g, cup→240ml, tbsp→15ml).
- Cross-category conversions (e.g. pieces ↔ grams) use per-food **default piece weights**
  (banana 120g, egg 50g, apple 180g, etc.; fallback 100g).
- `scaleMacrosByQuantity()` rescales macros when a quantity/unit changes, with a fixed
  rounding contract (calories to integer; other macros to 1 decimal; floored at 0).

---

## 8. Configuration / environment variables

### Server — root `.env`, used by `api/` and `backend/`
- `GEMINI_API_KEY` — **the only variable the app requires.**

### Frontend — `frontend/.env` (Vite, must be prefixed `VITE_`)
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` — **legacy, optional, temporary.**
  Read *only* by the one-time importer in `src/lib/migration/`. Omit them for a
  fresh install. Delete them, and the `migration/` folder, once your users have
  opened the app once after the upgrade.

See `.env.example`. `.env` files are gitignored (root, `frontend/`, `backend/`).

---

## 9. Running the project

Scripts from the root `package.json`:

```bash
npm run install:all   # installs root deps + frontend deps
npm run dev           # runs the frontend dev server (vite, port 5173)
```

Frontend-only scripts (`frontend/package.json`):

```bash
npm run dev       # vite dev server
npm run build     # tsc -b && vite build
npm run preview   # preview production build
npm run lint      # eslint
```

Deployment is via **Vercel** using `vercel.json`:
- `installCommand`: `npm install --prefix frontend`
- `buildCommand`: `npm run build --prefix frontend`
- `outputDirectory`: `frontend/dist`
- SPA rewrite: everything except `/api/*` → `/index.html`
- The `api/parse-food.ts` handler runs as a serverless function.

> Note: to run the `/api/parse-food` endpoint locally you need the Vercel dev tooling;
> `npm run dev` alone only starts the Vite frontend.

---

## 10. Notes / current limitations (observed in code)

- **Data lives on one device in one browser.** Clearing site data deletes the
  diary. There is no sync, no backup, and no recovery. `localDb` exposes
  `exportDb()` / `importDb()`, but no UI calls them yet — a backup screen is the
  most valuable thing to build next.
- `localStorage` is capped at roughly 5 MB. A quota failure surfaces as a message
  in the chat rather than a silent loss.
- Parsing a *new* phrase still needs the network and a Gemini key; previously
  parsed phrases are served locally.
- Daily nutrition goals are persisted but not user-editable in the current UI.
- Favourites have a store and a service but no UI.
- There is no automated test suite in the repository.
- CORS on `/api/parse-food` is open (`Access-Control-Allow-Origin: *`).

---

## 11. Upgrading from the Supabase build

The first launch after the upgrade imports any pre-existing cloud history into
local storage. It requires no sign-in: the previous build left a session in the
browser, and the importer uses it directly over REST.

Guarantees, each covered by the verification run at migration time:

| Property | How |
|---|---|
| Runs once | Persisted status in `meta.migration`, plus an in-flight guard |
| Never overwrites | Records merge by id; existing records always win |
| Verified | Status flips to `completed` only after re-reading storage and confirming every imported id is present |
| Non-destructive | Legacy keys are **never deleted** — they remain as a backup |
| Recoverable | A network failure leaves the status `failed` and retries on the next launch, up to 5 attempts |
| Expired sessions | The refresh token is exchanged for a fresh access token first |

Data recovered: all `food_logs` rows (paginated), the previous offline log cache
(`food_logs_local_*`), and per-day chat transcripts (`chat_messages_*`).

**After the migration window**, delete `frontend/src/lib/migration/` and the two
`VITE_SUPABASE_*` variables. Nothing else references them.

---

*Generated from a direct read of the repository source.*
