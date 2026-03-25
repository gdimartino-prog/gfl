# GFL Database Backup & Restore

## Overview

Daily automated backups run via GitHub Actions at 6am UTC (2am ET).
All tables are exported as JSON files to the `backups/` folder in the repo.
Passwords are excluded from the teams backup.

---

## Backup

### Automatic (Daily)
GitHub Actions runs `scripts/backup-db.ts` every day at 6am UTC and commits the results to `backups/` in the `main` branch.

To trigger manually:
1. Go to **github.com/gdimartino-prog/gfl** → **Actions** tab
2. Click **Daily DB Backup** in the left sidebar
3. Click **Run workflow** → **Run workflow**

### Manual (Local)
```bash
POSTGRES_URL="..." npx tsx scripts/backup-db.ts
```

### What gets backed up
| File | Table |
|------|-------|
| `leagues.json` | leagues |
| `teams.json` | teams (passwords excluded) |
| `players.json` | players |
| `transactions.json` | transactions |
| `draft_picks.json` | draft_picks |
| `draft_pick_transfers.json` | draft_pick_transfers |
| `cuts.json` | cuts |
| `rules.json` | rules |
| `resources.json` | resources |
| `standings.json` | standings |
| `schedule.json` | schedule |
| `trade_block.json` | trade_block |
| `audit_log.json` | audit_log |
| `_manifest.json` | timestamp + row counts |

---

## Restore

### Step 1 — Get the backup files

**Restore from today's backup** (already in `backups/`):
No action needed — files are already there.

**Restore from a specific date:**
```bash
# Find the commit hash from git log
git log --oneline -- backups/_manifest.json

# Checkout the backup files from that commit
git checkout <commit-hash> -- backups/

# After restore, put backups/ back to latest
git checkout main -- backups/
```

### Step 2 — Dry run first (no data changed)
```bash
POSTGRES_URL="..." npx tsx scripts/restore-db.ts
```
This shows what would be restored without touching any data.

### Step 3 — Run the actual restore
```bash
POSTGRES_URL="..." npx tsx scripts/restore-db.ts --confirm
```

⚠️ **WARNING:** This deletes all existing data in each table and replaces it with the backup. Do not run unless you intend a full restore.

---

## Notes

- The `POSTGRES_URL` is in `.env.local` (never commit this file)
- GitHub Actions uses the `POSTGRES_URL` repository secret (set in repo Settings → Secrets → Actions)
- RLS (Row Level Security) is not affected by backup/restore
- After any restore, consider running `npx tsx scripts/enable-rls.ts` to ensure RLS is still enabled
- Restore inserts in batches of 500 rows to avoid query size limits
- Tables are restored in dependency order (leagues → teams → players → etc.)
