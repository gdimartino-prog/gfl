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

---

## 🔲 1. Scheduled Pick Windows

**What:** Each pick has a specific `scheduled_at` datetime window. The team is "on the clock"
only during their window, not simply because all prior picks are done.
**Also needed:** "Pick early" logic — a team can pick before their window only if all other
teams in that round have already picked.
**Effort:** Moderate — new `scheduled_at` column on `draft_picks`, clock display changes,
cron job to auto-advance past missed windows.

---

## ✅ 2. Pass / Skip a Pick *(implemented)*

**What:** A team on the clock can pass their pick for that round. The draft advances to the
next team. A passed pick remains in the board as "Passed" and the team (or commissioner)
can still fill it from remaining available players at any time via "Late Selection."
**Who can pass:** The team on the clock, or any admin/commissioner.
**Effort:** Low — `passed` boolean on `draft_picks`, new `/api/draft-pass` endpoint, Pass
button in UI alongside Enter Selection.

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
