# GFL App — Architecture Overview

## Table of Contents
1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [Multi-League Architecture](#multi-league-architecture)
6. [API Routes](#api-routes)
7. [Notification System](#notification-system)
8. [Cron Jobs & Automation](#cron-jobs--automation)
9. [Deployment Pipeline](#deployment-pipeline)
10. [Caching Strategy](#caching-strategy)
11. [Key Libraries & Patterns](#key-libraries--patterns)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase Postgres (via `@vercel/postgres`) |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 (beta) |
| AI | Google Gemini (`@google/generative-ai`) |
| Email | Gmail SMTP via nodemailer v6 |
| WhatsApp | GreenAPI |
| File Storage | Vercel Blob |
| Deployment | Vercel (afl.gddevco.com) |
| CI/CD | GitHub Actions |

---

## Project Structure

```
gfl/
├── app/
│   ├── page.tsx                      # Dashboard / Home
│   ├── rosters/page.tsx              # Team rosters & depth charts
│   ├── standings/page.tsx            # Season standings
│   ├── standings/summary/page.tsx    # All-time leaderboard
│   ├── schedule/page.tsx             # Weekly schedule & results
│   ├── draft/page.tsx                # Live draft board
│   ├── transactions/page.tsx         # FA pickups, drops, trades, IR
│   ├── cuts/page.tsx                 # Roster cuts selections
│   ├── coaching/page.tsx             # COA file upload/download
│   ├── settings/page.tsx             # Coach profile settings
│   ├── directory/page.tsx            # Coach contact directory
│   ├── resources/page.tsx            # League resource downloads
│   ├── press-box/page.tsx            # AI game analysis
│   ├── rules/page.tsx                # League rules display
│   ├── trade-block/page.tsx          # Players available for trade
│   ├── maintenance/page.tsx          # Commissioner admin panel
│   ├── manual/page.tsx               # In-app user manual
│   ├── login/page.tsx                # Login
│   ├── signup/page.tsx               # New coach registration
│   └── api/                          # API route handlers
├── lib/                              # Business logic
│   ├── db.ts                         # Drizzle DB connection
│   ├── db-helpers.ts                 # Shared DB utilities
│   ├── players.ts                    # Player queries (cached)
│   ├── config.ts                     # Teams/coaches queries (cached)
│   ├── getStandings.ts               # Standings queries (cached)
│   ├── getSchedule.ts                # Schedule queries (cached)
│   ├── getResources.ts               # Resources queries (cached)
│   ├── transactions.ts               # Transaction log queries
│   ├── draftPicks.ts                 # Draft pick queries (cached)
│   ├── cuts.ts                       # Cuts management queries
│   ├── freeAgency.ts                 # Free agent move logic
│   ├── rules.ts                      # League rules queries
│   ├── getLeagueId.ts                # League resolver from cookie
│   ├── auth.ts                       # Auth role helpers
│   ├── notify.ts                     # Email + WhatsApp notifications
│   ├── gemini.ts                     # AI summary generation
│   ├── actions.ts                    # Next.js server actions
│   └── utils.ts                      # General utilities
├── schema.ts                         # Drizzle table definitions (source of truth)
├── types/index.ts                    # TypeScript interfaces
├── components/                       # Reusable UI components
├── context/                          # React context providers
│   ├── LeagueContext.tsx             # Active league state
│   └── TeamContext.tsx               # Active team state
├── auth.ts                           # NextAuth configuration
├── drizzle.config.ts                 # Drizzle config (points to .env.local)
├── drizzle/                          # Auto-generated SQL migration files
├── scripts/                          # One-time data migration scripts
└── .github/workflows/               # GitHub Actions CI/CD
    ├── deploy.yml                    # Auto-deploy on push to main
    ├── crons.yml                     # Daily/weekly scheduled jobs
    └── draft-cron.yml               # Draft timer (every 5 minutes)
```

---

## Database Schema

All tables have `leagueId` for multi-league tenancy and `touch_dt` / `touch_id` audit fields.

### leagues
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Auto-increment |
| name | text | Display name (e.g., "GFL") |
| slug | text | URL-safe identifier |
| legacyUrl | text | Old domain for redirects |

### teams
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| name | text | Full team name |
| coach | text | Head coach name |
| teamshort | text | Short code (e.g., "ALP") — used as user login |
| nickname | text | Optional alias |
| isCommissioner | boolean | Commissioner flag |
| status | text | active / pending / inactive |
| mobile | text | Phone for WhatsApp |
| email | text | Contact email |
| password | text | bcrypt hash |
| coa_last_sync | timestamp | Last COA file upload |

### players
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| name | text | Full name |
| first / last | text | Split name |
| age | integer | |
| position | text | QB, RB, WR, TE, K, DEF |
| offense / defense / special | integer | Core ratings |
| identity | text | Unique identifier for transactions |
| isIR | boolean | Injured reserve status |
| overall | integer | Overall player rating |
| teamId | integer → teams.id | Null = free agent |
| scouting | jsonb | Detailed scouting report |

### transactions
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| date | timestamp | When logged |
| type | text | ADD / DROP / TRADE / IR |
| description | text | Human-readable summary |
| fromTeam / toTeam | text | Teams involved |
| owner | text | Initiating coach |
| status | text | Pending / Done / On Team |
| emailStatus | text | sent / skipped / error |

### draftPicks
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| year | integer | Draft year |
| round | integer | Round number |
| pick | integer | Pick within round |
| originalTeamId | integer → teams.id | Original owner |
| currentTeamId | integer → teams.id | Current owner (may differ if traded) |
| playerId | integer → players.id | Null until pick is made |
| pickedAt | timestamp | When selection was made |
| warningSent | boolean | 1-hour warning flag |
| selectedPlayerName | text | Snapshot of player name |

### cuts
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| year | integer | Season year |
| teamId | integer → teams.id | |
| firstName / lastName | text | |
| age | integer | |
| offense / defense / special | integer | |
| status | text | protected / pullback |
| datetime | timestamp | When saved |

### rules
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| year | integer | Null for global rules |
| rule | text | Rule key (e.g., "cuts_year") |
| value | text | Rule value |
| desc | text | Description |
| Unique | (leagueId, year, rule) | One value per rule per year |

### resources
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| group | text | Category for grouping |
| title | text | Display name |
| url | text | Download/link URL |

### standings
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| teamId | integer → teams.id | |
| year | integer | Season year |
| wins / losses / ties | integer | Record |
| offPts / defPts | integer | Points scored/allowed |
| isDivWinner | boolean | Division winner flag |
| isPlayoff | boolean | Made playoffs |
| isSuperBowl | boolean | Reached championship game |
| isChampion | boolean | Won championship |
| oldTeamName | text | Historical team name snapshot |

### schedule
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| year | integer | Season year |
| week | varchar | Week number or identifier |
| homeTeamId / awayTeamId | integer → teams.id | |
| home_score / away_score | integer | Final scores |
| is_bye | boolean | Bye week flag |

### tradeBlock
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| playerId | integer UNIQUE | One entry per player |
| playerName | text | |
| team | text | Owning team |
| position | text | |
| asking | text | Asking terms |

### auditLog
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| leagueId | integer → leagues.id | |
| timestamp | timestamp | |
| coach | text | Who performed action |
| team | text | Team code |
| action | text | Action type |
| details | text | Additional context |

---

## Authentication & Authorization

### Auth Flow
1. User submits team name (or email) + password on `/login`
2. NextAuth `authorize` callback in `auth.ts`:
   - **Superuser check**: env vars `SUPERUSER_USERNAME` / `SUPERUSER_PASSWORD` → role `'superuser'`
   - **Google Sheets check** (legacy): lookup by teamshort in Sheets
   - **DB check**: lookup by teamshort or email in `teams` table; bcrypt compare
3. Session JWT stores `{ id: teamshort, role: 'admin'|'superuser'|'coach' }`

### Roles
| Role | Access |
|------|--------|
| `superuser` | Everything — all leagues, all admin functions |
| `admin` / `commissioner` | Own league commissioner functions |
| `coach` | Own team data; read-only for others |
| Unauthenticated | Public pages only (home, login, signup) |

### Helper Functions (`lib/auth.ts`)
- `isAdmin(session)` — true if role is `'admin'` or `'superuser'`
- `isCommissioner(session, leagueId)` — true if team has `isCommissioner=true` in DB

---

## Multi-League Architecture

The app supports multiple independent leagues via **row-level tenancy**.

- Every data table has a `leagueId` column
- All queries filter by `leagueId`
- Default `leagueId = 1` (GFL)

### League Resolution
1. Cookie `gfl-league-id` set by `LeagueContext` on the client
2. `getLeagueId()` in `lib/getLeagueId.ts` reads the cookie server-side
3. Falls back to `leagueId = 1` if no cookie

### League Switcher
- Navbar shows league switcher only when user has access to multiple leagues
- Calls `/api/leagues` (auth-protected) to get available leagues
- Updates cookie on selection → all subsequent requests use new leagueId

---

## API Routes

### Public Routes
| Route | Methods | Description |
|-------|---------|-------------|
| `/api/auth/[...nextauth]` | GET, POST | NextAuth session management |
| `/api/signup` | POST | Register new coach (creates pending team) |

### Protected Routes (require login)
| Route | Methods | Description |
|-------|---------|-------------|
| `/api/leagues` | GET | Leagues available to current user |
| `/api/teams` | GET, POST | Team list; update coach contact info |
| `/api/players` | GET | All players for league |
| `/api/players/details/[id]` | GET | Single player full data |
| `/api/rosters/[team]` | GET | Roster + draft picks for team |
| `/api/free-agents` | GET, POST | FA list; execute FA pickup + drop |
| `/api/draft-picks` | GET, POST | All picks; transfer pick between teams |
| `/api/transactions` | GET, POST | Log + retrieve transactions; triggers email/WhatsApp |
| `/api/standings` | GET | League standings data |
| `/api/schedule` | GET | Schedule data |
| `/api/rules` | GET | League rules |
| `/api/resources` | GET | Resource links |
| `/api/cuts` | GET, POST | Cuts summary + save selections |
| `/api/trade-block` | GET, POST, DELETE | Trade block listings |
| `/api/upload` | POST | File upload (COA, spreadsheets) |
| `/api/press-box` | GET, POST | Game file upload + AI summaries |

### Commissioner Routes
| Route | Methods | Description |
|-------|---------|-------------|
| `/api/signup` | GET, PATCH | View + approve pending signups |
| `/api/rules` | POST, PATCH, DELETE | Create/update/delete rules |
| `/api/maintenance` | GET, POST | Admin utilities |
| `/api/admin/teams` | PATCH | Bulk team updates |
| `/api/admin/standings` | POST | Import standings |
| `/api/admin/schedule` | POST | Import schedule |
| `/api/rules/initialize` | POST | Initialize default rules |
| `/api/transactions` | PATCH | Update transaction status |

### Cron Routes (require `Authorization: Bearer CRON_SECRET`)
| Route | Description |
|-------|-------------|
| `/api/cron/nfl-week` | Auto-update current NFL week |
| `/api/cron/cuts-alert` | Send cuts deadline notification |
| `/api/cron/draft` | Check draft clock; send warnings/expirations |
| `/api/cron/schedule-reminder` | Send weekly schedule reminder |

---

## Notification System

The app sends notifications via two channels: **Email (Gmail SMTP)** and **WhatsApp (GreenAPI)**.

### Configuration (Environment Variables)
```
GMAIL_USER=gdimartino@gmail.com
GMAIL_APP_PASSWORD=<app-specific password>
NOTIFY_MY_EMAIL=gdimartino@gmail.com       # Always receives a copy
NOTIFY_GROUP_EMAIL=gfl1@googlegroups.com   # Main recipient (default: NOTIFY_MY_EMAIL)
SEND_WHATSAPP=true
GREENAPI_INSTANCE_ID=<id>
GREENAPI_API_TOKEN=<token>
GREENAPI_GROUP_ID=<group chat id>
```

### Email Sending
- Sent via `nodemailer` using Gmail SMTP + App Password
- To: `NOTIFY_GROUP_EMAIL` (group or personal)
- CC: `NOTIFY_MY_EMAIL` (always)
- HTML emails for rich formatting; plain text fallback
- Skipped silently if `GMAIL_APP_PASSWORD` is not set

### WhatsApp Sending
- HTTP POST to GreenAPI endpoint
- Delivered to group chat
- Skipped if `SEND_WHATSAPP=false` or credentials missing

### Notification Triggers

| Event | Function | Channels |
|-------|----------|---------|
| Transaction (ADD/DROP/TRADE/IR) | `notifyTransaction()` | Email + WhatsApp |
| Draft pick made | `notifyDraftPick(type='PICK')` | Email + WhatsApp |
| 1 hour before pick clock expires | `notifyDraftPick(type='WARNING')` | Email + WhatsApp |
| Pick clock expires | `notifyDraftPick(type='EXPIRATION')` | Email + WhatsApp |
| Cuts deadline approaching | `sendEmail()` (cron) | Email |
| Weekly schedule reminder | `sendEmail()` (cron) | Email |

### Email Format: Transactions
- Blue-bordered HTML card
- Header: `GFL — TRANSACTION ALERT`
- Assets grouped by direction (Team A ➔ Team B)
- App link for viewing full transaction log

### Email Format: Draft
- Subject: `GFL DRAFT (R{round}): Pick #{overall}`
- Body: round/pick, team, player name
- Trade suffix if pick was traded
- Recent 3–5 picks shown
- Next 3–5 teams on deck
- Ping message for next team: `@TEAMCODE: YOU ARE ON THE CLOCK`

---

## Cron Jobs & Automation

All cron jobs run via **GitHub Actions** (not Vercel — Vercel Hobby plan limits to daily).

### `.github/workflows/crons.yml`
| Job | Schedule | Description |
|-----|----------|-------------|
| `nfl-week` | Daily at noon UTC | Calls `/api/cron/nfl-week` — updates current NFL week |
| `cuts-alert` | Daily at noon UTC | Calls `/api/cron/cuts-alert` — sends email if cuts deadline is near |
| `schedule-reminder` | Mondays at 2pm UTC | Calls `/api/cron/schedule-reminder` — sends weekly matchup email |

### `.github/workflows/draft-cron.yml`
| Job | Schedule | Description |
|-----|----------|-------------|
| `check-draft` | Every 5 minutes | Calls `/api/cron/draft` — checks if any team is over draft clock |

### Security
- All cron endpoints check `Authorization: Bearer CRON_SECRET` header
- `CRON_SECRET` stored as GitHub Actions secret and Vercel env var
- `workflow_dispatch` enabled on all cron workflows for manual triggering

---

## Deployment Pipeline

### Auto-Deploy on Push
1. Developer pushes to `main` branch on GitHub
2. `.github/workflows/deploy.yml` triggers
3. GitHub Action calls Vercel deploy hook via HTTP POST
4. Vercel builds and deploys to `afl.gddevco.com`

### Environment Variables
- Stored in Vercel dashboard (production environment)
- Local development uses `.env.local` (never committed)
- Key variables: `POSTGRES_URL`, `AUTH_SECRET`, `CRON_SECRET`, `GMAIL_APP_PASSWORD`

### Build Configuration
- `vercel.json`: `"installCommand": "npm install --legacy-peer-deps"` (required for nodemailer/next-auth compatibility)

---

## Caching Strategy

Data that changes infrequently is cached using Next.js `unstable_cache`.

| Data | Cache Tag | TTL |
|------|-----------|-----|
| Players | `players` | 60 seconds |
| Standings | `standings` | 60 seconds |
| Schedule | `schedule` | 60 seconds |
| Resources | `resources` | 60 seconds |
| Draft Picks | `draft-picks` | 60 seconds |

Cache is invalidated by tag using `revalidateTag()` when data is mutated.

Pattern for league-aware cached functions:
```ts
const _fn = unstable_cache(async (leagueId: number) => {
  // DB query filtering by leagueId
}, ['cache-key'], { tags: ['tag-name'], revalidate: 60 });

export async function fn(leagueId = 1) {
  return _fn(leagueId);
}
```

---

## Key Libraries & Patterns

### Server Components vs Client Components
- Pages are **Server Components by default** (data fetching at render time)
- `"use client"` directive only for interactive UI (forms, tabs, filters)
- Client components hydrate from server-passed props or fetch via API routes

### API Route Pattern
- Routes live in `app/api/**/route.ts`
- Logic is kept thin in routes — business logic goes in `lib/`
- Auth checks at the top of each handler:
  ```ts
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```

### Transaction Logging
```ts
await logTransaction({
  type: 'ADD',
  description: 'Team A adds Player X',
  fromTeam: 'FA',
  toTeam: 'ALPHA',
  owner: session.user.id,
  leagueId,
  status: 'Pending'
});
```

### Schema-First Development
1. Add new table to `schema.ts`
2. Run `npm run db:push` to apply to Supabase
3. Write lib functions using Drizzle queries
4. Create API routes calling lib functions
