# 🍳 FoodLog

A conversational food diary. Instead of searching a database and picking from
five near-identical entries for a single apple, you type what you ate:

> *"I had 2 fried eggs, a slice of whole wheat toast, and 200ml orange juice."*

FoodLog splits that into items, estimates calories and macronutrients, lets you
adjust the portions, and logs them.

**Live app:** https://foodlog-cyan.vercel.app

---

## Features

- **Accounts** — register and sign in with email and password. Passwords are
  hashed with Argon2id, and the session lives in an httpOnly cookie.
- **Natural-language logging** — type a meal the way you'd text a friend. Items
  are split on `and`, `,` and `+` (never `with`, so *"burger with cheese"* stays
  one dish).
- **Saved foods** — every food you log is remembered on the server, per account.
  Repeat foods are answered from your saved list, so Gemini is called only for
  foods you haven't logged before.
- **Nutrition label photos** — attach a photo of a packaged food's label. Its
  printed figures are used instead of an estimate, scaled to what you ate.
- **Review before you log** — each parsed item appears in an editable table.
  Quantities and units can be changed, and macros recalculate live.
- **Daily dashboard** — calorie ring, macro bars against your goals, streak
  counter, and today's list with edit and delete.
- **History** — monthly calendar with logged-day markers, a 7-day calorie chart,
  weekly average, and a per-day breakdown.
- **Goals and preferences** — editable daily targets, confetti on or off, and
  history chart length.
- **Encrypted on your device** — your diary is encrypted with a passphrase only
  you know, before it is saved.
- **Encrypted backup and restore** — export your diary to a file sealed with a
  passphrase, and restore it later on this or another device.
- **Optional Google Drive sync** — keep an encrypted copy of your diary in a
  private app folder in your own Google Drive. See
  [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md).
- **Clear save feedback** — if a change cannot be saved on the device, a banner
  says so.

---

## How it works

Every meal passes through a ladder of steps, cheapest first:

```
 "2 eggs and toast"
        │
        ▼
 1. Device dictionary     exact, partial or fuzzy match against foods on this device
        │ anything left
        ▼
 2. Server (POST /api/parse-food, login required)
        ├─ 2a. Your saved foods in PostgreSQL     ── known food → answered, no AI call
        ├─ 2b. Gemini for the remaining items     ── structured JSON
        └─ 2c. Validation: macro maths (4P + 4C + 9F ≈ kcal), calorie density,
               macro grams ≤ stated weight
        │   new results are saved to your food list for next time
        ▼
 3. Review table → you confirm → saved on the device → dictionary learns
```

Two design choices drive most of this:

- **Trust is ranked.** A food's macros can come from an AI estimate, a label, or
  your own correction. Higher-trust sources are never silently overwritten.
- **Deletions are facts.** Deleting an entry leaves a record, so it can't
  reappear from another device that hasn't synced yet.

---

## Architecture

```
            Browser (React, Vite)
                  │  /api/* (same origin, session cookie)
                  ▼
        Vercel: api/index.ts  ──►  Express app (server/)
                                     ├─ auth      register · login · logout · me
                                     ├─ parsing   saved foods → Gemini → validation
                                     └─ health    /api/health, /api/health/db
                                          │
                       ┌──────────────────┼──────────────────┐
                       ▼                  ▼                  ▼
               PostgreSQL (Supabase)   Google Gemini   (on device: encrypted diary,
               schema foodlog_app                       dictionary, Drive sync)
```

The server stores accounts and saved foods. It does not store diary entries
yet. Those stay encrypted on the device.

---

## Tech stack

| Area | Tools |
|---|---|
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 3, Framer Motion, Lucide, canvas-confetti |
| Server | Node.js, Express 5, TypeScript, Zod validation |
| Auth | Argon2id (password hashing), JWT in an httpOnly cookie |
| Database | PostgreSQL on Supabase, accessed through Prisma 7 (`foodlog_app` schema) |
| AI | Google Gemini (`gemini-3.1-flash-lite`), called only from the server |
| On-device storage | Browser `localStorage`, encrypted with AES-256-GCM |
| Sync (optional) | Google Identity Services (OAuth 2.0), Google Drive `appdata` scope |
| Testing | Vitest, Supertest (server), Vitest (frontend logic) |
| Hosting | Vercel (frontend and the `/api` function) |

---

## Project structure

```
foodlog/
├── api/
│   └── index.ts                 # Vercel entry: every /api/* request goes to the Express app
├── server/
│   ├── src/
│   │   ├── app.ts               # Express app: middleware, routes, error handling
│   │   ├── server.ts            # Local server entry (npm run server:start)
│   │   ├── config/env.ts        # Validated environment variables
│   │   ├── db/client.ts         # Prisma client (PostgreSQL adapter)
│   │   ├── middleware/          # Session check, error envelope
│   │   ├── modules/
│   │   │   ├── auth/            # Registration, login, sessions
│   │   │   └── parsing/         # Saved-food lookup, Gemini parser, label route
│   │   └── utils/logger.ts      # JSON logs with secrets redacted
│   └── tests/                   # Server tests (API, parsing, database)
├── prisma/
│   ├── schema.prisma            # Users, food logs, items, goals, favourites, food dictionary
│   └── migrations/              # Applied to Supabase
├── backend/                     # Existing parsing code: Gemini client, validator, label reader
├── shared/                      # Types and text normalisation
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Start-up: passphrase → account → dashboard
│   │   ├── components/          # Gates, chat, review table, dashboard, history, settings
│   │   ├── services/api/        # Typed client for the server (auth, errors)
│   │   ├── lib/                 # Storage, encryption, parsing, sync, migration
│   │   └── ...
│   └── tests/                   # Frontend logic tests
├── docs/                        # Setup guides and design notes
└── vercel.json                  # Build, function and rewrite settings
```

