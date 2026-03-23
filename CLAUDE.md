# GFL — Claude Code Instructions

## Project Overview
GFL Fantasy Football League Manager — a Next.js app with Vercel Postgres + Drizzle ORM backend supporting multiple leagues with row-level tenancy.

**Status:** Migration complete. Focus is now on feature enhancements.

## Tech Stack
- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **DB:** Vercel Postgres (Supabase) via `@vercel/postgres`
- **ORM:** Drizzle ORM (`drizzle-orm`, schema in `schema.ts`)
- **Auth:** NextAuth v5 (beta) — credentials provider, JWT strategy
- **AI:** Google Gemini (`@google/generative-ai`) for game summaries
- **Notifications:** Nodemailer (Gmail) + GreenAPI (WhatsApp)
- **Deployment:** Vercel

## Multi-League Architecture
All tenant tables have a `leagueId` column (row-level tenancy). **GFL = leagueId 1.**

| Table | Has leagueId |
|-------|-------------|
| leagues, teams, players, transactions, draftPicks, cuts, rules, resources, standings, schedule, tradeBlock, auditLog | Yes |

**Key files:**
- `schema.ts` — all table definitions (source of truth)
- `lib/getLeagueId.ts` — server helper: reads `gfl-league-id` cookie → team's leagueId → default 1
- `context/LeagueContext.tsx` — client context, `useLeague()` hook, stores in cookie
- `app/api/leagues/route.ts` — `GET ?public=true` (no auth, for login dropdown); authenticated GET uses email-based access control

**League access rule:** A user can switch to another league only if their email exists (with a password) in that league's teams table.

## Auth Flow
1. Login form fetches all leagues from `/api/leagues?public=true` and shows a dropdown when >1 league
2. Selected `leagueId` is passed as a NextAuth credential
3. Auth scopes DB team lookup to the selected league
4. On success: `leagueId` stored in JWT/session; `gfl-league-id` cookie set to that league
5. Login form saves last-selected league in `gfl-league-id` cookie (pre-fills on next visit)
6. Navbar league switcher only shown when user has access to multiple leagues (email-based)

**Roles:**
- `isAdmin()` → `session.user.role === 'admin' | 'superuser'`
- `isCommissioner()` → `teams.isCommissioner` via Drizzle
- Superuser: env vars `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD`

**Login accepts:** team name OR email address (email resolved to teamshort via DB lookup)

**Signup:** `POST /api/signup` creates `status='pending'` team; commissioner approves in Maintenance page

## DB Tables (all migrated to Drizzle)
| Area | Lib file |
|------|----------|
| Teams / Coaches | `lib/config.ts` |
| Rules / Settings | `lib/rules.ts` |
| Resources | `lib/getResources.ts` |
| Schedule | `lib/getSchedule.ts` |
| Standings | `lib/getStandings.ts` |
| Players | `lib/players.ts` |
| Transactions | `lib/transactions.ts` |
| Draft Picks | `lib/draftPicks.ts` |
| Cuts | `lib/cuts.ts` |

### Google Sheets status:
All application code has been fully migrated. No active `.ts`/`.tsx` files reference Google Sheets.
Legacy migration scripts remain in `scripts/` (one-time use, not active) and the `googleapis` package may still be in `package.json` as a remnant — safe to remove.

## Project Structure
```
app/                  # Next.js App Router pages & API routes
  api/                # API route handlers
lib/                  # Business logic (all Drizzle)
  db.ts               # Vercel Postgres connection
  db-helpers.ts       # Shared DB utilities
  getLeagueId.ts      # Active league resolver (cookie-based)
  notify.ts           # Email (Nodemailer) + WhatsApp (GreenAPI) notifications
schema.ts             # Drizzle table schema (source of truth for DB)
drizzle/              # Auto-generated SQL migrations
scripts/              # One-time data migration / seeding scripts
types/index.ts        # Shared TypeScript interfaces
components/           # UI components (client-side)
context/              # React context providers (LeagueContext)
```

## Common Commands
```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:push          # Push schema changes to DB
npm run db:studio        # Open Drizzle Studio
```

## Environment Variables
All in `.env.local` — never commit this file:
- `POSTGRES_URL` — Vercel Postgres connection string
- `AUTH_SECRET` — NextAuth secret
- `GOOGLE_SHEET_ID` — legacy Google Sheet ID (maintenance/settings only)
- `GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY` — service account (legacy)
- `GOOGLE_GENERATIVE_AI_KEY` — Gemini API key
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — email notifications
- `NOTIFY_MY_EMAIL` / `NOTIFY_GROUP_EMAIL` / `NOTIFY_FROM_EMAIL` — email targets
- `GREENAPI_INSTANCE_ID` / `GREENAPI_API_TOKEN` / `GREENAPI_GROUP_ID` — WhatsApp (GFL only)
- `SEND_WHATSAPP` — set to `'false'` to disable WhatsApp globally
- `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` — superuser credentials
- `NEXT_PUBLIC_APP_URL` — public URL (e.g. `https://gfl-zeta.vercel.app`)

## Code Conventions
- **Schema first:** Add new tables/columns to `schema.ts` before writing backend code, then `npm run db:push`
- **Always use Drizzle** for all DB logic — never use `google-spreadsheet` for new code
- **TypeScript interfaces** in `types/index.ts` — check before creating new ones
- **App Router patterns** — Server Components by default; `"use client"` only when needed
- **Keep API routes thin** — put business logic in `/lib`
- **shadcn/ui** for UI components
- **`unstable_cache` pattern:**
  ```ts
  const _fn = unstable_cache(async (leagueId: number) => { ... }, ['cache-key'], { revalidate: 60, tags: ['tag'] });
  export async function fn(leagueId = 1) { return _fn(leagueId); }
  ```
- **All notify calls must be `await`ed** — Vercel serverless kills unawaited promises when response returns

## Notifications (lib/notify.ts)
- `sendEmail()` — sends via Gmail SMTP; skipped if `GMAIL_APP_PASSWORD` not set
- `sendWhatsApp()` — sends via GreenAPI; skipped if env vars missing
- `notifyDraftPick()` — draft pick / warning / expiration alerts
- `notifyTransaction()` — trade / transaction alerts
- **WhatsApp is GFL-only** — code checks `leagueId === 1` before calling `sendWhatsApp()`
- All GreenAPI env vars are `.trim()`-ed to guard against copy-paste whitespace

## Key Patterns
- `logTransaction(tx)` — always saves `status='Pending'`; accepts optional `leagueId`
- Transaction status flow: `Pending → Done | On Team` (commissioner-only via `PATCH /api/transactions`)
- Cuts identity key: `first|last|age|offense|defense|special` (all lowercase); age-mismatch fallback uses `first|last|offense|defense|special`
- Draft picks: case-insensitive `teamshort` lookup (some leagues seeded with mixed case)
- Resources: filtered by `leagueId`; admin PATCH/DELETE scoped to `and(eq(id), eq(leagueId))`

## Important Notes
- Run `npm run lint` before suggesting a commit
- Do not push to remote without explicit user confirmation
- Always commit `schema.ts` when adding columns — Vercel build will fail if referenced columns aren't in the committed schema
