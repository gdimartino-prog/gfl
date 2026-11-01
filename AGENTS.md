# AGENTS.md — GFL Fantasy Football League Manager

Canonical instructions for every AI coding agent working in this repo (Claude Code, Antigravity, Gemini CLI, Codex, Cursor…). Tool-specific adapters (`CLAUDE.md`, `.claude/**`, `.agents/**`) point here; edit the rules here, not in the adapters.

**Deep reference:** [ARCHITECTURE.md](./ARCHITECTURE.md) — full DB schema, project structure, API routes, auth flow, draft system, notification system, cron jobs, caching strategy. Read it before designing anything non-trivial.

## Stack

- **Next.js 16 App Router + React 19 + TypeScript**, deployed on Vercel (Git integration auto-deploys every push to `main`; `.github/workflows/deploy.yml` is a manual fallback only). Server Components by default; `"use client"` only on interactive leaves (8 files today).
- **Auth:** NextAuth v5 Credentials provider in `auth.ts` (bcrypt team passwords; env-var superuser `SUPERUSER_USERNAME/PASSWORD` and demo `DEMO_USERNAME/PASSWORD` bypasses; per-IP `tokenBucket` throttle). JWT carries `id` = teamshort, `role` ∈ `superuser | admin | demo | user`, `leagueId`. The JWT role is stale for up to 30 days — privilege is verified against the DB with `isPrivileged()` (`lib/auth.ts`).
- **Data:** Supabase Postgres via `@vercel/postgres` + Drizzle (`lib/db.ts`, schema in `schema.ts`). **Multi-league row-level tenancy** — every tenant table carries `league_id`; GFL = `leagueId 1`, demo = 2. RLS is *enabled on every table with zero policies* (`scripts/enable-rls.ts`) and the app connects as the owner role, so **application code is the only tenant boundary**: every query must filter by `leagueId` from `getLeagueId()` (`lib/getLeagueId.ts`, React-`cache()`d; honors the `gfl-league-id` cookie only when the user's email owns an *active* credentialed team in that league).
- **Caching:** `unstable_cache` per `/lib` reader keyed by `leagueId`, busted with `revalidateTag(tag, 'max')` in mutation routes. Tags in use: `players`, `players-fa`, `draft-picks`, `transactions`, `rules`, `teams`, `team-leagues`, `coaches`, `standings`, `schedule`, `trade-block`, `resources`, `cuts`, `history`, `leagues`, `ourlads`, `espn-news`, `nfl-stats`, `fa-power`, `league-stats`, `league-stats-fa`. Tenant-scoped API responses use `Cache-Control: private, max-age=N` — never `s-maxage`.
- **Paid / external surfaces:** Gemini 2.5 Flash (`lib/gemini.ts` — press-box stories, scout reports/recommendations), Gmail via nodemailer + GreenAPI WhatsApp (`lib/notify.ts`; WhatsApp is league 1 only), Vercel Blob (COA uploads, player photos), ESPN + Ourlads public fetches (`lib/espn-stats.ts`, `lib/ourlads.ts`, 8 s timeouts, long `revalidate`).
- **Background jobs:** `/api/cron/{draft,cuts-alert,schedule-reminder,nfl-week}`, all `Authorization: Bearer CRON_SECRET` (`lib/cronAuth.ts`). Draft clock is fired by cron-job.org every 5 min; the rest by `.github/workflows/crons.yml`.
- **Commands:**
  ```bash
  npm run dev              # localhost:3000
  npm run lint             # ESLint (app, components, lib)
  npm run semgrep          # Semgrep SAST (.semgrep.yml via scripts/run-semgrep.mjs)
  npm test                 # node:test suites in tests/*.test.ts (tsx)
  npm run build            # next build
  npm run verify:prepush   # lint + semgrep + test + build (scripts/verify-prepush.mjs)
  npm run db:push          # drizzle-kit push + enable-rls.ts (interactive terminal only)
  npm run db:studio
  node --env-file=.env.local --import tsx scripts/foo.ts   # run a one-off script with env
  ```

## Non-negotiable rules

1. **Tenant isolation.** Every query on a tenant table filters by `leagueId`; every privileged action goes through `isPrivileged()`; no `s-maxage`/`public` caching on any route whose response depends on the session or the `gfl-league-id` cookie. Cross-league identity is email-based — never grant league access on a bare `teamshort` match. COA blob keys are league-prefixed for non-GFL leagues; match full paths, never basenames.
2. **Secrets live only in `.env.local` / Vercel env.** Server-only vars (`POSTGRES_URL*`, `AUTH_SECRET`, `CRON_SECRET`, `SUPERUSER_*`, `DEMO_*`, `GMAIL_APP_PASSWORD`, `GREENAPI_*`, `GOOGLE_GENERATIVE_AI_KEY`, `BLOB_READ_WRITE_TOKEN`) never appear under `components/` or in any `"use client"` file (`.semgrep.yml` encodes this). Never print `.env.local` into a transcript; never commit it.
3. **PII stays out of git and out of logs.** `scripts/backup-db.ts` omits `password`, `email`, `mobile` from `backups/teams.json` — never add them back. `audit_log` rows and `console.log` lines carry ids/names/events, never passwords, tokens, or emails. Only league-internal data (team/player/coach names, box scores) is sent to Gemini.
4. **Commit author** must be `George Di Martino <gdimartino@gmail.com>`. No `Co-authored-by` trailers.
5. **Never push** without an explicit "push" / "yes" from the user, even after a clean review.
6. **Production-affecting DB actions need explicit approval first, every time:** `npm run db:push` / `drizzle-kit push`, any `scripts/*.ts` that writes to the DB (`fix-*`, `seed-*`, `migrate-*`, `apply-*`, `reset-*`), terminating backends, or editing data in Drizzle Studio. After *any* schema push, RLS must be re-enabled (`npx tsx scripts/enable-rls.ts` — `db:push` does it automatically). At the drizzle-kit composite-unique prompts always choose **"No, add the constraint without truncating the table"** — never truncate.
7. **Audit every mutation:** `touch_id` + `touch_dt` on the row, and `await logSystemEvent(...)`. All `notify*()` and `logSystemEvent()` calls are `await`ed — Vercel kills unawaited promises when the response returns.

## Intake — ask before you build

Requirements arrive as a brief in `docs/specs/<name>.md` (template: `docs/specs/TEMPLATE.md`) or, for small work, inline in the request. Before writing any code for a **non-trivial** task, check for the four REQUIRED fields:

1. **Problem** — what's wrong/missing (and a reproduction, for bugs)
2. **Who** — which role(s) (superuser / commissioner / coach / demo / unauthenticated) and which league(s), and who must not be affected
3. **Done when** — observable acceptance checks
4. **Must not** — invariants to protect

If any is missing or ambiguous, **stop and ask** — once, in a single batch of at most 4 questions, each with a recommended default so a one-word answer can unblock you. Do not guess at scope ("GFL only or every league?"), roles ("coaches too, or commissioners only?"), or acceptance criteria. Record the answers in the spec's §5 "Decided" (write them there if a spec file exists) so no one re-asks.

**Non-trivial** = a new feature, a behavior change, or anything touching auth/roles, `getLeagueId()`/tenancy, `schema.ts`, draft clock/picks/trades/transactions logic, notifications, cron routes, caching tags, or external/paid calls. **Trivial** (just do it) = typos, copy changes, a bug with a reproduction already given, an explicit "change X to Y at file:line", or a one-off read-only script.

Also ask when a request contradicts a rule here or a recorded decision (see "Intentional trust-model decisions" below), when the premise doesn't match the code (verify first), or when a different approach would clearly serve better. Ask once, recommend, then proceed on the answer. Never ask what the code can tell you — read it first.

### Intentional trust-model decisions (don't re-litigate)

- **Late draft picks are permissive:** `/api/draft-selection` lets any authenticated user submit a skipped/passed pick for any team. Guardrails are the audit log, the league-wide notification, and commissioner undo.
- **Trades execute unilaterally:** `/api/trades` moves assets on one coach's submission — no acceptance step. Keep the ownership checks; don't propose an approval workflow.
- **Commissioner undo** resumes the clock from the previous pick's `pickedAt` (may immediately re-skip). Don't reset `warningSent` or restart from `now`.
- **Draft cascade passes** need `pickedAt = null`; only explicit-pass teams cascade, never 3-strike auto-skip teams.
- **COA playbooks are public blobs** (meant for other coaches to download); `@vercel/blob` has no private-read mode anyway.
- **IR MOVE transactions don't set `isIR`** — that flag is fixed manually.

## Pre-push review (every `git push`)

1. Compute the diff: `git diff origin/main...HEAD` (add `git diff HEAD` for uncommitted work).
2. **Deterministic gate** — enforced by `.githooks/pre-push` (enable once per clone with `git config core.hooksPath .githooks`) and, in Claude Code, by the `PreToolUse` hook in `scripts/claude-prepush-gate.mjs`: `npm run semgrep` must report **0 findings** and `npm test` must be green. Full CI-equivalent: `npm run verify:prepush` (lint + semgrep + test + build). Fix the underlying issue; never bypass the hook.
3. **Reviewers, scoped to the diff, run in parallel** — definitions in `.claude/agents/*.md` (plain markdown, usable as prompts by any tool):
   - **secops** — always. Owns the `Semgrep SAST Audit: <N> findings` attestation, `isPrivileged()`/`leagueId`/cache-header checks, secret scanning, input validation.
   - **finops** — when `app/api/**`, `lib/**`, `lib/gemini.ts`, `lib/notify.ts`, cron routes, Blob uploads, or any client polling/fetch loop changed. Skip for test-only/docs-only diffs. FinOps findings outrank Perf findings when they conflict, except `s-maxage` is never allowed on tenant-scoped routes.
   - **perf** — when `app/**` pages, `components/**`, `lib/**` readers, or any DB query changed.
   - **supabase-dba** — when `schema.ts`, `scripts/enable-rls.ts`, any `scripts/*` that writes to the DB, `drizzle/**`, or a raw `sql\`\`` fragment changed.
   - **ui-ux** — when a user-facing page/component changed materially (new page, layout, form, dialog, state).
   - **qa** (`.claude/agents/qa.md`) — when UI, auth/login, or interactive elements changed: TARGETED mode by default (Playwright on `/login` + affected routes); FULL mode (all pages) only when asked.
4. Report a punch list by severity — 🔴 Critical / 🟠 High / 🟡 Medium / ⚪ Suggestion — with `file:line`, grouped by reviewer. Pre-existing issues outside the diff are noted, not blocking.
5. Fix 🔴/🟠 SecOps/FinOps/DBA first and re-review; 🟡/⚪ may be deferred with user approval. Then ask **"Push?"** and wait for the explicit yes.

Skip the review for `.md`-only or comment-only diffs (the deterministic gate still runs).

## Project skills (recipes)

Mirrored in `.claude/skills/<name>/SKILL.md` and `.agents/skills/<name>/SKILL.md`:

- `run-app` — dev server, env, test accounts, unit suite, Playwright-MCP checks, known flakes.
- `db-triage` — Supabase connection/CPU/RLS incidents, cache-vs-DB confusion, backend inspection.
- `db-schema-push` — safe `schema.ts` changes, drizzle-kit interactive prompts, RLS re-enable.
- `pre-push-review` — step-by-step orchestration of the gate + parallel reviewers.
- `audit-draft-and-trades` — traded-pick ownership audits and draft clock state.
- `player-data-maintenance` — dedupe, ESPN/NFL sync, photo uploads to Blob.
- `league-provisioning` — seeding/copying leagues, PII-safe backups.

## Code conventions

- **Schema first:** `schema.ts` → `npm run db:push` → `/lib` function (`unstable_cache`, `leagueId = 1` default param) → thin API route (`getLeagueId()`, `isPrivileged()`, `revalidateTag(tag, 'max')`) → component. **Always commit `schema.ts`** with the code that uses it or the Vercel build fails.
- **Keep API routes thin;** business logic lives in `/lib`. TypeScript interfaces live in `types/index.ts` — check before adding.
- **`teamshort` is mixed-case in some leagues:** compare with `sql\`upper(${teams.teamshort}) = ${code.toUpperCase()}\``, never bare `eq()`.
- **Privilege:** `isPrivileged()` only. Never `await isAdmin() || await isCommissioner()` (double lookup) and never the JWT role alone.
- **Client fetches:** plain `fetch()` on reads (no `?t=${Date.now()}`, no `cache: 'no-store'`); `no-store` only on the immediate post-mutation refetch (`loadData(fresh = false)` pattern).
- **Player data:** lists via `getPlayers()` / `getFAPlayersWithScouting()`; single player via `getPlayerDetail(leagueId, identity)`. Never fetch the full player table with scouting JSON (`/api/players?scouting=1` returns 410). Any mutation that changes a player's `teamId` busts the `players` tag.
- **Identity keys:** players and cuts dedupe on `first|last|age|offense|defense|special` (lowercase); cuts fall back to dropping `age` on mismatch.
- **Transactions:** `logTransaction()` always writes `status='Pending'`; commissioners flip to `Done`/`On Team` via `PATCH /api/transactions`. `fromTeam`/`toTeam` hold full team names, not teamshort.
- **No Google Sheets code** for anything new — the migration is complete; remaining `scripts/` references are legacy one-shots.
- **`force-dynamic` is rarely justified** — only when a route must never be cached even briefly.

## Gotchas

- `revalidateTag` needs two args in this Next.js version — `revalidateTag(tag, 'max')`; the single-arg form breaks the build.
- `revalidateTag` doesn't flush the file-based dev cache on localhost — restart `npm run dev` after a player sync.
- `drizzle-kit push` uses the direct TCP connection (`POSTGRES_URL_NON_POOLING`, `pg` devDependency, `?uselibpqcompat=true`); the runtime driver (`lib/db.ts`, WebSocket) is intentionally separate. drizzle-kit can't match composite `unique()` constraints and will always propose drop+re-add of `rules_league_year_rule_unique`, `standings_league_team_year_unique`, `trade_block_league_player_unique` — answer "No, add the constraint without truncating". `rules` must stay `unique().nullsNotDistinct()` (not `uniqueIndex`).
- `lib/notify.ts` only sends WhatsApp when `leagueId === 1`; GreenAPI env vars are `.trim()`-ed. `SEND_WHATSAPP=false` disables WhatsApp globally.
- `processPlayersFile` consolidates duplicate identities before upserting; `scripts/dedupe-players.ts` is the standalone equivalent.
- Email changes via `/api/teams` are audited and bust `team-leagues` — keep it that way.
- GitHub `*/5` cron schedules are throttled, which is why the draft clock lives on cron-job.org; `nfl-week` and `schedule-reminder` are also duplicated there (intentional redundancy for `nfl-week`).

## Environment variables

Maintained in `.env.local` (never committed); full list in [ARCHITECTURE.md § Deployment Pipeline](./ARCHITECTURE.md#deployment-pipeline). Ones to know: `POSTGRES_URL` / `POSTGRES_URL_NON_POOLING`, `AUTH_SECRET`, `CRON_SECRET`, `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD`, `DEMO_USERNAME` / `DEMO_PASSWORD`, `GOOGLE_GENERATIVE_AI_KEY`, `GMAIL_USER` / `GMAIL_APP_PASSWORD`, `GREENAPI_*`, `SEND_WHATSAPP`, `NEXT_PUBLIC_APP_URL`.
