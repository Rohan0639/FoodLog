# 🍳 FoodLog — Project Overview & Technical Architecture

## 1. Executive Summary
**FoodLog** is a modern, conversational, AI-powered food and nutrition tracking web application. Instead of tedious manual searches, multi-step dropdowns, and complex weight sliders, users simply describe what they ate in natural English (e.g., *"I had 2 fried eggs, 1 slice of whole wheat toast, and 200ml orange juice"*) or attach a photo of a nutrition label.

### Core Product Philosophy
- **Conversational & Frictionless:** Chat-driven meal input with auto-parsing into itemized foods, portions, and macros.
- **Local-First & Privacy-Focused:** User data is stored locally on their device by default. No mandatory accounts or remote database tracking.
- **Zero-Server Cloud Sync:** Optional multi-device synchronization using the user's private **Google Drive AppData** sandbox (`drive.appdata` scope).
- **Fast & Resilient:** Multi-tier parsing ladder ensures frequent foods parse instantly offline without incurring AI latency or API costs.

---

## 2. Technology Stack & Languages

| Domain | Technology / Tool | Details |
|---|---|---|
| **Language** | **TypeScript** (`~6.0.2` on frontend, `ES2020` on backend) | End-to-end typed contracts across frontend, shared types, and serverless API. |
| **Frontend Framework** | **React 19** (`^19.2.6`) + **Vite 8** (`^8.0.12`) | Single Page Application (SPA), ultra-fast HMR and build times. |
| **Styling & UI** | **Tailwind CSS 3** (`^3.4.19`) + PostCSS | Custom dark monochrome theme (`zinc` palette), custom glow shadows, and responsive layouts. |
| **Motion & UX** | **Framer Motion** (`^12.43.0`), **canvas-confetti**, **Lucide React** | Spring physics animations, interactive micro-interactions, confetti celebrations on meal logging. |
| **Backend / API** | **Vercel Serverless Functions** (`@vercel/node`) | Stateless TypeScript function at `POST /api/parse-food`. |
| **AI / LLM** | **Google Gemini API** (`gemini-3.1-flash-lite`) | Natural language meal entity extraction and multimodal nutrition label image OCR/parsing. |
| **Persistence** | **Local-First Browser Storage** (`localStorage`) | Centralized in `foodlog_db_v1` with in-memory snapshot caching and schema versioning. |
| **Cloud Sync** | **Google Drive REST API (AppData)** | Zero-backend cross-device synchronization via Google Identity Services OAuth2 token flow. |

---

## 3. How the System Works (End-to-End Workflow)

