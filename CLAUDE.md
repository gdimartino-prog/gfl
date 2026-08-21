# GFL — Claude Code Instructions

GFL Fantasy Football League Manager — Next.js + Vercel Postgres (Supabase) + Drizzle, multi-league via row-level tenancy. **GFL = leagueId 1.**

**Canonical reference:** [ARCHITECTURE.md](./ARCHITECTURE.md) is the source of truth for tech stack, full DB schema, project structure, API routes, auth flow, draft system, notification system, cron jobs, and caching strategy. Read it before designing anything non-trivial.

This file holds Claude-specific working agreements: how to make changes safely, what to commit, what conventions to follow, and the gotchas that bite.

---

## Common Commands

```bash
npm run dev              # Dev server (localhost:3000)
npm run build            # Production build
npm run lint             # ESLint
npm run db:push          # Push schema changes (interactive terminal only — WebSocket drops on non-interactive input)
npm run db:studio        # Drizzle Studio
npx tsx scripts/enable-rls.ts   # Re-enable RLS — REQUIRED after every db:push
```

Run scripts with env loaded:
```bash
node --env-file=.env.local --import tsx scripts/foo.ts
```

---

## Working Agreements

- **Run `npm run lint` before suggesting a commit.**
- **Never push to remote without explicit user confirmation.** The pre-push hook runs lint + build; if it fails, fix the underlying issue, don't bypass it.
- **Schema first.** Add columns to `schema.ts` → `npm run db:push` → `npx tsx scripts/enable-rls.ts` → write lib code. **Always commit `schema.ts`** when adding columns or Vercel build will fail.
- **Keep API routes thin.** Business logic belongs in `/lib`.
- **Server Components by default.** Add `"use client"` only when needed.
- **TypeScript interfaces** live in `types/index.ts` — check before creating new ones.
- **Don't use `google-spreadsheet` or any Google Sheets code** for anything new. The migration is complete; remaining references in `scripts/` are one-shot legacy.

---

## Pre-push code review

Before pushing any non-trivial code change (API routes, DB queries, auth, external API calls, user input handling, file uploads, background jobs), run the **secops**, **finops**, and **perf** agents in parallel on the uncommitted diff. All three agents are user-level (installed under `~/.claude/agents/`) — available in every project, no per-project setup needed. **finops findings always take precedence over perf findings** when they conflict — cost/egress concerns outrank raw speed optimizations.

**Also include the `qa` agent in the parallel review when the change touches UI, auth, login flow, or interactive elements** (page edits, components, forms, navigation, session handling). Skip qa for pure backend, prompt, utility, schema, or docs changes — the pre-push hook (lint + build) plus secops/finops/perf already cover those, and qa runs a 5–15 min Playwright browser session that's overkill for backend-only edits.

Brief each agent with: files changed, what changed, and any prior findings if this is a re-review. Ask for severity-tagged findings and an explicit approve / block verdict.

Only push if every invoked agent approves. If any flags a blocker, fix and re-review. If two or more independently flag the same minor cleanup, fold it in before pushing — converging independent suggestions are a strong signal.

Pure UI refactors with no behavior change can skip the review entirely. Don't bypass by amending an existing commit — make a new commit and re-review.

---

## Code Conventions

### Multi-league tenancy
- Every query on a tenant table must filter by `leagueId`.
- Use `getLeagueId()` from `lib/getLeagueId.ts` server-side. It's wrapped in React `cache()` so calling it multiple times per request is free.
- Default to `leagueId = 1` only as a fallback for unauthenticated/edge cases.

