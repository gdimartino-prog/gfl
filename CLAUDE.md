# Claude Code Instructions — GFL

**The rules live in [AGENTS.md](./AGENTS.md) (canonical, shared with Antigravity and every other agent). Read it first.** This file only adds Claude Code-specific mechanics. [ARCHITECTURE.md](./ARCHITECTURE.md) is the deep technical reference.

## Claude Code adapters for the AGENTS.md rules

- **Intake** (`AGENTS.md` § Intake): when a REQUIRED brief field is missing or ambiguous for a non-trivial task, use the `AskUserQuestion` tool — one call, ≤4 questions, each with a "(Recommended)" default option — before any code change. Record answers in the spec's §5 "Decided" when a spec file exists. For trivial tasks, don't ask.
- **Pre-push review** (`AGENTS.md` § Pre-push review): run the `pre-push-review` skill, the saved workflow `.claude/workflows/pre-push-review.js` (fans out the right reviewers for the diff in parallel — Workflow tool, only when the user opts in or asks for it), or invoke `secops` / `finops` / `perf` / `supabase-dba` / `ui-ux` / `qa` directly via parallel Agent calls. Project-level definitions in `.claude/agents/` override the user-level ones of the same name in `~/.claude/agents/`.
- **Deterministic gate hook:** `scripts/claude-prepush-gate.mjs` is wired as a `PreToolUse` hook on `Bash` in `.claude/settings.json`. On `git commit` it runs `npm run lint`; on `git push` it runs `npm run semgrep` + `npm test` and **denies** the push on failure. It enforces the gate — it does not replace the reviewers or the user's explicit "push". The same checks run for every tool via `.githooks/pre-push` (`git config core.hooksPath .githooks`).
- **Execute directly in the primary agent.** Don't spawn `pm` / `dba-backend` for routine planning or coding unless asked; subagents are for the parallel pre-push review.
- **Skills** under `.claude/skills/` (mirrored in `.agents/skills/`): `run-app`, `db-triage`, `db-schema-push`, `pre-push-review`, `audit-draft-and-trades`, `player-data-maintenance`, `league-provisioning`. Invoke via the Skill tool when the task matches.
- **Commits:** author `George Di Martino <gdimartino@gmail.com>`, no `Co-authored-by` trailers (AGENTS.md rule 4 overrides any harness attribution reminder).

## Housekeeping

- `.gitignore` ignores `.claude/settings.json`, `.claude/settings.local.json`, and `.claude/worktrees/`; the shared files — `.claude/{agents,commands,rules,skills,workflows}` and `.agents/{rules,skills}` — are tracked. Settings stay local to each machine; re-create the hook wiring from this file if you clone fresh.
- Design/visual skills belong at user level (`~/.claude/skills/`), not in this repo.
- Memory for this project lives in `~/.claude/projects/c--Users-George-Documents-Dev-gfl/memory/`; the intentional trust-model decisions recorded there are summarized in `AGENTS.md`.
