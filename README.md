# 🍳 FoodLog

A conversational food diary. Instead of searching a database and picking from
five near-identical entries for a single apple, you just type what you ate:

> *"I had 2 fried eggs, a slice of whole wheat toast, and 200ml orange juice."*

FoodLog splits that into items, estimates calories and macronutrients, lets you
adjust the portions, and logs them. It is **local-first**: your diary lives in
your browser, there are no accounts, and nothing you log is stored on a server.

---

## Features

- **Natural-language logging** — type a meal the way you'd text a friend. Items
  are separated on `and`, `,` and `+` (never `with`, so *"burger with cheese"*
  stays one dish).
- **Nutrition label photos** — attach a photo of a packaged food's nutrition
  panel. Its printed figures are used instead of an estimate, scaled to the
  amount you actually ate.
- **Review before you log** — every parsed item appears in an editable table.
  Adjust quantities and units; macros recalculate live. Nothing is saved until
  you confirm.
- **Learns your foods** — every confirmed item teaches a personal food
  dictionary, so the next time you type *"2 eggs"* it resolves instantly, on
  your device, with no network call. Mistyped foods you correct are remembered
  too.
- **Daily dashboard** — calorie ring, macro progress bars against your goals,
  streak counter, and today's itemised list with inline edit and delete.
- **History** — a monthly calendar with logged-day markers, a 7-day calorie
  chart, weekly average, and a per-day breakdown.
- **Goals and preferences** — editable daily targets (calories, protein, carbs,
  fat, sugar, fiber), confetti on/off, and history chart length.
- **Backup and restore** — export your whole diary to a JSON file and restore it
  later. A gentle reminder appears once you have enough data and haven't backed
  up recently.
- **Optional Google Drive sync** — keep one diary across all your devices, stored
  in a private app-only folder in *your own* Google Drive. See
  [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md).
- **Works offline for everything except new text parsing** — logging, editing,
  history and stats are all local. Only phrases you have never logged before
  need the AI service.

---

## How it works

Every meal description passes through a ladder of progressively more expensive
steps. The cheap steps run first, so the AI is only called for food the app
genuinely hasn't seen:

```
 "2 eggs and a banana"
        │
        ▼
 1. Whole-phrase cache       ── this exact sentence was parsed before?  → done
        │ miss
        ▼
 2. Personal food dictionary ── per fragment: exact alias → partial name → fuzzy typo match
        │ fragments left over
        ▼
 3. Server parser (/api/parse-food)
        ├─ rate limit + server cache
        ├─ rule-based matcher (common staples, gram/piece maths)
        └─ Gemini AI (structured JSON output)
        │
        ▼
 4. Validator   ── checks macro maths (4P + 4C + 9F ≈ kcal), calorie density,
                  and that macro grams don't exceed the stated weight
        │
        ▼
 5. Review table → you confirm → saved locally → dictionary learns → Drive sync (if on)
```

Two design choices drive most of this:

- **Trust is ranked.** A food's macros can come from an AI estimate, a
  photographed label, or your own hand correction. Higher-trust sources are
  never silently overwritten by lower ones.
- **Deletions are facts.** Deleting an entry leaves a tombstone, so the entry
  can't reappear from another device that hasn't synced yet.

---

## Tech stack

| Area | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 3, Framer Motion, Lucide icons, canvas-confetti |
| Backend | Vercel serverless functions (`@vercel/node`), TypeScript |
| AI | Google Gemini (`gemini-3.1-flash-lite`) for text parsing and label reading |
| Storage | Browser `localStorage` (single versioned key) |
| Sync | Google Identity Services (OAuth 2.0) + Google Drive REST API, `drive.appdata` scope |
| Testing | Vitest |
| Hosting | Vercel |

---

## Project structure

