---
name: player-data-maintenance
description: >-
  Maintain player records, deduplicate player identities, sync ESPN IDs and NFL teams,
  and upload player photos to Vercel Blob. Use when importing player CSVs, fixing duplicate
  players, or syncing external NFL/ESPN metadata.
---

# Player Data Maintenance

## Identity Keys
- **Players:** `first|last|age|offense|defense|special` (all lowercase). Used by `lib/maintenance.ts` upsert.
- **Cuts:** Same as players; age-mismatch fallback drops the age field.

## Common Maintenance Commands

1. **Deduplicate Players** (consolidates same-identity rows in the DB):
   ```bash
   node --env-file=.env.local --import tsx scripts/dedupe-players.ts
   ```
2. **Sync ESPN IDs & NFL Teams**:
   ```bash
   node --env-file=.env.local --import tsx scripts/sync-espn-ids.ts
   node --env-file=.env.local --import tsx scripts/sync-nfl-teams.ts
   ```
3. **Sync Player Photos to Vercel Blob**:
   ```bash
   node --env-file=.env.local --import tsx scripts/download-player-photos.ts
   node --env-file=.env.local --import tsx scripts/upload-player-photos-blob.ts
   ```
4. **Verify Roster Limits & Salary**:
   ```bash
   node --env-file=.env.local --import tsx scripts/audit-roster-limits.ts
   node --env-file=.env.local --import tsx scripts/check-salary.ts
   ```
