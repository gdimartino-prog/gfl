# GFL — Claude Code Instructions (Migration Project)

## Project Overview
This is the **migration fork** of the GFL Fantasy app. The goal is to replace the Google Sheets backend with **Vercel Postgres + Drizzle ORM**. The source-of-truth for UI/features is the sibling project at `../gfl-fantasy`.

**Status:** Active migration. Some tables are fully migrated to Postgres; others still use Google Sheets.

## Tech Stack
- **Framework:** Next.js (App Router) with TypeScript
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **DB (target):** Vercel Postgres via `@vercel/postgres`
- **ORM:** Drizzle ORM (`drizzle-orm`, schema in `schema.ts`)
- **Data (legacy):** Google Sheets API (`googleapis`) — being phased out
- **Auth:** NextAuth v5 (beta)
- **AI:** Google Gemini (`@google/generative-ai`) for game summaries
- **Deployment:** Vercel
- **Migration scripts:** `scripts/` directory, run via `npm run db:migrate:*`

## Migration Status

### Fully migrated to Vercel Postgres (Drizzle ORM):
| Area | Lib file | Notes |
|------|----------|-------|
| Teams | `lib/config.ts` | Reads from DB |
| Rules/Settings | `lib/rules.ts` | Reads from DB |
| Resources | `lib/getResources.ts` | Reads from DB |
| Schedule | `lib/getSchedule.ts` | Reads from DB |
| Standings | `lib/getStandings.ts` | Reads from DB |
| Players | `lib/players.ts` | Reads from DB |
| Transactions | `lib/transactions.ts` | Reads/writes to DB |
| Draft Picks | `lib/draftPicks.ts` | Reads from DB |
| Cuts | `lib/cuts.ts` | Reads from DB (new file) |

### Still using Google Sheets (to be migrated):
- `lib/maintenance.ts` — file upload processing
- `lib/getSettings.ts` — league settings (used for metadata)
- `lib/auth.ts` — admin/commissioner role check
- `lib/gemini.ts` — AI summary (no DB needed)
- Trade block API route — uses Google Sheets tab

### Migration infrastructure:
- `schema.ts` — Drizzle table definitions
- `lib/db.ts` — DB connection
- `lib/db-helpers.ts` — shared DB utilities
- `drizzle.config.ts` — Drizzle config
- `drizzle/` — generated migration files
- `scripts/` — one-time data migration scripts

## Project Structure
```
app/                  # Next.js App Router pages & API routes
  api/                # API route handlers
  (pages)/            # UI pages: rosters, standings, schedule, draft, etc.
lib/                  # Business logic — mix of DB (Drizzle) and Sheets
  db.ts               # Vercel Postgres connection
  db-helpers.ts       # Shared DB utilities
  cuts.ts             # Drizzle ORM (migrated)
  rules.ts            # Drizzle ORM (migrated)
  ...
schema.ts             # Drizzle table schema (source of truth for DB)
drizzle/              # Auto-generated SQL migrations
scripts/              # One-time data migration scripts
types/index.ts        # Shared TypeScript interfaces
components/           # UI components
```

## Common Commands
```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:push          # Push schema changes to DB
npm run db:studio        # Open Drizzle Studio
npm run db:migrate:teams # Run teams migration script
```

## Environment Variables
All in `.env.local` — never commit this file:
- `POSTGRES_URL` — Vercel Postgres connection string
- `GOOGLE_SHEET_ID` — legacy Google Sheet ID (still needed for unmigrated parts)
- `GOOGLE_CLIENT_EMAIL` — service account email
- `GOOGLE_PRIVATE_KEY` — service account private key
- `AUTH_SECRET` — NextAuth secret
- `GOOGLE_GENERATIVE_AI_KEY` — Gemini API key

## Code Conventions
- **Schema first:** Add new tables to `schema.ts` before writing backend code
- **Always use Drizzle** for new DB logic — never use `google-spreadsheet` for new code
- **TypeScript interfaces** in `types/index.ts` — check before creating new ones
- **App Router patterns** — Server Components by default; `"use client"` only when needed
- **Keep API routes thin** — put logic in `/lib`
- **shadcn/ui** for UI components

## Migration Rules
- When migrating a lib file: replace Google Sheets calls with Drizzle queries, keep the same function signatures
- Test data parity after migration — verify counts and sample records match
- Remove Google Sheets imports from a file only after the migration is confirmed working
- Reference `../gfl-fantasy` for the latest bug fixes to any lib file before migrating it

## Important Notes
- Run `npm run lint` before suggesting a commit
- Do not push to remote without explicit user confirmation
- The `AGENT.md` file contains additional migration standing orders — follow them
- Never overwrite files in `lib/` that have already been migrated to Drizzle
- The sibling project `../gfl-fantasy` is the source for UI/feature changes
