---
description: Audit traded draft picks — compare all trade transactions involving picks against the current draft board to find ownership discrepancies
allowed-tools: Bash
---

## Context

- DB connection: read POSTGRES_URL from `.env.local`

## Your task

Run the traded picks audit script and analyze the output for discrepancies.

Steps:
1. Read the POSTGRES_URL from `.env.local`
2. Run: `POSTGRES_URL="<value>" npx tsx scripts/audit-trade-picks.ts`
3. Compare the TRANSACTIONS section against the DRAFT BOARD sections:
   - For each transaction that traded a pick, verify the current owner on the draft board matches the final recipient
   - Flag any pick where the draft board owner does not match what the transaction trail implies
   - Also flag any draft board traded pick (orig ≠ curr) that has no corresponding transaction
4. Report a clean summary: ✓ for confirmed correct, ✗ for discrepancies, with the specific picks and teams involved

Focus on actionable discrepancies — picks where the database is wrong and needs a fix.
