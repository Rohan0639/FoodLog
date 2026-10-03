# FoodLog — JD Gap Analysis (Phase A)

> Scope: inspection only. No code was changed for this document.
> Target role: Full Stack Developer Intern (Hyderabad).
> Baseline: the `main` branch as of commit `c7aacdc`.

---

## 0. Summary

FoodLog already covers much of the frontend and testing side of the job description,
and the parsing and privacy work is stronger than a typical intern project. The gaps
are on the backend and data side: there is no real database, no server-side
authentication, one REST endpoint instead of a resource API, and no API tests.

**One decision must be made before Phase B.** The spec asks for PostgreSQL and
server-side user accounts. Your earlier requirement was that data is stored only for
the user, with no database. Those two positions conflict. Options are listed in §6.

---

## 1. Current technology stack (verified in the repo)

| Layer | Present today | Source |
|---|---|---|
| Frontend framework | React 19, TypeScript (strict in app), Vite 8 | `frontend/package.json`, `frontend/tsconfig*.json` |
| Styling | Tailwind CSS 3, custom design tokens | `frontend/tailwind.config.js`, `frontend/src/index.css` |
| Animation / icons | Framer Motion, Lucide, canvas-confetti | `frontend/package.json` |
| Backend | One Vercel serverless function, TypeScript | `api/parse-food.ts` |
| AI | Google Gemini `gemini-3.1-flash-lite` (text and vision) | `backend/services/gemini.ts`, `backend/services/labelReader.ts` |
| Validation | Hand-written checks, no schema library | `backend/utils/validator.ts`, `api/parse-food.ts` |
| Database | None on the server. Browser `localStorage` only | `frontend/src/lib/storage/localDb.ts` |
| Encryption | PBKDF2 (600k) + AES-256-GCM on device, encrypted Drive payload | `frontend/src/lib/security/` |
| Sync | Google OAuth + Drive `appdata` REST API | `frontend/src/lib/sync/` |
| Auth | Google sign-in for Drive only. No FoodLog accounts | `frontend/src/lib/sync/googleAuth.ts`, `frontend/src/components/AccessGate.tsx` |
| Tests | Vitest, 243 tests passing (`it(` call sites: 182; the rest come from loops and `it.each`) | `frontend/tests/` |
| Linting | ESLint 10 + typescript-eslint + react-hooks, script `npm run lint` | `frontend/package.json`, `frontend/eslint.config.js` |
| Logging | `console.log`/`console.warn` only | throughout |
| API docs | None (`DOCUMENTATION.md` is an older architecture write-up) | repo root |
| Hosting | Vercel (`vercel.json`) | repo root |
| CI / Git workflow | No `.github/` directory, no CONTRIBUTING.md | repo root |

Libraries from the spec that are **not** in the repo: Express or Fastify, Prisma,
PostgreSQL driver, Zod, Supertest, JWT, bcrypt or argon2, Swagger/OpenAPI, Helmet,
pino, React Testing Library.

---

## 2. JD requirement-by-requirement

### 2.1 Frontend

| JD requirement | Current implementation | Gap | Proposed solution | Files likely affected | Risk |
|---|---|---|---|---|---|
| HTML | Semantic markup in React, `index.html` shell | None significant | Keep. Add landmark roles where missing | `frontend/index.html`, components | Low |
| CSS | Tailwind plus custom CSS tokens | None | Keep | `index.css`, `tailwind.config.js` | Low |
| JavaScript | TypeScript throughout | None (TS is stronger than plain JS) | Keep | — | Low |
| React | React 19 with hooks and lazy loading | None | Keep | `frontend/src` | Low |
| Responsive web apps | Mobile tab bar, desktop split view | Not verified in a browser since recent changes | Manual responsive pass; add a Playwright smoke test only if it is needed | `Dashboard.tsx`, `NutritionDashboard.tsx` | Low |
| Integrate frontend with backend services | Only `POST /api/parse-food` is called (`utils/serverParser.ts`). Everything else is local | Partial. No resource API for logs, goals or favourites | Add a `services/api/` client layer (see §2.4) | `frontend/src/services/api/` (new) | Medium |
| Clean, reusable code | Strong component kit (`ui/primitives.tsx`), services layer, hooks | `utils/imageScan.ts` has an unused `scanLabel()` that calls a missing endpoint. Some components are large (`Dashboard.tsx` ~640 lines) | Remove dead code only after confirming it is unused. Split `Dashboard.tsx` into a parsing hook and a view | `imageScan.ts`, `Dashboard.tsx` | Low |
| Loading, empty and error states | Present for parsing, sync, and gates. Skeletons in History | No general loading state for any API call (there is no API call yet) | Reuse the same pattern for new API calls | — | Low |
| Accessible forms | Labels on most inputs, `aria-label` on icon buttons | Gaps: some icon-only buttons, no keyboard review of the table | Accessibility pass, keyboard checks | `ReviewConfirmTable.tsx`, `SettingsSheet.tsx` | Low |
| Frontend tests (food logger, review table, editing, dashboard, auth states) | Tests exist for logic (parsing, dictionary, merge, storage, vault, backup). **No component tests** | Major gap. No React Testing Library | Add RTL and test the components listed in the spec | `frontend/tests/components/` (new), `package.json` | Medium |

