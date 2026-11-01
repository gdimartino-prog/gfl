---
name: audit-draft-and-trades
description: >-
  Audit traded draft picks, draft board ownership discrepancies, and active draft clock state.
  Use when investigating draft pick ownership bugs, trade transaction history mismatches,
  late picks, or draft clock stalls.
---

# Audit Draft Picks & Trades

## 1. Traded Picks Ownership Audit
Compare all trade transactions involving picks against the current draft board:

1. Run the traded picks audit script:
   ```bash
   node --env-file=.env.local --import tsx scripts/audit-trade-picks.ts
   ```
2. Compare the `TRANSACTIONS` section against the `DRAFT BOARD` sections:
   - Verify the current owner (`curr`) on the draft board matches the final recipient of the transaction chain.
   - Flag any pick where the draft board owner does not match the transaction trail.
   - Flag any traded pick (`orig != curr`) that has no corresponding transaction.
3. Report a summary (`✓` confirmed correct, `✗` discrepancy with specific pick, year, round, and teams).

## 2. Draft State & Clock Diagnostics
- Check active pick and clock timer:
  ```bash
  node --env-file=.env.local --import tsx scripts/check-active-pick.ts
  node --env-file=.env.local --import tsx scripts/check-draft-state.ts
  ```
- Audit overall draft picks integrity:
  ```bash
  node --env-file=.env.local --import tsx scripts/audit-draft-picks.ts
  ```
