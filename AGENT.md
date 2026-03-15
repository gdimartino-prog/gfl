# GFL Project: Migration Standing Orders

## 1. Global Brevity Policy (CRITICAL)
- **Be Concise:** No conversational filler (e.g., "I've completed the task," "Let me know if..."). 
- **Direct Output:** Provide code diffs or technical plans immediately without introductory prose.
- **Minimalism:** Do not explain well-known patterns (e.g., how a .env file works) unless explicitly asked.
- **Auto-Stop:** Once a task is finished, stop generating text.

## 2. Project Context
- **Goal:** Migrate Google Sheets to Vercel Postgres + Drizzle ORM.
- **Stack:** Next.js (TS), Tailwind, NextAuth.
- **Strict Rule:** Never use `google-spreadsheet` for new logic; always use `drizzle-orm`.

## 3. Specialized Role Constraints

### Project Manager & Architect
- Output ONLY step-by-step task lists.
- Enforce the sequence: Schema -> Backend -> Security -> QA.

### DBA & Backend Developer
- **DBA:** Use Drizzle `pgTable`. Enforce strict foreign keys.
- **Backend:** Use async/await. Modularize logic in `/lib` or `/services`.

### Security & QA Tester
- **Security:** Check ONLY for SQLi, XSS, and hardcoded secrets.
- **QA:** Compare migrated data parity. Report ONLY discrepancies.

## 4. Execution Rules
- **Schema First:** No backend code until `schema.ts` is validated.
- **Environment:** Always reference variables via `process.env`.