```
[ User Input ] (Text prompt / Nutrition Label Photo)
      │
      ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Local Parsing Ladder (Client-side, Offline)               │
│    ├─ Stage 1: Client Parse Cache (200 most recent queries) │
│    ├─ Stage 2: Learned Food Dictionary (Exact alias)        │
│    ├─ Stage 3: Partial Token Match                          │
│    └─ Stage 4: Fuzzy Levenshtein Match                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ (If unmatched & online)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Serverless API (POST /api/parse-food)                    │
│    ├─ Rate Limiting & Payload Size Protection               │
│    ├─ Warm In-Memory Server Cache Check                     │
│    ├─ Multimodal Path (If image attached ➔ Gemini Vision)   │
│    ├─ Rule-Based Matcher (Common food aliases + gram weights)│
│    └─ LLM Fallback (Gemini 3.1 Flash Lite)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Validation & Sanity Guard (backend/utils/validator.ts)   │
│    ├─ Validates macro-calorie math (4*P + 4*C + 9*F ≈ Cal)   │
│    ├─ Enforces physical calorie density limits (≤9 kcal/g)   │
│    └─ Guards against hallucinated non-food responses        │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Client Review & Log                                      │
│    ├─ Interactive Review Table (editable quantities/units)   │
│    ├─ Live Macro Re-scaling (unitConverter.ts)              │
│    ├─ On Confirm: Written to localDb.ts + Confetti          │
│    ├─ Daily Stats & Streak recalculation                    │
│    └─ Background debounced Google Drive sync                │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Key Techniques & Algorithms

### 1. Multi-Tier Parsing & Fallback Ladder
To minimize AI API costs and enable offline logging, queries pass through multiple progressive tiers:
1. **Local Parse Cache:** Remembers past successful queries on the client.
2. **Local Dictionary (`localParser.ts`):** Matches against user's custom and learned foods via exact alias, partial tokens, or fuzzy Levenshtein distance with confidence scores.
3. **Server Rule-Based Parser (`backend/parsers/parser.ts`):** Fast regex & token extraction for common staples (`egg`, `banana`, `apple`, `chicken breast`, `rice`, `milk`) with a coverage threshold guard (>50% coverage).
4. **Gemini AI Extraction (`backend/services/gemini.ts`):** Complex, branded, or multi-item meals are sent to `gemini-3.1-flash-lite` with a structured system prompt enforcing JSON schema outputs.

### 2. Multimodal Nutrition Label OCR (`labelReader.ts`)
Users can snap a photo of a nutrition facts label. The image is downscaled to a max of 4MB JPEG base64 on the client, sent to Gemini Vision alongside any accompanying meal text, and parsed directly into verified macro values.

### 3. Macro & Calorie Physical Plausibility Validator (`validator.ts`)
LLM outputs are rigorously validated before reaching the user:
- **Atwater Factor Validation:** Calories must approximately equal $(4 \times \text{Protein}) + (4 \times \text{Carbs}) + (9 \times \text{Fat})$ within a 20% margin of error.
- **Calorie Density Constraint:** Calorie density cannot exceed $9\text{ kcal/g}$ (the density of pure fat).
- **Mass Conservation:** Sum of macronutrient grams cannot exceed total specified portion weight.

### 4. Local-First Architecture & Storage Engine (`localDb.ts`)
- All data resides in a single, versioned JSON schema under `localStorage["foodlog_db_v1"]`.
- Uses an in-memory snapshot cache to eliminate redundant JSON parsing on hot render paths.
- Writes are guarded through a single `updateDb()` function with automatic cross-tab synchronization (`StorageEvent` listener) and corrupted state recovery backups (`foodlog_db_v1__corrupt__<timestamp>`).
- Supports zero-friction JSON **Export & Import** backups.

### 5. Private Google Drive Sync Engine (`lib/sync/`)
- Uses Google OAuth 2.0 with the restrictive `https://www.googleapis.com/auth/drive.appdata` scope (grants access *only* to FoodLog's hidden app folder, preventing access to the rest of the user's Drive).
- Implements **Tombstone Deletions** so deleted items do not resurrect during multi-device synchronization.
- Resolves conflicts using Last-Write-Wins (LWW) timestamp merging on individual food records.

### 6. Dynamic Unit Conversion & Macro Scaling (`unitConverter.ts`)
- Normalizes volume (`ml`, `l`, `cup`, `tbsp`, `tsp`), weight (`g`, `kg`, `oz`, `lb`), and piece counts.
- Maintains accurate reference piece weights per food (e.g., egg ≈ 50g, banana ≈ 120g).
- Re-scales calories and micronutrients in real time when users tweak portions in the UI.

---

## 5. Repository & Codebase Structure

