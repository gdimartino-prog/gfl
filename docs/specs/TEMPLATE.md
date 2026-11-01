# <Feature or change name>

<!-- Copy to docs/specs/<kebab-name>.md. Six sections; an agent will ask
     before building if any of the REQUIRED ones is missing or ambiguous
     (AGENTS.md § Intake). -->

## 1. Problem  (REQUIRED)
What is wrong or missing, in the coach's / commissioner's words. 1–3 sentences. If it's a bug, how to reproduce it (league, page, account role, steps).

## 2. Who  (REQUIRED)
League(s): GFL (1) only / every league / demo (2) too.
Role(s): superuser / commissioner / coach / demo / unauthenticated. Which of them must NOT be affected.

## 3. Done when  (REQUIRED)
3–5 observable acceptance checks, each testable. Example:
- A coach in league 3 never sees league 1 rows from `GET /api/transactions` (manual check with the `gfl-league-id` cookie flipped).
- Making the pick busts `draft-picks` and `players` and the roster page reflects it without a hard refresh.
- `npm test` covers the new `/lib` helper.

## 4. Must not  (REQUIRED)
Invariants to protect: `leagueId` scoping, `isPrivileged()` gating, `private, max-age` headers, awaited `notify*`/`logSystemEvent`, `touch_id`/`touch_dt`, the intentional trust-model decisions in AGENTS.md, existing tests, etc.

## 5. Decided
Choices already made (names, roles, scope, UI placement, cache tag). Anything here is not re-litigated.

## 6. Open
Questions you want answered — with a recommendation — before any code is written.
