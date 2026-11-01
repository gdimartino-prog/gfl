---
name: db-triage
description: Triage a GFL database incident — Supabase connection/pool errors, CPU or egress spikes, "data looks stale" (cache vs DB), missing RLS after a schema push, duplicate players, draft board drift. The read-only diagnostic sequence to run before touching anything. Use when Vercel logs show Postgres errors, a Supabase alert fires, or a coach reports wrong/stale data.
---

# GFL DB triage

**Rule zero:** diagnose read-only. Every `fix-*` / `seed-*` / `migrate-*` / `reset-*` script and every `db:push` is production-affecting — George approves each run. Never rotate `POSTGRES_URL` credentials as a reflex.

## Step 0 — is it the cache, not the DB?

Most "wrong data" reports are a stale `unstable_cache` entry, not a bad row. Check the reader's tag (`AGENTS.md § Stack` lists them) and whether the mutation path busts it with `revalidateTag(tag, 'max')`. On production, `POST /api/admin/revalidate` (superuser) busts tags without a deploy. On localhost, `revalidateTag` never flushes the file cache — restart `npm run dev`. Only after the cache is ruled out, read the row:

```bash
node --env-file=.env.local --import tsx scripts/check-tables.ts      # row counts per table per league
node --env-file=.env.local --import tsx scripts/check-dupes.ts       # duplicate player identities
node --env-file=.env.local --import tsx scripts/check-draft-state.ts # active pick / clock state
node --env-file=.env.local --import tsx scripts/audit-trade-picks.ts # draft board vs trade transactions
npm run db:studio                                                    # browse rows (read only!)
```

## Step 1 — connection / pool errors in Vercel logs

| Symptom | Cause | Action |
|---|---|---|
| `Connection terminated unexpectedly` during `db:push` | drizzle-kit went over the WebSocket pooler | `drizzle.config.ts` must resolve `POSTGRES_URL_NON_POOLING` and `pg` must be installed (`npm ls pg`) |
| `remaining connection slots are reserved` / `too many clients` | runtime bypassed the pooler (port 5432 in `POSTGRES_URL`), or a script opened its own pool in a loop | `POSTGRES_URL` must be the **6543** transaction pooler; scripts import `lib/db` once |
| `self-signed certificate in certificate chain` | `pg` verifying Supabase's chain | keep `?uselibpqcompat=true` (drizzle.config.ts appends it) |
| `prepared statement "…" already exists` | session-level feature on the transaction pooler | no `prepare: true`, no `SET`, no multi-statement session state in runtime code |
| `function/relation … does not exist` right after a deploy | `schema.ts` shipped without `db:push` (or vice versa) | run `npm run db:push` in an interactive terminal; commit `schema.ts` with its code |

## Step 2 — CPU / egress spike on Supabase

1. Supabase dashboard → Reports → check whether the spike aligns with the 5-min draft cron (`/api/cron/draft` from cron-job.org), the daily 12:00 UTC GitHub crons, or the 06:00 UTC backup (`db-backup.yml` reads every table).
2. Vercel → Observability → Functions: which route's invocations rose? A client re-render loop shows as the same tenant hitting `/api/draft-picks` / `/api/rosters/counts` dozens of times a minute; the `qa` agent's "API loop check" reproduces it.
3. `pg_stat_statements` (Supabase SQL editor, read-only): top queries by `total_exec_time`. A `SELECT *` on `players` with scouting JSON, or `teams` without a column list, is the usual egress culprit — the fix is the lean reader (`getPlayers()`, `getPlayerDetail()`), not a bigger plan.
4. `pg_stat_activity` for long `active`/`idle in transaction` backends from `application_name` containing `vercel`/`node`. Terminating a backend (`pg_terminate_backend(pid)`) is production-affecting — ask first.
5. Record the correlation (route × time × query) in memory, not just the conclusion.

## Step 3 — RLS / schema drift

```sql
select tablename, rowsecurity from pg_tables where schemaname='public' order by 1;
```
Any `false` → `npx tsx scripts/enable-rls.ts` (re-runnable; prints each table). Tables created or recreated by `drizzle-kit push` start with RLS **off**. Also confirm the three composite uniques still exist (`rules_league_year_rule_unique`, `standings_league_team_year_unique`, `trade_block_league_player_unique`) — a past "truncate" answer at the drizzle prompt would have emptied the table.

## Step 4 — data integrity

- **Duplicate players:** `scripts/check-dupes.ts` → if real, `scripts/dedupe-players.ts` (write — approve first; same logic as `processPlayersFile`).
- **Draft board vs trades:** `audit-draft-and-trades` skill (`audit-trade-picks.ts`, `check-pick-owners.ts`, `check-traded-picks.ts`).
- **IR flags:** `check-ir-flags.ts` — IR MOVE transactions don't set `isIR`; manual fix is expected.
- **Roster limits:** `audit-roster-limits.ts`.
- **Cross-league leakage:** a row whose `league_id` doesn't match its team's league → find the mutation route that took `leagueId` from the request instead of `getLeagueId()`; that is a 🔴 SecOps finding, not a data fix.

## Recovery

`scripts/restore-db.ts` restores from `backups/*.json` (daily, PII-stripped: `teams.json` has no passwords/emails/mobiles — coaches must reset after a full restore). Production-affecting; dry-run the plan and get approval.
