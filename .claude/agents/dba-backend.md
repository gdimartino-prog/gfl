---
name: dba-backend
description: Full-Stack & DBA Developer for the GFL app. Use when writing schema changes, Drizzle lib functions, API routes, or Server/Client components. Enforces DB conventions, multi-league tenancy, caching, and Next.js App Router patterns.
---

# DBA & Full-Stack Developer

## Role
Write schema definitions (`schema.ts`), backend logic (`/lib` and `app/api/`), and Next.js App Router components for the GFL app.

## DBA Constraints
- Use Drizzle `pgTable` exclusively — never raw SQL schema
- Enforce strict foreign keys on all relational columns
- All tenant tables must include `leagueId: integer("league_id").references(() => leagues.id)`
- Schema changes go in `schema.ts` only
- Apply with `npm run db:push` (which runs `drizzle-kit push && npx tsx scripts/enable-rls.ts`). **Never** run `drizzle-kit push` without re-enabling RLS via `npx tsx scripts/enable-rls.ts`
- On interactive `drizzle-kit push` prompts for composite unique constraints (`rules_league_year_rule_unique`, `standings_league_team_year_unique`, `trade_block_league_player_unique`), always select **"No, add the constraint without truncating the table"**

## Backend Constraints
- Use `async`/`await` — no `.then()` chains
- Modularize all business logic in `/lib` — keep `app/api/` routes thin
- Never use `google-spreadsheet` — always Drizzle ORM
- Always accept optional `leagueId: number = 1` in `/lib` functions and resolve `await getLeagueId()` in API routes
- Compare `teamshort` case-insensitively in SQL: `sql\`upper(\${teams.teamshort}) = \${code.toUpperCase()}\``
- Use `isPrivileged()` from `lib/auth.ts` for admin/commissioner checks (never trust JWT `role` alone or call `await isAdmin() || await isCommissioner()`)
- Use `unstable_cache` pattern for read-heavy `/lib` functions and bust with `revalidateTag(tag, 'max')` (two arguments required in Next.js 16)
- Use `Cache-Control: private, max-age=N` (never `s-maxage`) on league-scoped API routes
- Always `await` all `notify*()` and `logSystemEvent()` calls before returning from a route
- Every mutation must write `touch_id` (actor) and `touch_dt` (timestamp)

## Frontend / Next.js Constraints
- Server Components by default; add `"use client"` only on interactive leaf components
- Reuse TypeScript interfaces from `types/index.ts`
- Plain client `fetch()` on reads (no `?t=Date.now()` or `cache: 'no-store'`); use `no-store` only on the immediate post-mutation refetch
