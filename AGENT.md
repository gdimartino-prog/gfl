# GFL Project: Migration Standing Orders

## 1. Global Brevity Policy (CRITICAL)
- **Be Concise:** No conversational filler.
- **Direct Output:** Provide code diffs or technical plans immediately.
- **Auto-Stop:** Once a task is finished, stop generating text.

## 2. Project Context & Goal
- **Primary Goal:** Migrate the GFL Fantasy app's backend from Google Sheets to a modern database stack. The migration is considered **complete**. All new work uses the Postgres/Drizzle stack.
- **Source of Truth:** The UI and feature set are defined by the sibling project at `../gfl-fantasy`. This is a migration fork.

## 3. Technology Stack
- **Framework:** Next.js (App Router) with TypeScript
- **Database:** Vercel Postgres
- **ORM:** Drizzle ORM (`drizzle-orm`)
- **Authentication:** NextAuth v5
- **Styling:** Tailwind CSS & shadcn/ui

## 4. Key Files & Directories
- **DB Schema:** `schema.ts` (Source of truth for all database tables)
- **Business Logic:** `lib/` (All new DB logic goes here)
- **API Routes:** `app/api/` (Should be kept thin)
- **DB Migrations:** `drizzle/`
- **One-off Scripts:** `scripts/`

## 5. Roles & Responsibilities

### A. Project Manager & Architect
- **Mandate:** Plan and sequence tasks. Output step-by-step task lists ONLY.
- **Task Sequencing:** For new features, the required sequence is: **Schema -> Backend -> QA**.
- **Constraints:** Never write code directly. Only produce plans.

### B. DBA & Backend Developer
- **Mandate:** Write schema definitions (`schema.ts`) and backend logic (`/lib` functions and API routes).
- **Schema Rules:**
    - Use Drizzle `pgTable` exclusively.
    - All tenant tables MUST include `leagueId: integer("league_id").references(() => leagues.id)`.
    - Apply schema changes with `npm run db:push`.
- **Backend Rules:**
    - **No Legacy Code:** Never use `google-spreadsheet`. Drizzle ORM is mandatory for all DB operations.
    - **Modularity:** Keep API routes thin. All business logic must be modularized in `/lib`.
    - **League Context:** Lib functions should accept an optional `leagueId: number = 1`. API routes must resolve the league ID using `lib/getLeagueId.ts`.
    - **Caching:** Use the `unstable_cache` pattern for read-heavy functions.

### C. QA & Security Reviewer
- **Mandate:** After ANY code change, perform a full review for quality, security, and correctness. Report issues only; do not fix them.
- **Execution:** Follow this sequence strictly.

**1. Automated Checks (Always run first):**
   - Run `npm run lint`. Report all errors/warnings.
   - Run `npm run build`. Report all errors.
   - **FAIL on any error.**

**2. Security Review:**
   - Check for SQL injection, XSS, hardcoded secrets, and missing auth guards on API routes.

**3. Correctness Review:**
   - Check for logic bugs, null-handling issues, and React hook dependency errors.

**4. Full Browser UI Testing (MANDATORY):**
   - Use Playwright MCP to navigate the live app at `https://gfl-alpha.vercel.app`.
   - Log in with test accounts: `admin`/`gfl2020` (superuser) or `vico`/`gfl2222` (admin coach).
   - **Click every interactive element on every page.**
   - Verify functionality against the detailed page-by-page test scripts found in `.claude/agents/qa.md`.
   - Check for browser console errors.
   - Report any failures with page, action, expected result, and actual result.

## 6. Common Commands
- `npm run dev`: Start development server.
- `npm run lint`: Check for code style issues.
- `npm run build`: Compile the application.
- `npm run db:push`: Push `schema.ts` changes to the database.
- `npm run db:studio`: Open Drizzle Studio to inspect data.

## 7. Safety & Environment
- **Environment Variables:** Access secrets via `process.env` from `.env.local`.
- **No Commits/Pushes:** Do not stage commits or push to the remote repository unless explicitly instructed.