```
foodlog/
├── api/
│   └── parse-food.ts               # Vercel serverless function entry (POST /api/parse-food)
├── backend/
│   ├── parsers/
│   │   ├── index.ts                # Orchestrator (Rule-based -> Gemini fallback)
│   │   └── parser.ts               # Local staple rule matcher & database
│   ├── services/
│   │   ├── cache.ts                # In-memory Map cache for warm lambdas
│   │   ├── gemini.ts               # Gemini API prompt & client
│   │   └── labelReader.ts          # Multimodal nutrition label OCR service
│   └── utils/
│       ├── rateLimit.ts            # Sliding-window IP rate limiter
│       └── validator.ts            # Physical nutrition & macro validator
├── shared/
│   ├── normalize.ts                # Input text normalization utilities
│   └── types.ts                    # Universal shared TypeScript definitions
├── config/
│   └── index.ts                    # Backend AI model & API config
├── docs/
│   ├── SYNC_SETUP.md               # Google Drive OAuth setup guide
│   └── screenshots/
├── frontend/
│   ├── index.html
│   ├── vite.config.ts              # Vite configuration (port 5173)
│   ├── tailwind.config.js          # Tailwind theme tokens, animations & gradients
│   └── src/
│       ├── App.tsx                 # Root app shell, migration loader & error boundaries
│       ├── main.tsx                # React DOM entry
│       ├── types.ts                # Frontend-specific types
│       ├── pages/
│       │   └── Dashboard.tsx       # Main page layout (Chat panel + Nutrition Dashboard)
│       ├── components/
│       │   ├── FoodLogger.tsx      # Chat thread container
│       │   ├── ChatInput.tsx       # Auto-expanding input with image attach
│       │   ├── ChatMessage.tsx     # Message bubbles & parsing loaders
│       │   ├── ReviewConfirmTable.tsx # Live editable parsed food confirmation table
│       │   ├── NutritionDashboard.tsx # Today/History views, macro rings, daily progress
│       │   ├── CalendarView.tsx    # Monthly calendar with logging status
│       │   ├── HistoryStatsView.tsx# 7-day calorie chart, streaks, weekly averages
│       │   ├── DayLogView.tsx      # Past-day itemized meal breakdown
│       │   ├── EditFoodModal.tsx   # Inline editor for logged meals
│       │   ├── SettingsSheet.tsx   # Daily goals editor, theme, Drive sync, export/import
│       │   ├── MyFoodsSheet.tsx    # Custom foods & learned dictionary manager
│       │   └── SyncSection.tsx     # Google Drive sync status & manual trigger
│       ├── hooks/
│       │   ├── useFoodLog.ts       # React hook for logs CRUD & state
│       │   ├── useChatMessages.ts  # Chat transcript persistence hook
│       │   ├── useHistoryData.ts   # Historical stats and calendar data hook
│       │   └── useDbRevision.ts    # Reactive storage subscriber hook
│       ├── lib/
│       │   ├── storage/            # localDb.ts and schema.ts
│       │   ├── services/           # Data services (log, chat, stats, goals, dictionary)
│       │   ├── nlp/                # Tokenizer, fuzzy matching & dictionary utilities
│       │   ├── parsing/            # localParser.ts ladder
│       │   └── sync/               # driveClient.ts, googleAuth.ts, merge.ts, syncService.ts
│       └── utils/
│           ├── serverParser.ts     # Client HTTP caller for /api/parse-food
│           ├── unitConverter.ts    # Portion scaling & unit conversions
│           └── date.ts             # Local calendar date helpers (YYYY-MM-DD)
├── package.json                    # Monorepo scripts
└── vercel.json                     # Vercel deployment & routing config
```

---

## 6. Environment Variables & Setup

### Environment Variables
- **Backend / API (Root `.env`):**
  - `GEMINI_API_KEY`: Google AI Studio API key (Required for the serverless AI parsing endpoint).
- **Frontend (`frontend/.env`):**
  - `VITE_GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web Client ID (Required only for Google Drive sync).

### Development Commands
```bash
# 1. Install all dependencies across root and frontend
npm run install:all

# 2. Run the Vite frontend development server (http://localhost:5173)
npm run dev

# 3. Build for production
npm run build --prefix frontend
```

---

## 7. Current Project Status & Planned Enhancements
- **Implemented:** Full conversational logging, nutrition label photo OCR, local parsing ladder, editable review table, macro targets tracking, historical calorie charts, streak calculation, local export/import, and private Google Drive synchronization.
- **Future Opportunities:** Barcode scanner integration, weekly macro goal cycling (refeed / deficit days), automated PDF/CSV nutrition reports export, and widget/PWA installability.