### 2.2 Backend

| JD requirement | Current implementation | Gap | Proposed solution | Files likely affected | Risk |
|---|---|---|---|---|---|
| Node.js | Node runs the Vercel function. Vite dev server runs the handler in-process | Partial. No standalone server | Add an Express (or Fastify) app that wraps the existing handlers | `backend/src/app.ts`, `server.ts` (new) | Medium |
| REST API design | One endpoint, `POST /api/parse-food`, response shape varies (`{error, message}` on failure) | Major gap. No resource endpoints, no consistent envelope | Introduce resource routes and one response envelope | `api/`, new `backend/src/routes/` | Medium |
| Build and consume REST APIs | The app consumes one API and builds one | Partial | Add CRUD endpoints for logs, items, goals, favourites | new modules | Medium |
| Error handling | Good local error messages. Server returns 400/405/413/429/500 with a plain shape. No central handler | Partial | Centralised error middleware with codes | `backend/src/middleware/` (new) | Low |
| Input validation | Hand-written checks on the parse endpoint and the validator | Partial. No schema library | Add Zod at the boundary. Keep the existing nutrition validator as a second layer | `backend/src/validators/` (new) | Low |
| Rate limiting | In-memory per instance (`backend/utils/rateLimit.ts`), documented as a casual-abuse guard | Known limitation. Not shared across instances | Keep for now. Note as a limit. Consider a shared store only if the server is real | `rateLimit.ts` | Low |
| CORS, security headers, request limits | CORS `*` on the parse endpoint. Image size limit (4 MB) is enforced. No security headers | Partial | Restrict CORS to an allow-list. Add Helmet-style headers, body size limit | `api/parse-food.ts` or the new Express app | Low |
| Logging | `console.log` only | Major gap. No request ID, no duration, no structure | Structured logger with request ID, method, path, status, duration. Redact secrets and passphrases | `backend/src/utils/logger.ts` (new) | Low |
| Secrets | `GEMINI_API_KEY` server-side only. Not in React | Correct already | Keep. Document in `.env.example` | `.env.example` | Low |

### 2.3 Database

| JD requirement | Current implementation | Gap | Proposed solution | Files likely affected | Risk |
|---|---|---|---|---|---|
| MySQL / PostgreSQL / MongoDB | None on the server. The database is `localStorage` on the device | **Critical gap for the JD.** Interviewers will ask about a server-side database | Decision needed (see §6). If approved: PostgreSQL + Prisma | `prisma/schema.prisma` (new), `prisma/migrations/` | **High** (conflicts with the no-database requirement) |
| Schema design, FKs, indexes | Normalised JSON in one document. Indexes are implicit in code | Missing for SQL | Design the schema in Phase B | `prisma/schema.prisma` | Medium |
| Avoid N+1 queries, pagination | Not applicable today. Local reads are in memory | Missing for a server | Pagination on history endpoints | repositories | Medium |
| Migrations | None | Missing | Prisma migrations | `prisma/migrations/` | Medium |
| SQL injection prevention | Not applicable (no SQL). Would be handled by Prisma parameterised queries | Missing until a DB exists | Use Prisma only. No raw SQL | — | Low |

### 2.4 REST API design details (spec §4)

