---
name: db-schema-push
description: >-
  Safely modify schema.ts, push Drizzle schema changes to Supabase/Vercel Postgres,
  handle composite unique-constraint interactive prompts without truncating tables,
  and re-enable Row-Level Security (RLS). Use whenever adding or altering DB columns,
  tables, or indexes in schema.ts.
---

# DB Schema Push & RLS Runbook

## Workflow

1. **Edit `schema.ts`**:
   - Use Drizzle `pgTable` exclusively.
   - Every tenant table MUST include `leagueId: integer("league_id").references(() => leagues.id)`.
   - Commit `schema.ts` with any code that uses the new columns so Vercel builds succeed.

2. **Push Schema (`npm run db:push`)**:
   - `npm run db:push` runs `drizzle-kit push && npx tsx scripts/enable-rls.ts` over the direct TCP connection (`POSTGRES_URL_NON_POOLING`, port 5432).
   - **Interactive Prompt Gotcha (CRITICAL):** `drizzle-kit` 0.30.x/0.31.x always proposes to drop and re-add `rules_league_year_rule_unique`, `standings_league_team_year_unique`, and `trade_block_league_player_unique`.
   - At each prompt, ALWAYS pick **"No, add the constraint without truncating the table"** — NEVER choose truncate.
   - Keep `rules` as a `unique()` constraint (not `uniqueIndex()`), because `NULLS NOT DISTINCT` isn't supported on the index builder in `drizzle-orm` 0.45.x.

3. **Verify RLS Re-Enabled**:
   - If `drizzle-kit push` was invoked directly instead of `npm run db:push`, immediately run:
     ```bash
     npx tsx scripts/enable-rls.ts
     ```
