/**
 * Enable Row Level Security on all app tables.
 * Run after any schema migration (db:push) that creates/recreates tables.
 * Run: POSTGRES_URL="..." npx tsx scripts/enable-rls.ts
 *
 * Note: The app connects via the postgres service role which bypasses RLS,
 * so this doesn't affect app functionality — it just blocks the anon key
 * from direct table access as a security best practice.
 */

import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

const tables = [
  'leagues',
  'teams',
  'players',
  'transactions',
  'draft_picks',
  'cuts',
  'rules',
  'resources',
  'standings',
  'schedule',
  'trade_block',
  'audit_log',
  'draft_pick_transfers',
];

async function main() {
  for (const t of tables) {
    try {
      await db.execute(sql.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`));
      console.log('✓ RLS enabled:', t);
    } catch (e: any) {
      console.log('  SKIP:', t, '-', e.message);
    }
  }
  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
