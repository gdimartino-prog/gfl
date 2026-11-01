---
name: league-provisioning
description: >-
  Provision, seed, copy, or back up a tenant league in the multi-league GFL database.
  Use when creating a new league, copying schedule/draft data to AFL or demo leagues,
  or running PII-safe database backups.
---

# League Provisioning & Backups

## Multi-League Tenancy Rules
- **GFL** = `leagueId: 1`, **AFL** = `leagueId: 2`.
- Cross-league identity is **email-based**: `getLeagueId()` honors the `gfl-league-id` cookie only if the user's email matches an active credentialed team in that league.
- COA blob keys are prefixed with `<leagueId>/NAME.COA` for non-GFL leagues (`leagueId !== 1`).

## Common Provisioning & Backup Scripts

1. **PII-Safe Database Backup** (deliberately omits `password`, `email`, and `mobile` from `backups/teams.json`):
   ```bash
   node --env-file=.env.local --import tsx scripts/backup-db.ts
   ```
2. **Seed Leagues, Teams, and Draft Clock**:
   ```bash
   node --env-file=.env.local --import tsx scripts/seed-leagues.ts
   node --env-file=.env.local --import tsx scripts/seed-draft-clock.ts
   ```
3. **Copy Data to Demo / Secondary Leagues**:
   ```bash
   node --env-file=.env.local --import tsx scripts/copy-to-demo.ts
   ```
