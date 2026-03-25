/**
 * Restore DB from JSON backup files in backups/
 *
 * WARNING: This will DELETE existing data and replace it with the backup.
 * Run only when you want to fully restore from a backup.
 *
 * Usage:
 *   POSTGRES_URL="..." npx tsx scripts/restore-db.ts
 *
 * To restore from a specific git commit:
 *   git checkout <commit-hash> -- backups/
 *   POSTGRES_URL="..." npx tsx scripts/restore-db.ts
 *   git checkout main -- backups/
 */

import { db } from '../lib/db';
import {
  leagues, teams, players, transactions, draftPicks, cuts,
  rules, resources, standings, schedule, tradeBlock, auditLog,
  pickTransfers,
} from '../schema';
import * as fs from 'fs';
import * as path from 'path';

const BACKUP_DIR = path.join(process.cwd(), 'backups');

function readJson(file: string) {
  const p = path.join(BACKUP_DIR, file);
  if (!fs.existsSync(p)) { console.log(`  SKIP: ${file} not found`); return null; }
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

async function main() {
  const manifest = readJson('_manifest.json');
  if (manifest) {
    console.log(`\nRestoring backup from: ${manifest.timestamp}`);
    console.log(`Tables: ${manifest.tables.join(', ')}\n`);
  }

  const confirm = process.argv[2];
  if (confirm !== '--confirm') {
    console.log('⚠️  DRY RUN — no data will be changed.');
    console.log('    Re-run with --confirm to actually restore:\n');
    console.log('    POSTGRES_URL="..." npx tsx scripts/restore-db.ts --confirm\n');
    process.exit(0);
  }

  console.log('🔴 RESTORING — this will overwrite existing data...\n');

  // Restore in dependency order (leagues first, then tables that reference them)
  const steps: { name: string; file: string; table: any; truncate: () => Promise<any>; insert: (rows: any[]) => Promise<any> }[] = [
    {
      name: 'leagues', file: 'leagues.json', table: leagues,
      truncate: () => db.delete(leagues),
      insert: (rows) => db.insert(leagues).values(rows),
    },
    {
      name: 'teams', file: 'teams.json', table: teams,
      truncate: () => db.delete(teams),
      insert: (rows) => db.insert(teams).values(rows),
    },
    {
      name: 'players', file: 'players.json', table: players,
      truncate: () => db.delete(players),
      insert: (rows) => db.insert(players).values(rows),
    },
    {
      name: 'rules', file: 'rules.json', table: rules,
      truncate: () => db.delete(rules),
      insert: (rows) => db.insert(rules).values(rows),
    },
    {
      name: 'resources', file: 'resources.json', table: resources,
      truncate: () => db.delete(resources),
      insert: (rows) => db.insert(resources).values(rows),
    },
    {
      name: 'standings', file: 'standings.json', table: standings,
      truncate: () => db.delete(standings),
      insert: (rows) => db.insert(standings).values(rows),
    },
    {
      name: 'schedule', file: 'schedule.json', table: schedule,
      truncate: () => db.delete(schedule),
      insert: (rows) => db.insert(schedule).values(rows),
    },
    {
      name: 'transactions', file: 'transactions.json', table: transactions,
      truncate: () => db.delete(transactions),
      insert: (rows) => db.insert(transactions).values(rows),
    },
    {
      name: 'draft_picks', file: 'draft_picks.json', table: draftPicks,
      truncate: () => db.delete(draftPicks),
      insert: (rows) => db.insert(draftPicks).values(rows),
    },
    {
      name: 'draft_pick_transfers', file: 'draft_pick_transfers.json', table: pickTransfers,
      truncate: () => db.delete(pickTransfers),
      insert: (rows) => db.insert(pickTransfers).values(rows),
    },
    {
      name: 'cuts', file: 'cuts.json', table: cuts,
      truncate: () => db.delete(cuts),
      insert: (rows) => db.insert(cuts).values(rows),
    },
    {
      name: 'trade_block', file: 'trade_block.json', table: tradeBlock,
      truncate: () => db.delete(tradeBlock),
      insert: (rows) => db.insert(tradeBlock).values(rows),
    },
    {
      name: 'audit_log', file: 'audit_log.json', table: auditLog,
      truncate: () => db.delete(auditLog),
      insert: (rows) => db.insert(auditLog).values(rows),
    },
  ];

  for (const step of steps) {
    const rows = readJson(step.file);
    if (!rows || rows.length === 0) { console.log(`  SKIP: ${step.name} (empty)`); continue; }

    try {
      await step.truncate();
      // Insert in batches of 500 to avoid query size limits
      const BATCH = 500;
      for (let i = 0; i < rows.length; i += BATCH) {
        await step.insert(rows.slice(i, i + BATCH));
      }
      console.log(`✓ ${step.name}: ${rows.length} rows restored`);
    } catch (e: any) {
      console.error(`✗ ${step.name} FAILED:`, e.message);
    }
  }

  console.log('\n✅ Restore complete.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
