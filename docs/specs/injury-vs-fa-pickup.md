# Separate FA Pickup vs. Injury Pickup + FA/Trade Deadline Lock

## 1. Problem  (REQUIRED)
Coaches have been submitting paid Free Agent pickups (`ADD`, $10) instead of $0 Injury Pickups (`INJURY PICKUP`) on `/transactions`, including after the NFL FA/Trade deadline when standard `ADD` pickups are closed. Today, Injury Pickup is hidden behind a small right-aligned `Injury Replacement?` checkbox inside the **Add Player** tab, the Free Agent list appears above the injured-player fields (so coaches select a player and hit **Submit Pickup** without toggling the checkbox), there is no confirmation modal showing the fee, and no `fa_trade_deadline` rule exists in `rules` to enforce the post-deadline cutoff.

## 2. Who  (REQUIRED)
- **Leagues:** Transaction Center UI improvements apply to **all leagues** (GFL = 1, AFL = 2, AFC = 3). The `fa_trade_deadline` rule is per-league in `rules`, seeded to `2026-11-03T16:00:00-05:00` for **GFL (`leagueId = 1`) only**; Leagues 2 & 3 remain unset/open unless configured in Maintenance.
- **Roles:** Authenticated coaches (`!isPrivileged()`) are locked out of `ADD` pickups once `fa_trade_deadline` passes (in both UI and `POST /api/transactions`). Commissioners and Superusers (`isPrivileged()`) can still submit `ADD` overrides.
- **Must not affect:** `INJURY PICKUP`, `WAIVE`/`DROP`, `IR MOVE`, `TRADE`, and `CONDITIONAL TRADE` remain open after `fa_trade_deadline`.

## 3. Done when  (REQUIRED)
1. `/transactions` displays 5 explicit tabs (**FA Pickup**, **Injury Pickup**, **Waive/Drop**, **IR Movement**, **Team Trade**); when `fa_trade_deadline` has passed for a non-privileged coach, the page defaults to **Injury Pickup**, marks **FA Pickup** closed with a redirect card, and `POST /api/transactions` with `type: 'ADD'` returns `403` (while `isPrivileged()` users can still submit `ADD`).
2. **Injury Pickup** presents **Injured Roster Player + Week Occurred + Duration** (`>= 1` whole numbers, showing computed `Week Back`) *before* **Replacement Free Agent**, auto-filters Free Agents to `MATCH (<UNIT>)`, allows unit-group replacements (`DB`: `CB`/`S`; `OL`: `C`/`G`/`T`/`C-G`; `DL`: `DE`/`DT`; `LB`: `ILB`/`OLB`; `RB/HB`; `K/P`) without warning, and displays a non-blocking amber warning (inline + in confirmation modal) on cross-group picks (e.g., `WR` for `CB` or `RB` for `DT`) so the Commissioner can verify.
3. Both **FA Pickup** and **Injury Pickup** open a confirmation modal showing the exact fee (`$10` vs. `$0`), with a one-click **"Wait — Switch to Injury Pickup ($0)"** option inside the FA Pickup confirmation modal that preserves the selected free agent.
4. `npm test` covers deadline parsing and position matching in `tests/pickupRules.test.ts`, and `npm run verify:prepush` (`lint`, `semgrep`, `test`, `build`) passes cleanly.

## 4. Must not  (REQUIRED)
- Never bypass `leagueId` tenancy on `rules` or `transactions` queries (`getLeagueId()`).
- Never use client-side or stale JWT role checks for server authorization — use `isPrivileged()` in `POST /api/transactions`.
- Never use single-arg `revalidateTag(tag)` — always `revalidateTag(tag, 'max')`.
- Never fire-and-forget `logSystemEvent()` or `notifyTransaction()` — always `await`.
- Never hard-block cross-position Injury Pickups (Constitution Rule D5 mismatches warn only so the Commissioner can verify).
- Never break existing transaction log filters, CSV export, Spend Report, or `INJURY PICKUP` `details`/`weekBack` formatting.

## 5. Decided
- **UI Structure:** Split **Add Player** into two top-level tabs (**FA Pickup** and **Injury Pickup**) with separate visual accents (Blue vs. Teal), confirmation modals with fee callouts, and an in-modal escape hatch to switch from FA Pickup to Injury Pickup without losing the selected player.
- **Deadline Rule:** Global per-league rule `fa_trade_deadline` in `rules` (registered in `GLOBAL_ONLY_RULES` and Maintenance presets). Seeded for GFL (`leagueId = 1`) to `2026-11-03T16:00:00-05:00`; empty/absent means open.
- **Post-Deadline Scope:** Lock `ADD` (`FA Pickup`) only for non-privileged coaches; Commissioners/Superusers (`isPrivileged()`) can override; `TRADE` remains unaffected.
- **Injury Position Rule:** Auto-filter by unit group (`DB` for `CB`/`S`, `OL` for `C`/`G`/`T`/`C-G`, `DL` for `DE`/`DT`, `LB` for `ILB`/`OLB`, `RB/HB`, `K/P`; dual-position codes split on `-`/`/`; `KR`/`PR`/`RET` stripped when primary positions exist) with no warning inside the same unit group and a non-blocking amber warning on cross-group mismatches (e.g., `RB` for `DT`) for Commissioner verification.
- **Amendment (2026-11-20 — Constitution D5 vote):** League vote changed Rule D5 to allow $0 Injury Pickups at **any position** across all leagues. The Injury Pickup UI now defaults the position filter to `ALL` (keeping the optional `MATCH (<UNIT>)` quick-filter pill) and removes all position-mismatch warnings.

## 6. Open
None.
