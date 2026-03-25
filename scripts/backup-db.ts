/**
 * Export all DB tables to JSON files in backups/
 * Run: POSTGRES_URL="..." npx tsx scripts/backup-db.ts
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

const tablesToBackup = [
  { name: 'leagues',              query: () => db.select().from(leagues) },
  { name: 'teams',                query: () => db.select({
    id: teams.id, leagueId: teams.leagueId, name: teams.name,
    coach: teams.coach, teamshort: teams.teamshort, nickname: teams.nickname,
    isCommissioner: teams.isCommissioner, status: teams.status,
    mobile: teams.mobile, email: teams.email,
    // password intentionally excluded from backup
  }).from(teams) },
  { name: 'players',              query: () => db.select().from(players) },
  { name: 'transactions',         query: () => db.select().from(transactions) },
  { name: 'draft_picks',          query: () => db.select().from(draftPicks) },
  { name: 'cuts',                 query: () => db.select().from(cuts) },
  { name: 'rules',                query: () => db.select().from(rules) },
  { name: 'resources',            query: () => db.select().from(resources) },
  { name: 'standings',            query: () => db.select().from(standings) },
  { name: 'schedule',             query: () => db.select().from(schedule) },
  { name: 'trade_block',          query: () => db.select().from(tradeBlock) },
  { name: 'audit_log',            query: () => db.select().from(auditLog) },
  { name: 'draft_pick_transfers', query: () => db.select().from(pickTransfers) },
];

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  let total = 0;

  for (const { name, query } of tablesToBackup) {
    try {
      const rows = await query();
      const file = path.join(BACKUP_DIR, `${name}.json`);
      fs.writeFileSync(file, JSON.stringify(rows, null, 2));
      console.log(`✓ ${name}: ${rows.length} rows`);
      total += rows.length;
    } catch (e: any) {
      console.log(`  SKIP: ${name} — ${e.message}`);
    }
  }

  // Write a manifest
  fs.writeFileSync(
    path.join(BACKUP_DIR, '_manifest.json'),
    JSON.stringify({ timestamp, totalRows: total, tables: tablesToBackup.map(t => t.name) }, null, 2)
  );

  console.log(`\nBackup complete: ${total} total rows → backups/`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