---

## Getting started

### Prerequisites

- Node.js 18 or newer
- A PostgreSQL database. This project uses [Supabase](https://supabase.com/)
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### 1. Install

```bash
npm install --legacy-peer-deps
npm install --prefix frontend
```

### 2. Configure

Copy the example and fill in your values. **Never commit `.env`.**

```bash
cp .env.example .env
```

| Variable | Where | What it is |
|---|---|---|
| `DATABASE_URL` | root `.env` | PostgreSQL connection string. For Supabase, use the **Session pooler** string and add `?schema=foodlog_app` |
| `JWT_SECRET` | root `.env` | At least 32 random characters, used to sign login sessions |
| `GEMINI_API_KEY` | root `.env` | Your Gemini key. Used only on the server |
| `CORS_ORIGIN` | root `.env` | Frontend origin allowed to call the API (default `http://localhost:5173`) |
| `PORT` | root `.env` | Local API port (default `8787`) |
| `VITE_GOOGLE_CLIENT_ID` | `frontend/.env` | Only for Google Drive sync. See [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md) |

Generate a `JWT_SECRET` with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

### 3. Set up the database

```bash
npm run db:deploy        # applies the migrations to your database
```

### 4. Run

Two terminals, both from the project root:

```bash
npm run server:start     # API on http://localhost:8787
npm run dev              # app on http://localhost:5173 (proxies /api to the API)
```

Open http://localhost:5173, set a passphrase, create an account, and log a meal.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run server:start` | Start the API server |
| `npm run server:dev` | Start the API server and reload on changes |
| `npm run dev` | Start the frontend (port 5173) |
| `npm run test:server` | Run the server tests (API, parsing, database) |
| `npm run test:db` | Run only the database tests |
| `npm run db:deploy` | Apply database migrations |
| `npm run db:migrate` | Create and apply a new migration in development |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run build --prefix frontend` | Type-check and build the frontend |
| `cd frontend && npx vitest run` | Run the frontend tests |

Server tests use your real database and delete the rows they create. Point
`DATABASE_URL` at a development project, not production data.

---

## Deployment (Vercel)

The live site is deployed on Vercel. To deploy your own copy:

1. Install the Vercel CLI and log in: `npx vercel login`
2. Link the project: `npx vercel link`
3. Add the server variables to production. Use the values from your `.env`:
   ```bash
   npx vercel env add DATABASE_URL production
   npx vercel env add JWT_SECRET production
   npx vercel env add GEMINI_API_KEY production
   ```
   Add `CORS_ORIGIN` as your deployed URL if you need it.
4. Deploy: `npx vercel --prod --yes`

`vercel.json` installs the server's dependencies, generates the Prisma client,
builds the frontend, and sends every `/api/*` request to `api/index.ts`. Other
paths fall back to `index.html`.

To check a deployment: `/api/health` should return `{"success":true,...}`, and
`/api/health/db` should return `"database":"ok"`.

---

## Privacy

What is stored where:

| Data | Where | Readable by the server? |
|---|---|---|
| Diary entries (meals, quantities, macros, goals) | Your device, encrypted with your passphrase | No |
| Dictionary of foods learned on the device | Your device | No |
| Encrypted backups | Files you keep | No (encrypted with your backup passphrase) |
| Drive sync copy (optional) | Your Google Drive app folder, encrypted | No |
| Account: email, name, password hash | PostgreSQL | Yes (password stored only as an Argon2id hash) |
| Saved foods: food names, per-unit macros, how often logged | PostgreSQL, per account | Yes |
| Meal text sent for parsing, and label photos | Sent to the server and Gemini to be parsed | Yes, while processing |

Notes:
- Your passphrase is never stored or sent. A forgotten passphrase cannot be
  recovered, so the on-device diary, its Drive copy, and any backup protected by
  that passphrase become unreadable.
- The server does not yet store diary entries, so logs are not on the server.
  Moving them there would be a further change to the privacy model.

---

## Limitations

- **Diary entries live on one device** until you sync or export. Clearing site
  data erases the local copy.
- **Passphrase recovery is not possible.**
- **Cold starts.** The API runs as a serverless function, so the first request
  after a quiet period is slower.
- **Rate limiting is per instance.** It guards against casual abuse, not a
  determined attacker. A shared limiter is needed for production scale.
- **Estimates are estimates.** AI-parsed macros are approximate. Labels and hand
  corrections are more reliable, and the app ranks them that way.
- **Not yet on the server:** diary logs, goals and favourites. Login-protected
  routes for these are planned.
- **Not yet verified:** the label-photo path on the live site, and the full
  browser walkthrough.

---

## Roadmap

- Diary logs, goals and favourites on the server
- Swagger/OpenAPI documentation
- CI: run tests on every pull request
- Barcode scanning
- Weekly macro goal cycling (refeed and deficit days)
- Recovery codes for lost passphrases
- Move local storage to IndexedDB for larger histories

---

## Status

The core features work end to end: accounts, passphrase protection, food logging
through the server with saved-food reuse, label photos, history, backup, and
optional Drive sync. The app is a personal project and has not been audited for
production use.
