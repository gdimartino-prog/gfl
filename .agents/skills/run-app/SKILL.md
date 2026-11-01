---
name: run-app
description: Launch and drive GFL locally — Next.js dev server against the real Supabase DB, env requirements, test accounts, the node:test unit suite, Playwright-MCP browser checks and their known flakes. Use when asked to run, start, screenshot, or manually verify the app, or to reproduce a bug in a real browser.
---

# Run GFL locally

## Dev server

`npm run dev` → http://localhost:3000. There is no mock DB: the dev server talks to the **production Supabase** database named in `.env.local` (`POSTGRES_URL`, pooled). Treat every write from localhost as a production write — use the demo league (id 2) or a throwaway league for anything destructive, and ask before running write scripts.

Required env (`.env.local`, never printed or committed): `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `AUTH_SECRET`, `SUPERUSER_USERNAME/PASSWORD`, `DEMO_USERNAME/PASSWORD`, `CRON_SECRET`. Optional: `GOOGLE_GENERATIVE_AI_KEY` (press-box/scout), `GMAIL_*`/`GREENAPI_*` (set `SEND_WHATSAPP=false` locally so test actions don't message the real league group), `NEXT_PUBLIC_APP_URL`.

Health probe: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/leagues` → `200`. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/cron/draft` → `401` means cron auth is wired.

## Signing in

| Role | Username | Password | Notes |
|---|---|---|---|
| Superuser | `$SUPERUSER_USERNAME` | `$SUPERUSER_PASSWORD` | env-var bypass; league switcher follows the `gfl-league-id` cookie |
| Demo commissioner | `$DEMO_USERNAME` | `$DEMO_PASSWORD` | role `demo`, locked to league 2 — safest account for browser testing |
| League coach | team **name** (not teamshort) or email, plus league | per team | bcrypt in `teams.password`; set one with `scripts/set-demo-password.ts` |

Read credentials from `.env.local` at run time; never paste them into transcripts, docs, or agent definitions. Login is rate-limited to 8 attempts / 10 min per IP — a failing Playwright loop locks you out; wait or restart the dev server (the bucket is in-memory).

## Test suites

- **Unit:** `npm test` → `tsx --test tests/*.test.ts` (node:test; `concurrency`, `cronAuth`, `ourlads`, `rateLimit`; ~2 s). Always green before push. New `/lib` helpers get a test here — pure functions only, no DB.
- **Static gate:** `npm run lint`, `npm run semgrep` (needs semgrep from a `.venv` or PATH — `scripts/run-semgrep.mjs` also looks in `../slp-activity-generator/.venv`), `npm run build`. All four: `npm run verify:prepush`.
- **Browser:** no checked-in Playwright specs; the `qa` agent drives the app through the Playwright MCP (`browser_navigate` → `browser_snapshot` → click → `browser_console_messages` / `browser_network_requests`). TARGETED mode = `/login` + the routes the diff touched; FULL mode = every page in `.claude/agents/qa.md`. Save screenshots under `%TEMP%`, never the repo root (`*.png` is gitignored anyway).

## Known flakes / gotchas

- `revalidateTag` does not flush the file-based dev cache: after a player sync or roster mutation, restart `npm run dev` before judging "stale data" a bug.
- First request after start compiles each route (5–20 s); don't count it in the "API loop check" (>3 calls to the same endpoint in 10 s on `/draft` = real re-render loop).
- ESPN endpoints hang for minutes at times; `lib/espn-stats.ts` aborts at 8 s, so `/nfl-draft`, `/api/nfl-stats`, and `/api/espn-news` can show partial data — not a regression.
- WhatsApp/email from localhost is real unless `SEND_WHATSAPP=false` / `GMAIL_APP_PASSWORD` unset; the draft cron (`/api/cron/draft`) is only fired by cron-job.org against production, so the local clock never advances on its own — hit it manually with the bearer header.
- `npm run db:push` must run in an interactive terminal (drizzle-kit prompts) and over the direct connection; see the `db-schema-push` skill.

## Throwaway verification

For a one-off browser check, use the Playwright MCP directly (demo account), or write a short `scripts/zzz-*.ts` read-only query run with `node --env-file=.env.local --import tsx scripts/zzz-*.ts`, and delete it afterwards.
