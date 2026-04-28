# GFL App — Architecture Overview

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [Multi-League Architecture](#multi-league-architecture)
6. [API Routes](#api-routes)
7. [Player Data Flow](#player-data-flow)
8. [Draft System](#draft-system)
9. [Trade Flow](#trade-flow)
10. [Notification System](#notification-system)
11. [Cron Jobs & Automation](#cron-jobs--automation)
12. [Deployment Pipeline](#deployment-pipeline)
13. [Caching Strategy](#caching-strategy)
14. [Key Conventions](#key-conventions)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Vercel Postgres (Supabase) via `@vercel/postgres` |
| ORM | Drizzle ORM (`schema.ts` is source of truth) |
| Auth | NextAuth v5 (credentials provider, JWT strategy) |
| AI | Google Gemini (`@google/generative-ai`) — game summaries |
| Email | Nodemailer (Gmail SMTP) |
| WhatsApp | GreenAPI (GFL league only) |
| Deployment | Vercel |

---

## Project Structure

```
gfl/
├── app/
│   ├── page.tsx                      # Dashboard / Home
│   ├── login/                        # Login (league dropdown when >1 league)
│   ├── signup/                       # New coach registration
│   ├── draft/
│   │   ├── page.tsx                  # Live draft board + pre-draft countdown
│   │   └── setup/page.tsx            # Commissioner draft configuration
│   ├── transactions/page.tsx         # Transaction log + Trade Panel
│   ├── rosters/page.tsx              # Team roster viewer
│   ├── free-agents/page.tsx          # Free agent board
│   ├── trade-block/page.tsx          # Players listed for trade
│   ├── standings/
│   │   ├── page.tsx                  # Season standings
│   │   └── summary/page.tsx          # All-time standings summary
│   ├── schedule/page.tsx             # Season schedule + scores
│   ├── cuts/page.tsx                 # Roster cut selections
│   ├── rules/page.tsx                # League rules viewer
│   ├── resources/page.tsx            # League links/documents
│   ├── nfl-draft/page.tsx            # NFL draft reference data
│   ├── press-box/page.tsx            # AI-generated game summaries
│   ├── coaching/page.tsx             # COA file upload/download
│   ├── directory/page.tsx            # Coach contact directory
│   ├── maintenance/page.tsx          # Admin panel (sync, teams, schedule, standings)
│   ├── settings/page.tsx             # Coach profile settings
│   ├── manual/page.tsx               # In-app league manual
│   └── api/                          # API route handlers (see API Routes section)
├── lib/
│   ├── db.ts                         # Vercel Postgres + Drizzle connection
│   ├── db-helpers.ts                 # logSystemEvent()
│   ├── getLeagueId.ts                # Cookie-based active league resolver
│   ├── players.ts                    # getPlayers(), getPlayersWithScouting()
│   ├── config.ts                     # getCoaches() / team helpers
│   ├── transactions.ts               # logTransaction(), getTransactions()
│   ├── draftPicks.ts                 # getAllDraftPicks(), upsertPickTransfer()
│   ├── cuts.ts                       # getCuts(), addCut(), removeCut()
│   ├── rules.ts                      # getRules(), addRule(), updateRule()
│   ├── getStandings.ts               # getStandings()
│   ├── getSchedule.ts                # getSchedule()
│   ├── getResources.ts               # getResources(), addResource()
│   ├── maintenance.ts                # syncPlayersFromFile(), syncStandings(), syncSchedule()
│   ├── notify.ts                     # sendEmail(), sendWhatsApp(), notifyDraftPick(), notifyTransaction(), notifyTradeBlock()
│   ├── auth.ts                       # isAdmin(), isCommissioner()
│   ├── playerUtils.ts                # buildPlayerIdentity()
│   └── playerStats.ts                # Player stat formatting helpers
├── schema.ts                         # Drizzle table definitions (source of truth)
├── types/index.ts                    # Shared TypeScript interfaces
├── components/                       # Shared UI components
│   ├── SelectionModal.tsx            # Draft pick selection modal
│   ├── RecentPicksTicker.tsx         # Draft board live ticker
│   ├── MaintenanceClient.tsx         # Admin maintenance UI
│   └── DraftSetupClient.tsx          # Draft setup UI
├── context/
│   └── LeagueContext.tsx             # useLeague() hook, stores leagueId in cookie
├── auth.ts                           # NextAuth configuration
├── drizzle.config.ts                 # Drizzle config (reads .env.local)
├── drizzle/                          # Auto-generated SQL migration files
└── scripts/                          # Utility / one-time scripts (not active app code)
    └── enable-rls.ts                 # Re-enable RLS after db:push
```

---

## Database Schema

All tenant tables have `leagueId` (row-level tenancy) and `touch_dt` / `touch_id` audit fields. **GFL = leagueId 1.**

### leagues
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| name | varchar | Display name |
| slug | varchar UNIQUE | URL-safe identifier |
| legacyUrl | varchar | Old domain for redirects |

### teams
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| name | varchar | Full team name |
| coach | varchar | Head coach name |
| teamshort | varchar(10) | Short code used as login ID |
| nickname | varchar | Optional mascot/alias |
| isCommissioner | boolean | Commissioner flag |
| status | varchar | active / pending / inactive |
| mobile / email | varchar | Contact info |
| password | varchar | bcrypt hash |
| coa_last_sync | timestamp | Last player file upload |
| **Indexes** | teams_league_id_idx, teams_teamshort_league_idx | |

### players
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| name / first / last | varchar | |
| age | integer | |
| position | varchar | Canonical position (QB, RB, etc.) |
| offense / defense / special | varchar | Position codes from game file |
| identity | varchar | Dedup key: `first\|last\|age\|offense\|defense\|special` |
| isIR | boolean | Injured reserve |
| overall | varchar | Overall rating |
| runBlock / passBlock / rushYards / interceptionsVal / sacksVal / durability | varchar | Core ratings |
| scouting | jsonb | Full scouting report (salary, receiving, contract, etc.) |
| teamId | integer → teams.id | NULL = free agent |
| **Indexes** | players_league_id_idx, players_team_id_idx, players_identity_league_idx | |

### transactions
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| date | timestamp | |
| type | varchar | ADD / DROP / TRADE / IR MOVE / etc. |
| description | text | Human-readable summary |
| fromTeam / toTeam | varchar | Teams involved |
| owner | varchar | Initiating coach |
| status | varchar | Pending / Done / On Team |
| weekBack / season / fee | integer | Additional context |
| emailStatus | varchar | sent / skipped / error |
| **Indexes** | transactions_league_date_idx, transactions_league_status_idx | |

### draft_picks
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| year / round / pick | integer | Pick identity |
| draftType | varchar | free_agent / rookie / etc. |
| originalTeamId | integer → teams.id | Pick's original owner |
| currentTeamId | integer → teams.id | Current owner (may differ if traded) |
| playerId | integer → players.id | NULL until selection made |
| scheduledAt | timestamp | When pick timer started |
| pickedAt | timestamp | When selection was recorded |
| passed / warningSent | boolean | Clock management flags |
| selectedPlayerName | varchar | Snapshot of player name at pick time |

### draft_pick_transfers
Persistent record of traded pick ownership — survives draft regeneration.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId / year / draftType / round | | Pick identity |
| originalTeamId / currentTeamId | integer → teams.id | |
| **Unique** | (leagueId, year, draftType, round, originalTeamId) | |

### cuts
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| year / teamId | | |
| firstName / lastName / age | | |
| offense / defense / special | varchar | Position codes |
| status | varchar | protected / pullback |
| datetime | timestamp | When saved |

### rules
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| year | integer | NULL = global rule |
| rule | varchar | Key (e.g., `cuts_year`, `draft_clock_minutes`) |
| value | varchar | Value |
| desc | text | Description |
| **Unique** | (leagueId, year, rule) | |

### resources
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| group / title / url | varchar | |
| sortOrder | integer | Display order |

### standings
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| teamId | integer → teams.id NOT NULL | |
| year | integer | |
| wins / losses / ties | integer | |
| offPts / defPts | integer | |
| isDivWinner / isPlayoff / isSuperBowl / isChampion | boolean | |
| oldTeamName / coachName | varchar | Historical snapshots |

### schedule
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| year / week | | |
| homeTeamId / awayTeamId | integer → teams.id | |
| home_score / away_score | integer | |
| is_bye | boolean | |

### trade_block
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| playerId | varchar | Player identity string |
| playerName / team / position / asking | varchar | |
| **Unique** | (leagueId, playerId) | One entry per player per league |

### audit_log
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id NOT NULL | |
| timestamp | timestamp | |
| coach / team / action / details | varchar/text | |

### nfl_draft
Global reference table — no leagueId.

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| year / round / pick / roundPick | integer | |
| playerName / position / nflTeam / college | text | |

**RLS:** All tenant tables have Row Level Security enabled. App connects via service role key (bypasses RLS). Must re-enable after every `npm run db:push`:
```bash
npx tsx scripts/enable-rls.ts
```

---

## Authentication & Authorization

### Auth Flow
1. Login form calls `/api/leagues?public=true` — shows league dropdown if >1 league
2. User submits teamshort (or email) + password + leagueId
3. NextAuth `authorize` in `auth.ts`:
   - **Superuser check**: env vars `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` → role `'superuser'`
   - **DB check**: lookup by teamshort or email in `teams` table scoped to leagueId; bcrypt compare
4. On success: JWT stores `{ id: teamshort, name: coachName, role, leagueId }`; `gfl-league-id` cookie set

### Roles
| Role | Access |
|------|--------|
| `superuser` | All leagues, all admin functions |
| `admin` | Own league admin functions |
| `coach` | Own team data; read-only for others |

### Helper Functions (`lib/auth.ts`)
- `isAdmin()` — true if `session.user.role === 'admin' | 'superuser'`
- `isCommissioner()` — true if team has `is_commissioner=true` in DB

---

## Multi-League Architecture

Every tenant table has a `leagueId` column. All queries filter by it.

### League Resolution
1. `gfl-league-id` cookie set by `LeagueContext` on the client
2. `getLeagueId()` in `lib/getLeagueId.ts` reads cookie server-side → falls back to `1`

### League Switcher
- Navbar shows switcher only when user's email exists in multiple leagues
- Calls `/api/leagues` (auth-protected); updates cookie on selection

### Active Leagues
| leagueId | Name | URL |
|----------|------|-----|
| 1 | GFL | gfl-alpha.vercel.app / www.gddevco.com |
| 2 | AFL | afl.gddevco.com |

---

## API Routes

### Public
| Route | Method | Description |
|-------|--------|-------------|
| `/api/leagues?public=true` | GET | All leagues (for login dropdown, no auth) |
| `/api/signup` | POST | Create pending team |

### Authenticated
| Route | Method | Description |
|-------|--------|-------------|
| `/api/players` | GET | All players; `?scouting=1` includes full scouting JSON |
| `/api/players/details/[id]` | GET | Single player detail |
| `/api/rosters/[team]` | GET | Roster for a teamshort code |
| `/api/teams` | GET | All active teams for league |
| `/api/transactions` | GET/POST | Transaction log; POST logs new transaction |
| `/api/transactions` | PATCH | Update status (commissioner only) |
| `/api/trades` | POST | Submit trade (own team only for coaches; any team for commissioner) |
| `/api/trade-block` | GET/POST/DELETE | Trade block listings |
| `/api/draft-picks` | GET | All draft picks with transfer info |
| `/api/draft-selection` | POST | Record a draft pick selection |
| `/api/draft-pass` | POST | Pass on a pick (commissioner) |
| `/api/draft-picks/undo` | POST | Undo last selection (commissioner) |
| `/api/draft-picks/expire` | POST | Expire timed-out picks |
| `/api/draft-setup` | GET/POST | Draft configuration |
| `/api/draft-setup/teams` | GET | Teams for draft setup |
| `/api/free-agents` | GET | Free agent list |
| `/api/standings` | GET | Standings |
| `/api/schedule` | GET | Schedule |
| `/api/cuts` | GET/POST/DELETE | Cut player management |
| `/api/cuts/config` | GET | Cuts config rules |
| `/api/rules` | GET/POST/PATCH/DELETE | League rules/settings |
| `/api/rules/initialize` | POST | Seed default rules |
| `/api/leagues` | GET | Leagues accessible to authenticated user |
| `/api/nfl-draft` | GET | NFL draft reference data |
| `/api/press-box` | GET | AI game summaries |
| `/api/upload` | POST | Upload player sync file |
| `/api/test-notify` | POST | Test email/WhatsApp notifications |

### Admin Only
| Route | Method | Description |
|-------|--------|-------------|
| `/api/admin/teams` | GET/POST/PATCH | Team management (create, edit, reset password) |
| `/api/admin/standings` | GET/POST/PATCH/DELETE | Standings management |
| `/api/admin/schedule` | GET/POST/PATCH/DELETE | Schedule management |
| `/api/admin/resources` | GET/POST/PATCH/DELETE | Resources management |
| `/api/maintenance` | POST | Trigger maintenance actions |
| `/api/maintenance/stream` | POST | Streaming player sync (SSE) |
| `/api/signup` | GET/PATCH | View/approve pending signups |

### Cron Jobs
| Route | Description |
|-------|-------------|
| `/api/cron/draft` | Advance draft clock, send warnings, expire picks |
| `/api/cron/cuts-alert` | Alert teams approaching cuts limit |
| `/api/cron/schedule-reminder` | Weekly schedule reminder emails |
| `/api/cron/nfl-week` | Advance NFL week counter |

---

## Player Data Flow

Players originate from the **Action** simulation game. Sync flow:

1. Commissioner exports player file from Action game
2. Uploads via Maintenance page → `/api/maintenance/stream` (Server-Sent Events)
3. `lib/maintenance.ts` `syncPlayersFromFile()`:
   - Matches players to teams by `teamshort` (exact) or team name prefix
   - Builds `identity` key: `first|last|age|offense|defense|special` (all lowercase)
   - Upserts by identity — preserves `id` so draft pick `playerId` refs remain valid across re-syncs
   - Extracts scouting JSONB (ratings, salary, contract, receiving, etc.)
   - Sets `teamId` FK from matched team row
4. Calls `revalidateTag('players', 'max')` after sync

**Note:** On localhost, `revalidateTag` does not flush the file-based Next.js cache — restart the dev server after syncing to see updated player/team assignments.

---

## Draft System

- Draft picks pre-generated in `draft_picks` for each year/round/pick
- **On the clock:** pick with lowest `pick` number where `picked_at IS NULL AND passed = false`
- **Timer:** `scheduled_at` set when pick becomes active; cron checks expiry
- **Pick transfers:** traded picks stored in `draft_pick_transfers` (survives regeneration via upsert)
- **Selection:** commissioner or coach submits via `SelectionModal` → `POST /api/draft-selection`
- **Pass:** commissioner → `POST /api/draft-pass`
- **Pre-draft countdown:** Draft board shows live countdown to `draftStartDate` when no active pick

### Draft Board Features
- Live ticker showing recent picks (`RecentPicksTicker`) with countdown before draft
- Position filters: QB, RB, WR, TE, G, T, C, DL (matches DT/DE/NT), LB (matches ILB/OLB/MLB), CB, S, K, P
- Players sorted by salary descending
- Salary and OVR rating shown per player (OL = overall/2; skill = receiving rating; others = overall)

---

## Trade Flow

1. Coach submits trade via Trade Panel → `POST /api/trades`
   - Non-commissioners: can only submit where their team is `fromTeam`
   - Commissioners: can submit for any team
2. Trade logged as `status='Pending'` in transactions
3. Draft pick transfers applied immediately via `upsertPickTransfer`
4. Player moves **not** made in web app — commissioner makes moves in Action game
5. Commissioner marks `status='Done'` via `PATCH /api/transactions` after moves are made

---

## Notification System (`lib/notify.ts`)

| Function | Trigger | Channels |
|----------|---------|---------|
| `notifyTransaction()` | ADD / DROP / TRADE / IR | Email + WhatsApp (GFL only) |
| `notifyDraftPick(type='PICK')` | Draft selection | Email + WhatsApp (GFL only) |
| `notifyDraftPick(type='WARNING')` | 1hr before clock expires | Email + WhatsApp (GFL only) |
| `notifyDraftPick(type='EXPIRATION')` | Pick clock expired | Email + WhatsApp (GFL only) |
| `notifyTradeBlock()` | Player listed on trade block | Email + WhatsApp (GFL only) |
| Cron email | Cuts alert, schedule reminder | Email only |

- **Email:** Gmail SMTP via Nodemailer; skipped if `GMAIL_APP_PASSWORD` not set
- **WhatsApp:** GreenAPI; skipped if env vars missing; `leagueId === 1` check enforced
- All notify calls must be `await`ed — Vercel serverless kills unawaited promises on response return

---

## Cron Jobs & Automation

Cron jobs run via **GitHub Actions**.

| Workflow | Schedule | Route |
|----------|----------|-------|
| `draft-cron.yml` | Every 5 minutes | `/api/cron/draft` |
| `crons.yml` — nfl-week | Daily noon UTC | `/api/cron/nfl-week` |
| `crons.yml` — cuts-alert | Daily noon UTC | `/api/cron/cuts-alert` |
| `crons.yml` — schedule-reminder | Mondays 2pm UTC | `/api/cron/schedule-reminder` |

All cron routes require `Authorization: Bearer CRON_SECRET` header.

---

## Deployment Pipeline

- **Auto-deploy:** Push to `main` → pre-push hook runs `npm run lint` + `npm run build` → Vercel deploys
- **Domains:** `www.gddevco.com` / `gddevco.com` (GFL), `afl.gddevco.com` (AFL), `gfl-alpha.vercel.app`
- **DNS:** Porkbun → Vercel (A record `216.198.79.1` for root; CNAME for subdomains)
- **DB migrations:** `npm run db:push` (interactive terminal only — WebSocket drops on non-interactive input)
- **Post-migration:** Always run `npx tsx scripts/enable-rls.ts` to re-enable RLS

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | Vercel Postgres connection string |
| `AUTH_SECRET` | NextAuth secret |
| `GOOGLE_GENERATIVE_AI_KEY` | Gemini API |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Email notifications |
| `NOTIFY_MY_EMAIL` / `NOTIFY_GROUP_EMAIL` / `NOTIFY_FROM_EMAIL` | Email targets |
| `GREENAPI_INSTANCE_ID` / `GREENAPI_API_TOKEN` / `GREENAPI_GROUP_ID` | WhatsApp |
| `SEND_WHATSAPP` | Set `'false'` to disable WhatsApp globally |
| `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` | Superuser credentials |
| `NEXT_PUBLIC_APP_URL` | Public URL |
| `CRON_SECRET` | Cron job auth token |

---

## Caching Strategy

| Cache key | Tag | TTL | Notes |
|-----------|-----|-----|-------|
| `players-lean-v4` | `players` | 300s | Lean player data (no scouting blob); includes salary + receiving from JSONB |
| `schedule-data` | `schedule` | 60s | Season schedule |
| `standings-data` | `standings` | 60s | Season standings |
| `resources-data` | `resources` | 60s | League resources |
| `coaches-data` | `coaches` | 300s | Teams/coaches list |
| `all-draft-picks` | `draft-picks` | 30s | Full draft pick board |

`getPlayersWithScouting` exceeds the 2MB `unstable_cache` limit — not cached; uses CDN `Cache-Control: s-maxage=300` at the API route level instead.

Cache invalidation via `revalidateTag(tag, 'max')` in mutation routes. When a team is renamed/updated, both `coaches` and `players` tags are invalidated so rosters reflect the new teamshort immediately.

Pattern:
```ts
const _fn = unstable_cache(
  async (leagueId: number) => { /* DB query */ },
  ['cache-key'],
  { revalidate: 60, tags: ['tag'] }
);
export async function fn(leagueId = 1) { return _fn(leagueId); }
```

---

## Key Conventions

- **Schema first:** Add columns to `schema.ts` → `npm run db:push` → `npx tsx scripts/enable-rls.ts` → write lib code
- **leagueId everywhere:** All queries on tenant tables must filter by `leagueId`
- **Transactions always Pending:** `logTransaction()` always saves `status='Pending'`; commissioner changes to `Done`/`On Team`
- **touch_id / touch_dt:** All tables record last modifier and timestamp
- **Player identity key:** `first|last|age|offense|defense|special` (all lowercase); age-mismatch fallback drops age field
- **teamshort normalization:** Stored mixed-case in some leagues; all lookups use `.toUpperCase()`
- **logSystemEvent must be awaited:** Vercel serverless kills unawaited promises on response return
- **App Router patterns:** Server Components by default; `"use client"` only for interactive UI
- **Keep API routes thin:** Business logic in `/lib`, not in route handlers
