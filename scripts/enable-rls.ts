/**
 * Enable Row Level Security on all app tables.
 * Run after any schema migration (db:push) that creates/recreates tables.
 * Run: npx tsx scripts/enable-rls.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

// Dynamic imports AFTER env is loaded — static imports are hoisted and
// would evaluate lib/db before POSTGRES_URL is set.
const { db } = await import('../lib/db');
const { sql } = await import('drizzle-orm');

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
