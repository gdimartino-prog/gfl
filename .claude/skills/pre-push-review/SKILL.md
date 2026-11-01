---
name: pre-push-review
description: >-
  Execute the mandatory pre-push pipeline for GFL (AGENTS.md § Pre-push review): run the
  deterministic gate once (lint, semgrep, test, build), compute the diff, dispatch the
  diff-scoped reviewers in parallel (secops always; finops, perf, supabase-dba, ui-ux, qa by
  touched paths), consolidate a severity-ordered punch list, and ask "Push?". Use before any git push.
---

# Pre-push review pipeline

## Step 1 — Deterministic gate (parent agent, once)

```bash
npm run verify:prepush      # scripts/verify-prepush.mjs: lint → semgrep (0 findings) → test → build
```
Fix failures first; never bypass. The fast subset (semgrep + test) is re-run automatically by `.githooks/pre-push` and, in Claude Code, by the `PreToolUse` hook (`scripts/claude-prepush-gate.mjs`) — those deny the push, they don't replace this step.

## Step 2 — Compute the diff

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD > "$SCRATCHPAD/prepush.diff"   # add `git diff HEAD` for uncommitted work
```
Reviewer agents without Bash read the saved file.

## Step 3 — Pick reviewers by touched paths and run them in parallel

Definitions in `.claude/agents/*.md` (project-level overrides user-level):

| Reviewer | Run when the diff touches | Owns |
|---|---|---|
| `secops` | **always** | `Semgrep SAST Audit: <N> findings` attestation; `leagueId` scoping, `isPrivileged()`, `private, max-age`, secrets, input validation, `touch_*`/`logSystemEvent` |
| `finops` | `app/api/**`, `lib/**`, cron, `lib/gemini.ts`, `lib/notify.ts`, Blob, ESPN/Ourlads, client fetch loops | invocations, egress, Gemini/email/WhatsApp/Blob spend; outranks perf |
| `perf` | `app/**` pages, `components/**`, `lib/**` readers, any query | N+1, missing indexes, sequential awaits, cache tags, render churn, bundle |
| `supabase-dba` | `schema.ts`, `drizzle/**`, `lib/db*.ts`, write scripts in `scripts/`, raw `sql\`\`` | schema/push/RLS procedure, write-script safety, contention |
| `ui-ux` | material UI change in `app/**/page.tsx` or `components/**` | hierarchy, 44 px targets, states, responsive, WCAG AA |
| `qa` | UI, auth/login, interactive elements | TARGETED Playwright (`/login` + affected routes); FULL only on request |

Skip finops/perf for tests-only or docs-only diffs; skip the whole review (gate still runs) for `.md`-only or comment-only diffs.

Either run the saved workflow `.claude/workflows/pre-push-review.js` (Workflow tool, `args = { diffPath, files }`, only when the user opted in) or issue the Agent calls in one message. Brief each with: changed files, diff path, "verify:prepush passed", and ask for severity-tagged findings plus an explicit **APPROVE / BLOCK**.

## Step 4 — Consolidate and gate

- Punch list by severity — 🔴 Critical / 🟠 High / 🟡 Medium / ⚪ Suggestion — with `file:line`, grouped by reviewer. Pre-existing issues outside the diff are noted, not blocking.
- Fix every 🔴/🟠 from SecOps/FinOps/DBA, re-run the gate, re-review the changed hunks. 🟡/⚪ may be deferred with the user's OK.
- Then ask **"Push?"** and wait for an explicit "push"/"yes". Commit author `George Di Martino <gdimartino@gmail.com>`, no `Co-authored-by` trailers.
