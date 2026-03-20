# Draft Board Feature Backlog

Features discussed with a prospective multi-league user who runs rookie + free agent drafts
across two leagues. Reference this file before starting any draft work.

---

## ✅ Done

- Sequential draft order (managed via `pick` number on each row)
- Pick trading (handles alternating / round-specific order differences)
- Per-pick draft clock (counts from previous pick's `pickedAt`)
- Free agent player pool
- Multi-league support
- Pass / Skip a pick (see #2 below)

---

## ✅ 1. Per-Round Configurable Clock Duration *(implemented)*

**What:** Commissioner sets the pick time limit before starting each round. Time limits are
much shorter than GFL's async model — typically 10–20 minutes per pick, not 24 hours.
The draft runs in a "daily round" model: one round per day, commissioner kicks off each
round and chooses its timer.

**Details from user:**
- Round 1: up to 20 minutes per pick
- Most rounds: 15 minutes
- Later rounds: 10 minutes
- Commissioner configures the duration before each round starts (like Strat Draft)
- Auto-skip fires when the timer expires within that window

**Implementation:**
- Rules table entries: `draft_clock_round_N = <minutes>` (global-only, no year)
- Cascading default: highest configured round ≤ current round wins; fallback = 1440 min
- `lib/draftClock.ts` — `getDraftClockMinutes(leagueId, round)` + `getWarningThresholdMinutes()`
- Warning fires at 25% of clock remaining (capped 1–60 min) instead of fixed 1 hour
- Draft cron updated: supports all leagues, uses per-league clock minutes
- Draft board clock uses `clockMinutes` from API response instead of hardcoded values
- GFL seeded: `draft_clock_round_1=1440`, `draft_clock_round_3=720`
- Configure via Maintenance → Rules panel (year field auto-disabled for `draft_clock_*`)

**Cron note:** Draft clock runs via **GitHub Actions** (`.github/workflows/crons.yml`),
NOT Vercel crons. Schedule is `*/5 * * * *` (every 5 min). For clocks under 5 minutes,
change to `* * * * *`. GitHub Actions free tier: ~2000 min/month for private repos
(each run ~5s, so every 5 min ≈ 290 min/month — well within limits).

---

## ✅ 2. Pass / Skip a Pick *(implemented)*

**What:** A team on the clock can pass their pick for that round. The draft advances to the
next team. A passed pick remains in the board as "Passed" and the team (or commissioner)
can still fill it from remaining available players at any time via "Late Selection."
**Who can pass:** The team on the clock, or any admin/commissioner.

---

## 🔲 3. Multiple Draft Types per League per Year

**What:** Support both a *Rookie Draft* (NFL draft class players) and a *Free Agent Draft*
(Action PC Football database players) within the same league in the same year.
**Effort:** Moderate — add `draft_type` varchar column to `draft_picks`
(e.g. `rookie` / `free_agent`). Draft board gets a type switcher/filter.

---

## 🔲 4. Salary Levels per Round (Free Agent Draft)

**What:** Each round of the free agent draft has an associated player salary cap value.
Teams need to know the salary attached to each round when making selections.
**Effort:** Low — store as rules table entries (`fa_draft_round_1_salary`, etc.).
Display as a badge per round group header on the draft board. No enforcement needed
unless cap validation is desired.

---

## Notes

- Pick order variations (odd/even round alternation, different rounds 1–4 order) are already
  handled by trading picks — no code changes needed for those.
- Importing NFL draft class or Action PC Football data is out of scope — coaches upload
  players manually via the existing Maintenance panel.
- Prior draft orders with traded picks are not a problem — the system already handles that.
- This user's draft is fundamentally different from GFL's async model (hours vs minutes).
  Any short-clock features should be built as league-configurable, not hardcoded.
