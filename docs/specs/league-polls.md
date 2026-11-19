# League Polls & Voting System (Constitution E9–E13)

## 1. Problem (REQUIRED)
The GFL Constitution (Rules E9–E13) defines formal governance rules for league polls—including Commissioner-only poll creation (E9), one-season decision lockouts (E10), 50% + 1 majority with top-2 runoffs on multi-choice ballots (E11), 2-week (14-day) voting windows with Commissioner follow-up on rule changes (E12), and a 50% league participation quorum or null/status-quo outcome (E13)—none of which are currently supported in the application.

## 2. Who (REQUIRED)
- **Leagues:** All leagues (`leagueId` tenant-isolated).
  - External Email & WhatsApp poll notifications are restricted strictly to GFL (`leagueId === 1`); non-GFL leagues log events in `audit_log` only.
- **Roles:**
  - **Unauthenticated:** Blocked via `proxy.ts` (`"/polls/:path*"`) and `/api/polls*` (`401`); must not see poll data.
  - **Demo (`role === 'demo'`):** Read-only access in league 2; blocked (`403`) on all mutations (voting, creating, editing, closing, reminding, runoffs, deleting), even though the demo team (`VV`) is marked `isCommissioner = true` in DB.
  - **Coach:** Can view polls in their league, see who has/hasn't voted, cast/change their own team's ballot while voting is open, and view revealed results once closed/expired.
  - **Commissioner / Superuser (`isPrivileged()`, excluding `demo`):** Can create, edit, delete, close/finalize polls, launch top-2 runoffs, send non-voter reminders (12h cooldown), and record audited proxy votes on behalf of active teams.

## 3. Done when (REQUIRED)
- A non-demo coach in a league can view `/polls`, see hidden option tallies while a poll is open, submit and update their own ballot, and see their team listed in the Voted roll call without exposing individual choices until the poll closes or `closesAt` passes.
- Commissioner actions (`POST /api/polls`, `PATCH`/`DELETE /api/polls/[id]`, `POST /api/polls/[id]/close`, `POST /api/polls/[id]/runoff`, `POST /api/polls/[id]/remind`) enforce `isPrivileged()`, block `demo` (`403`), scope every query by `leagueId`, bust the `'polls'` cache tag (`revalidateTag('polls', { expire: 0 })`), and await `logSystemEvent` + `notifyPoll*` (for `leagueId === 1`).
- `rule_change` polls default to a 14-day close window (E12), enforce `Math.ceil(eligible / 2)` quorum (`null_quorum` if unmet per E13), and require `Math.floor(totalVotes / 2) + 1` on >2 choices or enter `runoff_needed` for a top-2 runoff (E11).
- Enacted Decisions tab lists finalized `rule_change` winners with `effectiveSeason`, optional `constitutionRef`, and advisory 1-season lock badge (E10).
- `npm test` covers `lib/pollRules.ts` (`tests/pollRules.test.ts`), and `npm run verify:prepush` (`lint`, `semgrep`, `test`, `build`) passes with zero errors and zero findings.

## 4. Must not (REQUIRED)
- Must not leak poll rows, teams, votes, or notifications across leagues (`leagueId` filtering on every table query; Email/WhatsApp restricted to `leagueId === 1`).
- Must not allow `role === 'demo'` to perform any poll write despite `isCommissioner = true` in League 2 (`VV`).
- Must not expose option vote counts, percentages, or per-team ballot selections in API responses or `unstable_cache` entries while `status === 'open' && now < closesAt` (except caller's own `myVoteOptionId`).
- Must not log a voter's selected option label in `audit_log` during ballot submission or proxy voting.
- Must not use `s-maxage` cache headers on `/api/polls` or single-arg `revalidateTag`.
- Must not miss `touch_id`/`touch_dt` or RLS (`scripts/enable-rls.ts`) or backups (`scripts/backup-db.ts`) for `polls`, `poll_options`, `poll_votes`.

## 5. Decided
- **Ballot privacy & editing:** Hidden choices & option tallies while voting is open (`status === 'open' && now < closesAt`); coaches can change their vote until close; live roll call of Voted / Not Yet Voted is visible while open for E12 follow-up; full team-by-team breakdown reveals once closed/expired.
- **Scope & poll types:** All leagues, login required, `demo` read-only; supports `rule_change` (14-day default close, E11/E13 enforced) and `general` (custom close, simple plurality).
- **Runoffs & notifications:** One-click Commissioner "Launch Runoff (Top 2)" (no new cron); GFL (`leagueId === 1`) Email + WhatsApp on poll open, manual "Remind Non-Voters" (12h cooldown), and final results.
- **Proxy voting & E10:** Audited Commissioner proxy votes (`isProxy = true`, choice excluded from audit log while open); Enacted Decisions (E10) history tab tracking `effectiveSeason` + optional `constitutionRef` with advisory 1-season lock badge.
- **UI & Cache:** Dedicated `/polls` page (Navbar link + Home card) backed by `polls` cache tag (`private, max-age=15` API header).

## 6. Open
None — all product decisions confirmed prior to implementation.