| Endpoint | Exists today? | Gap |
|---|---|---|
| `POST /api/parse-food` | Yes | Keep. Give it the standard envelope |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, logout | No | Requires a user store (see §6) |
| `GET/POST /api/food-logs`, `GET /api/food-logs/:date` | No (local only) | Requires a server store or a sync API |
| `PUT/DELETE /api/food-items/:id` | No | As above |
| `GET/PUT /api/goals` | No (local only) | As above |
| `GET/POST/DELETE /api/favorites` | No (data layer exists, no UI) | As above, plus UI |
| `GET /api/nutrition/summary`, `GET /api/nutrition/history` | No (computed locally in `statsService`) | Could be ported to the server, or served from the local cache |

### 2.5 Authentication

| JD requirement | Current implementation | Gap | Proposed solution | Files likely affected | Risk |
|---|---|---|---|---|---|
| Registration, login, password hashing | None for FoodLog accounts. Google OAuth for Drive only. The device passphrase is not a login | **Major gap** | Option A (server accounts with hashed passwords) or B (see §6) | `backend/src/modules/auth/` (new) | **High** |
| Protected routes and middleware | None on the server | Missing | Auth middleware once accounts exist | `backend/src/middleware/auth.ts` | Medium |
| Secure token handling | Google token kept in memory only. Good | None for the Drive token | Keep. Use HttpOnly cookies or short-lived JWTs for the new API | — | Medium |
| No secrets in frontend | Correct | None | Keep | — | Low |

Note on the current design: the device passphrase works as a local unlock, not as a
server login. It is strong for privacy but is not an account system a recruiter would
recognise as "authentication".

### 2.6 Testing

| JD requirement | Current implementation | Gap | Proposed solution | Risk |
|---|---|---|---|---|
| Unit tests (parsing, validation, nutrition, services, utilities) | Strong. Parsing, fuzzy matching, validator, merge, storage, vault, backup, unit conversion | None. Preserve | Keep and extend | Low |
| API tests (auth, CRUD, parse, goals, authorisation, errors) | **None** over HTTP. Rate limiter is tested as a function | Major gap | Supertest against the new Express app | Medium |
| Frontend component tests (food logger, review table, dashboard, auth states) | **None** | Major gap | React Testing Library | Medium |
| Test failure cases | Many failure cases already (sync failures, corrupt data, wrong passphrase) | None | Keep the same standard | Low |
| Tests run in CI | No CI | Missing | GitHub Actions workflow running tests, type check, lint, build | Low |

### 2.7 Git, team workflow, documentation