### Cache pattern
```ts
const _fn = unstable_cache(
  async (leagueId: number) => { /* DB query */ },
  ['cache-key'],
  { revalidate: 60, tags: ['tag'] }
);
export async function fn(leagueId = 1) { return _fn(leagueId); }
```
Bust caches in mutation routes: `revalidateTag('tag', 'max')`. See [ARCHITECTURE.md § Caching Strategy](./ARCHITECTURE.md#caching-strategy) for the full cache key / tag list.

### Identity keys (dedup)
- **Players:** `first|last|age|offense|defense|special` (all lowercase). Used by `lib/maintenance.ts` upsert.
- **Cuts:** same as players; age-mismatch fallback drops the age field.

### Mixed-case `teamshort`
Some leagues have mixed-case `teamshort` values seeded historically. **Always compare case-insensitively** — in SQL use `sql`upper(${teams.teamshort}) = ${code.toUpperCase()}`` , never a bare `eq()`.

### Privilege checks
Use **`isPrivileged()`** from `lib/auth.ts` (superuser, or DB-verified commissioner in the active league; React-`cache()`d so repeated calls cost one query). Never trust the JWT `role` alone — it's stale for up to 30 days after a demotion — and never write `await isAdmin() || await isCommissioner()` (redundant double lookup).

### Client fetches
No `?t=${Date.now()}` cache-busters and no `cache: 'no-store'` on **reads** — plain fetches honor the `private, max-age` headers the APIs set. Use `no-store` only for the refetch immediately after a mutation (see the `loadData(fresh = false)` pattern in the transaction panels).

### Player data access
- Lists: `getPlayers()` (lean, cached). FA views: `getFAPlayersWithScouting()`.
- Single player with scouting: `getPlayerDetail(leagueId, identity)` — a cached indexed row lookup. **Never fetch the full player table with scouting JSON**; that path was retired (`/api/players?scouting=1` returns 410).
- Player mutations that change `teamId` must bust the `players` tag (drafts, trades, transactions all do).

### Audit fields
Every mutation writes `touch_id` (actor) and `touch_dt` (timestamp). Don't skip these — they're how we trace incidents.

---

## Gotchas

### Awaiting notifications
**All `notify*()` calls must be `await`ed.** Vercel serverless kills unawaited promises on response return, silently losing the notification.

### WhatsApp is GFL-only
`lib/notify.ts` checks `leagueId === 1` before calling `sendWhatsApp()`. GreenAPI env vars are `.trim()`-ed to handle copy-paste whitespace.

### `revalidateTag` arity
This Next.js version requires `revalidateTag(tag, 'max')` — single-arg form is a type error and breaks the build.

### `revalidateTag` on localhost
Doesn't flush the file-based dev cache. Restart `npm run dev` after a player sync to see updated team assignments.

### `force-dynamic` is rarely needed
Dropping `force-dynamic` lets Next.js cache server-component output and honors `unstable_cache` more aggressively. Only add it when there's a concrete reason (a route that must not be cached even briefly).

### Cache headers on league-scoped routes
Use `Cache-Control: private, max-age=N` — never `s-maxage` — for endpoints whose response depends on the `gfl-league-id` cookie. Shared CDN caching would leak one league's data to another league's users.

### `logSystemEvent` must be awaited
Same reason as `notify*()`. Vercel kills unawaited promises.

### Transaction status
`logTransaction()` always saves `status='Pending'`. Commissioners flip to `Done` or `On Team` via `PATCH /api/transactions`.

### Player file imports clean up duplicates
`processPlayersFile` consolidates same-identity rows in the DB before upserting. The standalone `scripts/dedupe-players.ts` runs the same logic as a one-shot cleanup.

### Trades execute unilaterally (intentional)
`/api/trades` moves assets on one coach's submission — no acceptance step. Same trust model as the permissive late-pick auth: audit log + league-wide notification + commissioner undo are the guardrails. Don't propose an approval workflow; do keep the ownership checks (both teams must resolve, assets must belong to the sending teams).

### Cross-league identity is email-based
`getLeagueId()` honors the league cookie only if the user's email matches an **active** credentialed team in that league (teamshort is NOT unique across leagues). Email changes via `/api/teams` are audited and bust the `team-leagues` cache — keep it that way.

### COA blob keys are league-scoped
Uploads write `<leagueId>/NAME.COA` for non-GFL leagues; GFL (league 1) keeps legacy unprefixed keys. The GET matches full paths — don't revert to basename matching.

### DB backups exclude PII
`scripts/backup-db.ts` deliberately omits `password`, `email`, and `mobile` from the committed `backups/teams.json` — backups live in git history forever. Never add them back.

---

## Cron Routes
See [ARCHITECTURE.md § Cron Jobs](./ARCHITECTURE.md#cron-jobs--automation) for the dispatcher split. Key point: `/api/cron/draft` is fired by cron-job.org (not GitHub Actions — `*/5` schedules are throttled on GH). All cron routes require `Authorization: Bearer CRON_SECRET`.

---

## Environment Variables

Maintained in `.env.local` — never commit. Full list in [ARCHITECTURE.md § Deployment Pipeline](./ARCHITECTURE.md#deployment-pipeline).

Keys to know off the top of your head:
- `POSTGRES_URL` — DB
- `AUTH_SECRET` — NextAuth
- `CRON_SECRET` — cron auth header
- `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` — superuser bypass login
- `SEND_WHATSAPP=false` — globally disable WhatsApp (useful for testing)