```
foodlog/
├── api/
│   └── parse-food.ts            # POST /api/parse-food — the only server endpoint
├── backend/
│   ├── parsers/                 # Orchestrator + rule-based parser
│   ├── services/                # Gemini client, label reader, in-memory cache
│   └── utils/                   # Rate limiter, macro validator
├── shared/                      # Types and text normalisation used by client and server
├── config/                      # Gemini model name and endpoint
├── scripts/                     # Browser-console diagnostics for local data and migration
├── docs/                        # Google Drive sync setup guide and screenshots
└── frontend/
    ├── src/
    │   ├── pages/Dashboard.tsx  # Main screen: chat + dashboard, parsing orchestration
    │   ├── components/          # Chat, review table, dashboard, history, settings, sync UI
    │   ├── hooks/               # Reactive data hooks and background auto-sync
    │   ├── lib/
    │   │   ├── storage/         # The one module that touches localStorage, and the schema
    │   │   ├── services/        # Data API: logs, dictionary, stats, chat, goals, backup…
    │   │   ├── nlp/             # Normalisation, fuzzy matching, food vocabulary
    │   │   ├── parsing/         # Offline parsing ladder
    │   │   ├── sync/            # Drive OAuth, API client, merge and tombstones
    │   │   └── migration/       # One-time importer for the older Supabase-based version
    │   ├── ui/                  # Design-system primitives and animation presets
    │   └── utils/               # Unit conversion, dates, image preparation
    └── tests/                   # Vitest suite
```

For a file-by-file walkthrough, see [FILE_GUIDE.md](FILE_GUIDE.md). For the
architecture overview, see [PROJECT_DETAILS.md](PROJECT_DETAILS.md).

---

## Getting started

### Prerequisites

- Node.js 18 or newer
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Install

```bash
npm run install:all        # root dependencies + frontend dependencies
```

### 2. Configure environment variables

Copy the example file and add your key:

```bash
cp .env.example .env
```

```bash
# .env (repo root)
GEMINI_API_KEY=your-google-gemini-api-key
```

Google Drive sync is optional. To enable it, add `VITE_GOOGLE_CLIENT_ID` to
`frontend/.env` — the full steps are in [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md).

### 3. Run

```bash
npm run dev                # starts the Vite dev server at http://localhost:5173
```

The dev server also serves `/api/parse-food` by running the same handler
in-process, so text parsing works locally without the Vercel CLI.

Open the app, tap one of the suggestions, or type *"I had 2 eggs and toast"*.

### Other commands

```bash
npm run build --prefix frontend      # type-check and produce a production build
npm run preview --prefix frontend    # serve the production build locally
npm run lint --prefix frontend       # ESLint
npx vitest run --root frontend       # run the test suite
```

---

## Deployment

The project is set up for Vercel (`vercel.json`):

- The frontend builds from `frontend/` into `frontend/dist`.
- Everything under `api/` deploys as a serverless function.
- Non-API routes rewrite to `index.html`, so client-side navigation works.

Add `GEMINI_API_KEY` to the Vercel project's environment variables. For Drive
sync, add `VITE_GOOGLE_CLIENT_ID` and register your deployed URL as an
authorised origin in the Google Cloud console.

---

## Privacy

- Your diary is stored in your browser's local storage on your device.
- The only data sent to a server is the **text of the meal you are parsing** (and
  a label photo, if you attach one). It is not linked to an account, because
  there are no accounts. Nothing is kept on the server beyond a short-lived
  in-memory cache.
- If you turn on Drive sync, your diary is stored in a private app-only folder
  in your own Google Drive. The app's access is limited to that folder.

---

## Limitations

- **Data lives in one browser.** Clearing site data erases the diary unless you
  have exported a backup or turned on Drive sync.
- **Server rate limiting is per instance.** It guards against casual abuse, not
  a determined attacker. A distributed limiter would be the next step for
  production use.
- **Estimates are estimates.** AI-parsed macros are approximate. Labels and
  hand corrections are more reliable, and the app ranks them that way.
- **localStorage is roughly 5 MB.** Very long histories will eventually need
  pruning or a move to IndexedDB.

---

## Roadmap

- Barcode scanning
- Weekly macro goal cycling (refeed and deficit days)
- CSV and PDF reports
- Installable PWA and home-screen widget
- Favourites UI (the data layer already exists)

---

## Status

Core logging, label scanning, the offline parsing ladder, history, backup, and
Drive sync are implemented. The app is a personal project and has not been
audited for production use.