| JD requirement | Current implementation | Gap | Proposed solution | Risk |
|---|---|---|---|---|
| Git | In use. Feature branches, PRs (#24–#27) | None | Keep | Low |
| Code reviews, PR expectations | PR history exists. No template | Missing template and checklist | `.github/pull_request_template.md`, `CONTRIBUTING.md` | Low |
| Agile practice | Not visible in the repo | Evidence missing | Document a short backlog or issues list, if you have one | Low |
| Documentation | README, FILE_GUIDE, PROJECT_DETAILS, PROJECT_BRIEF, SYNC_SETUP. `DOCUMENTATION.md` is stale | Stale file, no API docs, no architecture diagram | Update or retire `DOCUMENTATION.md`. Add `docs/API.md` and `docs/ARCHITECTURE.md` | Low |
| Deployment config | Vercel config | Missing a backend deployment plan | Document the target deployment after the decision in §6 | Low |

### 2.8 Other items in the spec

| Item | Status | Note |
|---|---|---|
| Debugging, optimisation | Present (diagnostic scripts, rate limiter, caches) | Document it |
| Problem solving | Strong evidence: parsing ladder, merge rules, trust ranking | Document the reasoning in the interview guide |
| Swagger / OpenAPI | None | Add after the endpoints exist. Expose in development only |
| Interview features (search, pagination, edit, delete, summary, date history, goals, favourites) | Local versions of most exist: edit, delete, summary, date history, goals, favourites data layer. **No search, no pagination** | Search and pagination are small additions once there is a list endpoint |

---

## 3. What should NOT be changed

These already work well and should be kept, not replaced to match the spec:

1. **The parsing ladder** (cache → dictionary → fuzzy → rules → Gemini → validation).
2. **The nutrition validator** (`backend/utils/validator.ts`). It is domain logic a recruiter will find impressive.
3. **Encrypted on-device storage** and the vault. The spec asks to keep it, and it is a real differentiator.
4. **The merge and tombstone sync rules.** They are tested and carefully reasoned.
5. **The component kit and animation system** in `frontend/src/ui/`.
6. **The 243-test suite.** Keep every test. Add new ones beside them.

---

## 4. What should be improved (no architecture change needed)

1. Replace the hand-written request checks in `api/parse-food.ts` with a Zod schema.
2. Give every failure a standard shape and a code.
3. Add a request ID and duration to logs, and redact secrets and passphrases.
4. Restrict CORS to a configured origin.
5. Add React Testing Library tests for the review table, the food logger and the gates.
6. Add a CI workflow, a PR template and `CONTRIBUTING.md`.
7. Remove the dead `scanLabel` path after confirming nothing calls it.
8. Split `Dashboard.tsx` into a parsing hook and a view.
9. Update `DOCUMENTATION.md`, or retire it in favour of `PROJECT_BRIEF.md` and `docs/ARCHITECTURE.md`.

---

## 5. Risk summary

| Change | Risk | Why |
|---|---|---|
| Zod, logging, CORS, headers, error envelope | Low | Local to the API boundary |
| Express wrapper and resource routes | Medium | Changes how the app is served; the Vite dev plugin must keep working |
| React Testing Library and CI | Medium | New tooling; some existing components may need small test seams |
| Server database (Prisma + PostgreSQL) | **High** | Introduces server-side user data, conflicts with the no-database requirement, needs hosting |
| Server accounts and password hashing | **High** | Security-sensitive; needs careful review and a real database |
| Moving diary data from device to server | **High** | Would change the privacy model and the sync design |

---

## 6. Decision needed before Phase B

The spec describes a server-backed app with PostgreSQL and user accounts. Your
earlier requirement was: **"without the database, the data is stored only for the user."**
These cannot both be fully met. Choose one of these paths:

**Option A — Server-backed with accounts (matches the spec)**
- PostgreSQL + Prisma. Users register with hashed passwords (argon2 or bcrypt).
- Each user's rows are isolated by `userId` on every query.
- Diary data is stored on the server. Encryption at rest on the server is needed,
  and per-user encryption keys would be a larger design step.
- Privacy story changes from "your data never leaves your device" to "your data is
  isolated per user on a server you control, and encrypted in transit and at rest."
- Best for demonstrating the JD. Highest effort and risk.

**Option B — Keep local-first, add a real API for accounts and sync (hybrid)**
- Keep the device as the primary store and the vault as the privacy layer.
- Add a small PostgreSQL-backed API that stores only the **encrypted** diary blob
  per account. The server cannot read it, because the key never leaves the device.
- Accounts exist (register, login, JWT or session), and the API is real REST with
  Prisma. Data is still per user and still unreadable by the server.
- Preserves the privacy model and still demonstrates auth, REST, Prisma and
  PostgreSQL. Recommended.

**Option C — Keep the current architecture and document the gap**
- Demonstrate the frontend, testing, parsing and encryption skills.
- Describe the backend gaps honestly in interviews, with the Option B plan as the next step.
- Lowest risk. Weakest match for the JD's backend and database requirements.

**Recommendation: Option B.** It meets the JD's backend, REST, auth and PostgreSQL
requirements while keeping the privacy guarantee you asked for.

---

## 7. Proposed next steps (after you choose an option)

1. Phase B: finalise the architecture and the Prisma schema for the chosen option.
2. Phase C: add the Express app beside the existing serverless handler. Keep both working.
3. Phase D–E: authentication and resource routes, with Zod validation and tests.
4. Phase F: frontend `services/api/` layer, and migrate one feature at a time.
5. Phase G–H: keep the parsing ladder and the encrypted cache; sync encrypted blobs.
6. Phase I–L: test coverage, docs, deployment notes, final verification.

Each step keeps the app runnable and the 243 existing tests passing.

---

## 8. Remaining setup or manual testing required

- Real Google OAuth client ID and a registered test-user list (already documented in `docs/SYNC_SETUP.md`).
- A PostgreSQL instance (local Docker or a hosted provider) for Option A or B.
- A Gemini API key with billing or quota suitable for testing.
- Manual browser test of the passphrase setup, unlock, sign-in and encrypted export/restore flows, which have not been tested by hand yet.
