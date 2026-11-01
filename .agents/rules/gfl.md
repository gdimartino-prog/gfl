# Antigravity workspace rule — GFL

All project rules for this repository are in `AGENTS.md` at the repo root. Read it in full before any task; it is the single source of truth shared with Claude Code. `ARCHITECTURE.md` is the deep technical reference.

Key points restated so they are never missed:

- **Intake** (`AGENTS.md` § Intake): for any non-trivial task, if the brief lacks Problem / Who / Done-when / Must-not, ask once (≤4 questions, each with a recommended default) before writing code; record answers in the spec's §5 "Decided". Template: `docs/specs/TEMPLATE.md`.
- **Tenant isolation is application code.** Every tenant-table query filters by `leagueId` from `getLeagueId()`; privileged actions use `isPrivileged()` (`lib/auth.ts`); tenant-scoped responses use `Cache-Control: private, max-age=N` — never `s-maxage`. `teamshort` compares case-insensitively (`upper()`).
- **Secrets** live only in `.env.local` / Vercel env; server-only vars never appear under `components/` or `"use client"` files. Never print `.env.local`. `backups/teams.json` never contains `password`/`email`/`mobile`.
- **Never push** without the user's explicit "push"/"yes". Before any push: `npm run semgrep` (0 findings) and `npm test` (green); `.githooks/pre-push` enforces this when `core.hooksPath` is set. Full gate: `npm run verify:prepush`.
- **DB changes are production-affecting** — ask before `db:push`, any write script in `scripts/`, or Drizzle Studio edits. Re-enable RLS after every push (`npx tsx scripts/enable-rls.ts`). Never choose "truncate" at a drizzle-kit prompt.
- **Every mutation** writes `touch_id`/`touch_dt`, `await`s `logSystemEvent(...)` and every `notify*()`, and busts the right cache tag with `revalidateTag(tag, 'max')` (two args).
- **Pre-push reviewers** are plain markdown under `.claude/agents/` (`secops` always; `finops`, `perf`, `supabase-dba`, `ui-ux`, `qa` by touched paths) — use them as prompts for Antigravity sub-tasks and report 🔴/🟠/🟡/⚪ findings with `file:line`.
- **Commit author:** `George Di Martino <gdimartino@gmail.com>`, no `Co-authored-by` trailers.
- **Operational recipes:** `.agents/skills/{run-app,db-triage,db-schema-push,pre-push-review,audit-draft-and-trades,player-data-maintenance,league-provisioning}/SKILL.md`.
