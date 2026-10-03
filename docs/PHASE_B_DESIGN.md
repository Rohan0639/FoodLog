# Phase B — Architecture and Database Design (Option A)

Status: design only. No dependencies installed, no runtime code changed.
Approval needed before Phase C.

## 1. Decision

Option A was chosen: server accounts with PostgreSQL. This reverses the earlier
"no database, data only for the user" requirement. The change is documented here so
it is a deliberate decision, not an accident.

## 2. Target architecture

    React (Vite, TypeScript)
        │  HTTPS, JSON, httpOnly session cookie
        ▼
    Node.js API (Express, TypeScript)
        ├─ middleware: request id, logging, CORS allow-list, security headers,
        │              body size limit, rate limit, auth, Zod validation, errors
        ├─ modules:    auth · food-logs · goals · favorites · nutrition · parsing
        │              route → controller → service → repository → Prisma
        ├─ parsing:    existing ladder (cache, rules, Gemini, validator), unchanged
        ▼
    PostgreSQL (via Prisma migrations)

The existing Vercel handler (api/parse-food.ts) stays working during migration.
Express is added beside it and both call the same parsing code.

## 3. Schema decisions

- `User`: unique email, Argon2id password hash, never returned by any endpoint.
- `FoodLog`: one row per user per day. Unique (userId, date) prevents duplicate days
  and makes "get day" a single indexed lookup.
- `FoodItem`: belongs to a FoodLog. Index on foodLogId avoids N+1 when loading a day.
- `DailyGoal`: one per user (unique userId).
- `FavoriteFood`: unique (userId, name) so a favourite is saved once.
- Cascades: deleting a user removes all their logs, items, goals and favourites.
- Macros are `Float` for simplicity. Decimal would be more exact for money-like
  values; for nutrition estimates the difference is negligible, and this is noted as
  a trade-off.
- Not modelled: ParseHistory and NutritionCorrection. The spec suggested them, but
  nothing in the app needs them yet, and the instruction was not to add features that
  do not serve the product.
- Foods learned on the device (FoodDictionary) are not stored on the server. They are
  personal caches derived from logs, and can be rebuilt.

## 4. Authentication design

- Passwords: Argon2id via the `argon2` package. Never logged, never returned.
- Session: short-lived JWT (15 min) plus a refresh token in an httpOnly, Secure,
  SameSite=Lax cookie. The JWT secret comes from the environment only.
- Login and register are rate-limited more strictly than other routes.
- Every query that reads or writes diary data is scoped by the authenticated userId.
  Authorisation is checked in the service layer, and tests cover cross-user access.

## 5. Privacy consequence (must be stated to users)

Under Option A the server stores diary rows in plaintext, isolated per user. It can
read them. The device-side encryption protects the local cache and the Drive copy, but
not the server copy. Mitigations to consider in Phase J: column-level encryption with a
server-held key, and encryption at rest by the database host. The privacy page and
README must be updated to say this plainly.

## 6. Open items for Phase C

- Confirm `argon2` vs `bcrypt` (argon2 preferred).
- Confirm the sync approach: device stays the offline cache, the server is the source
  for logged-in use, and conflicts use the existing updatedAt and tombstone rules.
- Confirm whether the encrypted-on-device vault remains required when the server is
  the primary store.
